from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, Query, UploadFile, status

from app.api.deps import Actor, Audit, ImportJobs, JobLaunch, Projects, Repository
from app.api.routers.story_import import _mapping, _read, _selected
from app.api.schemas.import_job import ImportItemOut, ImportJobDetailOut, ImportJobOut
from app.application import import_jobs, story_import
from app.application.projects import require_project
from app.domain.entities.import_job import ImportItem, ImportJob, ItemStatus
from app.domain.story_import import ImportFormatError

router = APIRouter(tags=["import-jobs"])


def _job_out(job: ImportJob) -> ImportJobOut:
    return ImportJobOut(
        id=job.id,
        project_id=job.project_id,
        filename=job.filename,
        status=job.status,
        use_ai=job.use_ai,
        total=job.total,
        processed=job.processed,
        done=job.done,
        skipped=job.skipped,
        failed=job.failed,
        pending=job.pending,
        note=job.note,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


def _item_out(item: ImportItem) -> ImportItemOut:
    return ImportItemOut(
        row_index=item.row_index,
        key=item.key,
        title=item.title,
        status=item.status,
        story_id=item.story_id,
        error=item.error,
        ai_status=item.ai_status,
    )


@router.post(
    "/projects/{project_id}/import-jobs",
    response_model=ImportJobOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def start_import(
    project_id: str,
    repo: Repository,
    projects: Projects,
    jobs: ImportJobs,
    launch: JobLaunch,
    background: BackgroundTasks,
    audit: Audit,
    actor: Actor,
    file: Annotated[UploadFile, File()],
    mapping: Annotated[str | None, Form()] = None,
    selected: Annotated[str | None, Form()] = None,
    use_ai: Annotated[bool, Form()] = False,
) -> ImportJobOut:
    """Crea la importación y la procesa en segundo plano; el avance se consulta por su id."""
    require_project(projects, project_id)
    filename = file.filename or ""
    preview = story_import.preview_import(
        repo, project_id, filename, _read(file), _mapping(mapping)
    )
    if preview.truncated:
        raise ImportFormatError(
            f"El archivo tiene más de {import_jobs.MAX_JOB_ROWS} filas: divídelo en partes"
        )
    chosen = _selected(selected)
    wanted = set(chosen) if chosen is not None else None
    rows = [
        item.row
        for item in preview.rows
        if item.importable and (wanted is None or item.row.index in wanted)
    ]
    job = import_jobs.start_job(jobs, project_id, filename, rows, use_ai, actor)
    audit.record(actor, "import.started", "import", job.id, project_id, f"{job.total} filas")
    background.add_task(launch, job.id)
    return _job_out(job)


@router.get("/projects/{project_id}/import-jobs", response_model=list[ImportJobOut])
def list_imports(project_id: str, projects: Projects, jobs: ImportJobs) -> list[ImportJobOut]:
    require_project(projects, project_id)
    return [_job_out(job) for job in jobs.list_jobs(project_id)]


@router.get("/import-jobs/{job_id}", response_model=ImportJobDetailOut)
def get_import(
    job_id: str,
    jobs: ImportJobs,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    item_status: Annotated[ItemStatus | None, Query(alias="status")] = None,
) -> ImportJobDetailOut:
    job = import_jobs.get_job(jobs, job_id)
    items = jobs.list_items(job_id, item_status, limit=limit, offset=offset)
    return ImportJobDetailOut(
        **_job_out(job).model_dump(),
        items=[_item_out(i) for i in items],
        items_total=jobs.count_items(job_id, item_status),
    )


@router.post("/import-jobs/{job_id}:retry", response_model=ImportJobOut)
def retry_import(
    job_id: str,
    jobs: ImportJobs,
    launch: JobLaunch,
    background: BackgroundTasks,
    audit: Audit,
    actor: Actor,
) -> ImportJobOut:
    job = import_jobs.retry_job(jobs, job_id)
    audit.record(actor, "import.retried", "import", job.id, job.project_id)
    background.add_task(launch, job.id)
    return _job_out(job)


@router.post("/import-jobs/{job_id}:cancel", response_model=ImportJobOut)
def cancel_import(job_id: str, jobs: ImportJobs, audit: Audit, actor: Actor) -> ImportJobOut:
    job = import_jobs.cancel_job(jobs, job_id)
    audit.record(actor, "import.cancelled", "import", job.id, job.project_id)
    return _job_out(job)
