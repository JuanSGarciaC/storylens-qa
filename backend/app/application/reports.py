"""Reportes en Markdown de un análisis y de una sesión QA.

Todo el texto escrito por personas o por la IA se normaliza antes de entrar al reporte:
una sola línea y sin `<`, para que no pueda abrir títulos, listas ni HTML dentro del documento.
"""

import re
from collections.abc import Iterable
from datetime import datetime

from app.application.qa_sessions import SessionDetail
from app.domain.entities import (
    Decision,
    Evidence,
    EvidenceType,
    ExecutionResult,
    Finding,
    Recommendation,
    Severity,
    Source,
    StoredAnalysis,
    Story,
)
from app.domain.scoring import calculate_score
from app.domain.scoring.score import Verdict
from app.domain.test_design import Traceability

VERDICT_LABEL = {
    Verdict.READY: "Lista para probar",
    Verdict.READY_WITH_NOTES: "Lista con observaciones",
    Verdict.NOT_READY: "No está lista",
}
SEVERITY_LABEL = {
    Severity.BLOCKING: "Bloqueante",
    Severity.MAJOR: "Mayor",
    Severity.MINOR: "Menor",
    Severity.INFO: "Informativo",
}
DECISION_LABEL = {
    Decision.PENDING: "Pendiente",
    Decision.ACCEPTED: "Aceptado",
    Decision.DISMISSED: "Descartado",
}
RESULT_LABEL = {
    ExecutionResult.NOT_RUN: "Sin ejecutar",
    ExecutionResult.PASSED: "Pasó",
    ExecutionResult.FAILED: "Falló",
    ExecutionResult.BLOCKED: "Bloqueado",
}
RECOMMENDATION_LABEL = {
    Recommendation.ACCEPT: "Aceptar la historia",
    Recommendation.ACCEPT_WITH_MINOR_DEFECTS: "Aceptar con defectos menores",
    Recommendation.REJECT: "Rechazar la historia",
}
AI_STATUS_LABEL = {
    "not_requested": "No se pidió",
    "ok": "Complementado con IA",
    "unavailable": "No disponible: solo reglas",
    "invalid_response": "Respuesta inválida: solo reglas",
}

_SPACES = re.compile(r"\s+")


def clean(text: str | None) -> str:
    """Texto en una sola línea y sin `<`."""
    return _SPACES.sub(" ", (text or "").replace("<", "&lt;")).strip()


def _date(value: datetime | None) -> str:
    return value.strftime("%Y-%m-%d %H:%M") if value else "—"


def filename(title: str, suffix: str) -> str:
    """Nombre de archivo seguro (solo ASCII, sin separadores de ruta)."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50] or "reporte"
    return f"{slug}-{suffix}"


def _story_section(story: Story) -> list[str]:
    lines = [
        f"## Historia: {clean(story.title)}",
        "",
        clean(story.description) or "_Sin descripción._",
    ]
    if story.acceptance_criteria:
        lines += ["", "**Criterios de aceptación**", ""]
        lines += [f"{i}. {clean(c)}" for i, c in enumerate(story.acceptance_criteria, 1)]
    return lines


def _finding_lines(finding: Finding) -> list[str]:
    origin = "IA" if finding.source == Source.AI else "regla"
    head = (
        f"- **[{SEVERITY_LABEL[finding.severity]}] {finding.rule_id}** ({origin}) — "
        f"{clean(finding.message)}"
    )
    lines = [head, f"  - Decisión: {DECISION_LABEL[finding.decision]}"]
    if finding.decision == Decision.DISMISSED and finding.dismiss_reason:
        lines.append(f"  - Motivo del descarte: {clean(finding.dismiss_reason)}")
    if finding.suggestion:
        lines.append(f"  - Sugerencia: {clean(finding.suggestion)}")
    if finding.evidence_text:
        lines.append(f"  - Evidencia en la historia: «{clean(finding.evidence_text)}»")
    lines.append(f"  - Norma: {clean(finding.reference)}")
    return lines


def analysis_markdown(story: Story, analysis: StoredAnalysis) -> str:
    score = calculate_score(analysis.findings)
    lines = [
        "# Reporte de análisis de historia",
        "",
        *_story_section(story),
        "",
        "## Resultado",
        "",
        f"- **Puntaje:** {score.value}/100 — {VERDICT_LABEL[score.verdict]}",
        f"- **Fecha del análisis:** {_date(analysis.created_at)}",
        f"- **IA:** {AI_STATUS_LABEL.get(analysis.ai_status.value, analysis.ai_status.value)}",
        f"- **Catálogo de reglas:** {clean(analysis.catalog_version)}",
    ]
    if analysis.model_name:
        lines.append(
            f"- **Modelo:** {clean(analysis.model_name)} ({clean(analysis.prompt_version)})"
        )
    lines += ["", f"## Hallazgos ({len(analysis.findings)})", ""]
    if not analysis.findings:
        lines.append("_No se encontraron hallazgos._")
    for finding in analysis.findings:
        lines += _finding_lines(finding)
    lines += [
        "",
        "_Los hallazgos descartados no penalizan el puntaje. "
        "Los hallazgos de IA son sugerencias que la persona revisó._",
        "",
    ]
    return "\n".join(lines)


def _count(items: Iterable[ExecutionResult], result: ExecutionResult) -> int:
    return sum(1 for r in items if r == result)


def session_markdown(story: Story, detail: SessionDetail, traceability: Traceability) -> str:
    session = detail.session
    results = [v.execution.result for v in detail.executions]
    state = "Cerrada" if session.closed else "En curso"
    lines = [
        "# Reporte de sesión de revisión QA",
        "",
        *_story_section(story),
        "",
        "## Sesión",
        "",
        f"- **Estado:** {state}",
        f"- **Ambiente:** {clean(session.environment_name)} ({clean(session.environment_url)})",
        f"- **Build:** {clean(session.build_version)}",
        f"- **Responsable:** {clean(session.tester_name)}",
        f"- **Inicio:** {_date(session.started_at)}",
    ]
    if session.closed:
        lines.append(f"- **Cierre:** {_date(session.closed_at)}")
    if session.recommendation:
        lines.append(f"- **Recomendación final:** {RECOMMENDATION_LABEL[session.recommendation]}")
    if session.summary:
        lines.append(f"- **Resumen:** {clean(session.summary)}")
    lines += [
        "",
        "## Resultados",
        "",
        f"- Total de casos: {len(results)}",
        f"- Pasaron: {_count(results, ExecutionResult.PASSED)}",
        f"- Fallaron: {_count(results, ExecutionResult.FAILED)}",
        f"- Bloqueados: {_count(results, ExecutionResult.BLOCKED)}",
        f"- Sin ejecutar: {_count(results, ExecutionResult.NOT_RUN)}",
        "",
        "## Cobertura de criterios",
        "",
    ]
    if traceability.rows:
        lines.append(
            f"Criterios con al menos un caso aceptado: {round(traceability.coverage * 100)} %."
        )
        lines.append("")
        for row in traceability.rows:
            mark = "cubierto" if row.covered else "sin caso aceptado"
            lines.append(f"- Criterio {row.index} ({mark}): {clean(row.text)}")
    else:
        lines.append("_La historia no tiene criterios de aceptación._")

    lines += ["", "## Checklist", ""]
    for item in detail.checklist:
        box = "x" if item.checked else " "
        note = f" — {clean(item.note)}" if item.note else ""
        lines.append(f"- [{box}] {clean(item.text)}{note}")

    lines += ["", "## Ejecución de casos", ""]
    if not detail.executions:
        lines.append("_No hay casos en la sesión._")
    for view in detail.executions:
        execution = view.execution
        title = clean(view.case.title) if view.case else "(caso eliminado)"
        lines += [f"### {title}", "", f"- **Resultado:** {RESULT_LABEL[execution.result]}"]
        if view.case:
            lines.append(f"- **Técnica:** {view.case.technique.value}")
            lines.append(f"- **Resultado esperado:** {clean(view.case.expected_result)}")
        if execution.actual_result:
            lines.append(f"- **Resultado obtenido:** {clean(execution.actual_result)}")
        if execution.notes:
            lines.append(f"- **Notas:** {clean(execution.notes)}")
        for evidence in view.evidences:
            lines.append(f"- **Evidencia ({evidence.type.value}):** {_evidence_text(evidence)}")
        if view.defect:
            fields = view.defect.fields
            lines += [
                f"- **Defecto:** {clean(fields.title)} "
                f"(severidad {fields.severity.value}, prioridad {fields.priority.value})",
            ]
        lines.append("")
    return "\n".join(lines)


def _evidence_text(evidence: Evidence) -> str:
    description = clean(evidence.description)
    if evidence.type == EvidenceType.LINK:
        return f"{description} — {clean(evidence.uri)}" if description else clean(evidence.uri)
    if evidence.type == EvidenceType.IMAGE:
        return f"imagen «{description or 'sin descripción'}» (archivo guardado en el servidor)"
    return description
