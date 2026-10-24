from fastapi import APIRouter, BackgroundTasks, status

from app.api.deps import LLM, Actor, Audit, EvaluationLaunch, Evaluations, Projects
from app.api.schemas.evaluation import EvaluationInfoOut, EvaluationRunOut, EvaluationStartIn
from app.application import evaluations
from app.application.projects import require_project
from app.config import get_settings
from app.domain.entities.evaluation import EvaluationRun
from app.domain.evaluation import INJECTION_CASES
from app.infrastructure.evaluation.golden import load_golden
from app.infrastructure.persistence.database import get_engine
from app.infrastructure.persistence.sql_quota import SqlQuota

router = APIRouter(tags=["evaluations"])


def _out(run: EvaluationRun) -> EvaluationRunOut:
    return EvaluationRunOut(**{**vars(run), "mode": run.mode, "status": run.status})


def _quota_remaining() -> int | None:
    settings = get_settings()
    if not (settings.ai_configured and settings.gemini_model):
        return None
    quota = SqlQuota(get_engine(), settings.ai_requests_per_minute, settings.ai_daily_limit)
    return quota.remaining_today(settings.gemini_model)


@router.get("/projects/{project_id}/evaluations/info", response_model=EvaluationInfoOut)
def evaluation_info(project_id: str, projects: Projects, llm: LLM) -> EvaluationInfoOut:
    require_project(projects, project_id)
    return EvaluationInfoOut(
        golden_stories=len(load_golden()),
        injection_cases=len(INJECTION_CASES),
        ai_available=llm is not None,
        ai_quota_remaining_today=_quota_remaining() if llm is not None else None,
    )


@router.post(
    "/projects/{project_id}/evaluations",
    response_model=EvaluationRunOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_evaluation(
    project_id: str,
    payload: EvaluationStartIn,
    projects: Projects,
    runs: Evaluations,
    llm: LLM,
    launch: EvaluationLaunch,
    background: BackgroundTasks,
    audit: Audit,
    actor: Actor,
) -> EvaluationRunOut:
    """Inicia la evaluación en segundo plano; el avance se consulta por su id."""
    require_project(projects, project_id)
    run = evaluations.start_run(
        runs,
        load_golden(),
        project_id,
        payload.mode,
        actor,
        ai_available=llm is not None,
        quota_remaining=_quota_remaining(),
    )
    audit.record(actor, "evaluation.started", "evaluation", run.id, project_id, payload.mode)
    background.add_task(launch, run.id)
    return _out(run)


@router.get("/projects/{project_id}/evaluations", response_model=list[EvaluationRunOut])
def list_evaluations(
    project_id: str, projects: Projects, runs: Evaluations
) -> list[EvaluationRunOut]:
    require_project(projects, project_id)
    return [_out(r) for r in runs.list_runs(project_id)]


@router.get("/evaluations/{run_id}", response_model=EvaluationRunOut)
def get_evaluation(run_id: str, runs: Evaluations) -> EvaluationRunOut:
    return _out(evaluations.get_run(runs, run_id))
