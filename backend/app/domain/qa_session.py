"""Reglas de negocio de la sesión de revisión en el ambiente QA."""

from collections.abc import Mapping, Sequence
from urllib.parse import urlparse

from app.domain.entities import (
    ChecklistPhase,
    DefectFields,
    DefectSeverity,
    Execution,
    ExecutionResult,
    Frequency,
    Priority,
    QASession,
    QATestCase,
    Recommendation,
)
from app.domain.ports.llm import AIDefectDraft

# Plantilla del checklist (docs/02-marco-normativo-qa.md §7).
CHECKLIST_TEMPLATE: tuple[tuple[ChecklistPhase, str], ...] = (
    (ChecklistPhase.PREPARATION, "Ambiente QA disponible y accesible"),
    (ChecklistPhase.PREPARATION, "La versión/build desplegada coincide con la esperada"),
    (ChecklistPhase.PREPARATION, "Datos de prueba cargados"),
    (ChecklistPhase.PREPARATION, "Usuarios y permisos de prueba disponibles"),
    (ChecklistPhase.PREPARATION, "Servicios dependientes activos"),
    (ChecklistPhase.PREPARATION, "Navegadores y dispositivos de prueba definidos"),
    (ChecklistPhase.EXECUTION, "Cada caso ejecutado tiene resultado y evidencia"),
    (ChecklistPhase.EXECUTION, "Defectos registrados con pasos de reproducción"),
    (ChecklistPhase.EXECUTION, "Defectos corregidos vueltos a probar"),
    (ChecklistPhase.EXECUTION, "Regresión del área afectada realizada"),
    (ChecklistPhase.CLOSURE, "Todos los criterios de aceptación verificados"),
    (ChecklistPhase.CLOSURE, "Defectos abiertos clasificados por severidad"),
    (ChecklistPhase.CLOSURE, "Recomendación final definida"),
)

MINOR_SEVERITIES = {DefectSeverity.MINOR, DefectSeverity.TRIVIAL}
MAX_TEXT_CHARS = 1000
MAX_STEPS = 12

_SEVERITY_BY_PRIORITY = {
    Priority.HIGH: DefectSeverity.MAJOR,
    Priority.MEDIUM: DefectSeverity.MINOR,
    Priority.LOW: DefectSeverity.TRIVIAL,
}


def pending_count(executions: Sequence[Execution]) -> int:
    return sum(e.result == ExecutionResult.NOT_RUN for e in executions)


def has_failures(executions: Sequence[Execution]) -> bool:
    return any(e.result in (ExecutionResult.FAILED, ExecutionResult.BLOCKED) for e in executions)


def suggest_recommendation(
    executions: Sequence[Execution], defect_severity: Mapping[str, DefectSeverity]
) -> Recommendation | None:
    """Sugerencia para el analista. None mientras queden casos sin ejecutar.

    `defect_severity` asocia id de ejecución -> severidad del defecto registrado.
    """
    if not executions or pending_count(executions):
        return None
    if not has_failures(executions):
        return Recommendation.ACCEPT
    only_minor = all(
        e.result == ExecutionResult.FAILED and defect_severity.get(e.id) in MINOR_SEVERITIES
        for e in executions
        if e.result != ExecutionResult.PASSED
    )
    return Recommendation.ACCEPT_WITH_MINOR_DEFECTS if only_minor else Recommendation.REJECT


def build_base_defect(case: QATestCase, execution: Execution, session: QASession) -> DefectFields:
    """Defecto armado solo con datos reales de la sesión: es la base, con o sin IA."""
    actual = execution.actual_result.strip() or execution.notes.strip()
    return DefectFields(
        title=f"Falla en: {case.title}"[:150],
        preconditions=case.preconditions,
        steps=case.steps,
        expected_result=case.expected_result,
        actual_result=actual or "(sin descripción del resultado obtenido)",
        severity=_SEVERITY_BY_PRIORITY[case.priority],
        priority=case.priority,
        frequency=Frequency.ALWAYS,
        environment=f"{session.environment_name} ({session.environment_url})".strip(),
        build_version=session.build_version,
    )


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"
MAX_LINK_CHARS = 500


def detect_image_extension(content: bytes) -> str | None:
    """Reconoce PNG, JPEG y WebP por su contenido real, nunca por el nombre ni el tipo declarado."""
    if content.startswith(PNG_SIGNATURE):
        return "png"
    if content.startswith(JPEG_SIGNATURE):
        return "jpg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    return None


def is_safe_link(url: str) -> bool:
    """Solo http(s) con servidor: descarta javascript:, data:, file: y similares."""
    candidate = url.strip()
    if not candidate or len(candidate) > MAX_LINK_CHARS:
        return False
    parsed = urlparse(candidate)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _text(value: str | None, limit: int = MAX_TEXT_CHARS) -> str:
    return (value or "").strip()[:limit]


def merge_ai_defect(base: DefectFields, draft: AIDefectDraft) -> DefectFields:
    """Toma la redacción de la IA solo donde es válida.

    Severidad, prioridad y datos del ambiente salen siempre de la base: la severidad que propone
    la IA varió entre ejecuciones con los mismos hechos, así que la decide la persona.
    """
    steps = tuple(_text(s) for s in draft.steps if _text(s))[:MAX_STEPS]
    return DefectFields(
        title=_text(draft.title, 150) or base.title,
        preconditions=_text(draft.preconditions) or base.preconditions,
        steps=steps or base.steps,
        expected_result=_text(draft.expected_result) or base.expected_result,
        actual_result=_text(draft.actual_result) or base.actual_result,
        severity=base.severity,
        priority=base.priority,
        frequency=base.frequency,
        environment=base.environment,
        build_version=base.build_version,
        ai_assisted=True,
    )
