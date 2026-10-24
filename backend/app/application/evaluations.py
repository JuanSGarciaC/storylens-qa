import logging
import time
from collections.abc import Callable
from dataclasses import asdict
from typing import Any

from app.application.analyze_story import analyze_story
from app.application.errors import NotFoundError
from app.application.qa_sessions import ConflictError
from app.domain.entities import AIStatus, Source, Story
from app.domain.entities.evaluation import (
    EvaluationMode,
    EvaluationRun,
    EvaluationStatus,
)
from app.domain.evaluation import (
    INJECTION_CASES,
    GoldenStory,
    StoryOutcome,
    check_injection,
    diffs,
    score,
)
from app.domain.ports import LLMError, LLMPort
from app.domain.ports.evaluations import EvaluationRepository
from app.domain.rules.catalog import load_catalog

logger = logging.getLogger(__name__)

# 5 peticiones por minuto es el tope propio de la IA (ADR-005): una cada 12 s nunca lo supera.
AI_PAUSE_SECONDS = 12.0
MAX_CONSECUTIVE_AI_FAILURES = 2


def evaluation_size(mode: EvaluationMode, golden: list[GoldenStory]) -> int:
    return len(INJECTION_CASES) if mode is EvaluationMode.INJECTION else len(golden)


def start_run(
    runs: EvaluationRepository,
    golden: list[GoldenStory],
    project_id: str,
    mode: EvaluationMode,
    actor: str,
    ai_available: bool,
    quota_remaining: int | None,
) -> EvaluationRun:
    """Registra la corrida. Las que usan IA exigen cuota suficiente: nunca se gasta de más."""
    total = evaluation_size(mode, golden)
    if any(r.status.active for r in runs.list_runs(project_id)):
        raise ConflictError("Ya hay una evaluación en curso en este proyecto")
    if mode is not EvaluationMode.RULES:
        if not ai_available:
            raise ConflictError("La IA no está configurada o no está disponible")
        if quota_remaining is not None and quota_remaining < total:
            raise ConflictError(
                f"La cuota de IA de hoy no alcanza: quedan {quota_remaining} consultas y esta "
                f"evaluación necesita {total}"
            )
    return runs.create_run(project_id, mode, actor, total, load_catalog().version)


def get_run(runs: EvaluationRepository, run_id: str) -> EvaluationRun:
    run = runs.get_run(run_id)
    if run is None:
        raise NotFoundError(f"Evaluación {run_id} no encontrada")
    return run


def execute_run(
    runs: EvaluationRepository,
    golden: list[GoldenStory],
    llm: LLMPort | None,
    run_id: str,
    pause: float = AI_PAUSE_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> None:
    run = runs.get_run(run_id)
    if run is None or run.status is not EvaluationStatus.RUNNING:
        return
    try:
        if run.mode is EvaluationMode.INJECTION:
            _run_injection(runs, run, llm, pause, sleep)
        else:
            _run_golden(runs, run, golden, llm, pause, sleep)
    except Exception:
        logger.exception("La evaluación %s falló", run_id)
        runs.update_run(
            run_id,
            status=EvaluationStatus.FAILED,
            note="La evaluación falló por un error interno.",
        )


def _run_golden(
    runs: EvaluationRepository,
    run: EvaluationRun,
    golden: list[GoldenStory],
    llm: LLMPort | None,
    pause: float,
    sleep: Callable[[float], None],
) -> None:
    use_ai = run.mode is EvaluationMode.RULES_AI
    catalog = load_catalog()
    det_ids = {r.id for r in catalog.of_type("deterministic")}
    ai_ids = {r.id for r in catalog.of_type("ai")}
    outcomes: list[StoryOutcome] = []
    statuses: dict[str, int] = {}
    model = prompt = None
    failures = 0
    incomplete = False
    for index, item in enumerate(golden):
        if use_ai and index:
            sleep(pause)  # una consulta cada `pause` segundos: respeta el tope por minuto
        result = analyze_story(item.story, llm=llm, use_ai=use_ai)
        status = str(result.ai_status)
        statuses[status] = statuses.get(status, 0) + 1
        model = result.model_name or model
        prompt = result.prompt_version or prompt
        found = frozenset(f.rule_id for f in result.findings)
        found_ai = frozenset(f.rule_id for f in result.findings if f.source == Source.AI)
        outcomes.append(StoryOutcome(item.id, item.expected, found, found_ai, status))
        runs.update_run(run.id, processed=index + 1)
        if use_ai:
            failures = 0 if result.ai_status == AIStatus.OK else failures + 1
            if failures >= MAX_CONSECUTIVE_AI_FAILURES:
                incomplete = True
                break
    metrics = score(outcomes, det_ids, ai_ids if use_ai else set())
    scored = det_ids | (ai_ids if use_ai else set())
    details: dict[str, Any] = {
        "ai_status": statuses,
        "stories": [
            {**asdict(d), "note": next(g.note for g in golden if g.id == d.id)}
            for d in diffs(outcomes, scored)
        ],
        "measured_for_ai": statuses.get("ok", 0),
    }
    runs.update_run(
        run.id,
        status=EvaluationStatus.INCOMPLETE if incomplete else EvaluationStatus.SUCCEEDED,
        model_name=model,
        prompt_version=prompt,
        metrics={
            "det": asdict(metrics["det"]),
            "ai": asdict(metrics["ai"]) if use_ai else None,
        },
        details=details,
        note="La IA dejó de responder: la evaluación quedó incompleta." if incomplete else "",
    )


def _run_injection(
    runs: EvaluationRepository,
    run: EvaluationRun,
    llm: LLMPort | None,
    pause: float,
    sleep: Callable[[float], None],
) -> None:
    ai_rules = load_catalog().of_type("ai")
    results = []
    model = prompt = None
    for index, case in enumerate(INJECTION_CASES):
        if index:
            sleep(pause)
        story = Story(title=case.title, description=case.description)
        texts: list[str] = []
        status = "unavailable"
        if llm is not None:
            try:
                analysis = llm.analyze_story(story, ai_rules)
            except LLMError:
                status = "unavailable"
            else:
                status = "ok"
                model, prompt = analysis.model_name, analysis.prompt_version
                for finding in analysis.findings:
                    texts += [
                        finding.message,
                        finding.suggestion,
                        finding.evidence_text or "",
                    ]
        results.append(check_injection(case, texts, status))
        runs.update_run(run.id, processed=index + 1)
    failed = sum(1 for r in results if r.status == "failed")
    not_evaluable = sum(1 for r in results if r.status == "not_evaluable")
    runs.update_run(
        run.id,
        status=EvaluationStatus.INCOMPLETE if not_evaluable else EvaluationStatus.SUCCEEDED,
        model_name=model,
        prompt_version=prompt,
        metrics={
            "injection": {
                "passed": sum(1 for r in results if r.status == "passed"),
                "failed": failed,
                "not_evaluable": not_evaluable,
                "total": len(results),
            }
        },
        details={"injection": [asdict(r) for r in results]},
        note="Alguna prueba no se pudo evaluar porque la IA no respondió." if not_evaluable else "",
    )


def ensure_demo_run(runs: EvaluationRepository, golden: list[GoldenStory], project_id: str) -> None:
    """La demo trae una evaluación de ejemplo de solo reglas: no gasta cuota de IA."""
    if runs.list_runs(project_id):
        return
    run = start_run(
        runs,
        golden,
        project_id,
        EvaluationMode.RULES,
        "sistema",
        ai_available=False,
        quota_remaining=None,
    )
    execute_run(runs, golden, None, run.id)
