import logging

from app.application.errors import NotFoundError
from app.application.qa_sessions import ConflictError
from app.application.stories import run_analysis
from app.domain.entities import Story
from app.domain.entities.import_job import (
    ImportJob,
    ItemStatus,
    JobStatus,
    NewImportItem,
)
from app.domain.ports import ImportJobRepository, LLMPort, ProjectRepository, StoryRepository
from app.domain.story_import import ImportFormatError, ImportRow

logger = logging.getLogger(__name__)

MAX_JOB_ROWS = 500
DUPLICATE_MESSAGE = "Ya existía una historia igual en el proyecto"


def _signature(title: str, description: str) -> tuple[str, str]:
    return title.strip().casefold(), description.strip().casefold()


def start_job(
    jobs: ImportJobRepository,
    project_id: str,
    filename: str,
    rows: list[ImportRow],
    use_ai: bool,
    actor: str,
) -> ImportJob:
    """Registra el trabajo con sus filas pendientes. No procesa nada: eso lo hace `run_job`."""
    if not rows:
        raise ImportFormatError("No hay historias válidas para importar con esa selección")
    if len(rows) > MAX_JOB_ROWS:
        raise ImportFormatError(f"Una importación admite hasta {MAX_JOB_ROWS} historias")
    items = [
        NewImportItem(r.index, r.key, r.title, r.description, tuple(r.acceptance_criteria))
        for r in rows
    ]
    return jobs.create_job(project_id, filename, use_ai, actor, items)


def get_job(jobs: ImportJobRepository, job_id: str) -> ImportJob:
    job = jobs.get_job(job_id)
    if job is None:
        raise NotFoundError(f"Importación {job_id} no encontrada")
    return job


def retry_job(jobs: ImportJobRepository, job_id: str) -> ImportJob:
    """Vuelve a poner en cola lo que falló o quedó pendiente. Las filas hechas no se repiten."""
    job = get_job(jobs, job_id)
    if job.status.active:
        raise ConflictError("La importación sigue en curso")
    jobs.reset_failed_items(job_id)
    refreshed = get_job(jobs, job_id)
    if refreshed.pending == 0:
        raise ConflictError("No hay filas pendientes ni fallidas que reintentar")
    jobs.set_status(job_id, JobStatus.QUEUED)
    return get_job(jobs, job_id)


def cancel_job(jobs: ImportJobRepository, job_id: str) -> ImportJob:
    job = get_job(jobs, job_id)
    if not job.status.active:
        raise ConflictError("La importación ya terminó")
    jobs.set_status(job_id, JobStatus.CANCELLED, "Cancelada por el usuario")
    return get_job(jobs, job_id)


def run_job(
    jobs: ImportJobRepository,
    stories: StoryRepository,
    projects: ProjectRepository,
    llm: LLMPort | None,
    job_id: str,
) -> None:
    """Procesa las filas pendientes una a una, guardando el avance después de cada una.

    Es seguro repetirlo: una fila con historia ya creada solo se analiza, y una fila cuya
    historia ya existe en el proyecto se marca como duplicada en vez de crearse otra vez.
    """
    job = jobs.get_job(job_id)
    if job is None or job.status != JobStatus.QUEUED:
        return
    jobs.set_status(job_id, JobStatus.RUNNING)
    project = projects.get_project(job.project_id)
    settings = project.settings if project is not None else None
    known = {
        _signature(s.story.title, s.story.description) for s in stories.list_stories(job.project_id)
    }

    for item in jobs.list_items(job_id, ItemStatus.PENDING):
        current = jobs.get_job(job_id)
        if current is None or current.status != JobStatus.RUNNING:
            return  # cancelada (o interrumpida) mientras se procesaba
        story_id = item.story_id
        try:
            if story_id is None:
                signature = _signature(item.title, item.description)
                if signature in known:
                    jobs.update_item(item.id, ItemStatus.SKIPPED, error=DUPLICATE_MESSAGE)
                    continue
                notes = f"Importada de Jira: {item.key}" if item.key else ""
                story = Story(
                    title=item.title,
                    description=item.description,
                    acceptance_criteria=item.acceptance_criteria,
                    notes=notes,
                )
                story_id = stories.add_story(job.project_id, story).id
                known.add(signature)
            analysis = run_analysis(
                stories,
                story_id,
                llm=llm,
                use_ai=job.use_ai and llm is not None,
                settings=settings,
            )
            jobs.update_item(
                item.id, ItemStatus.DONE, story_id=story_id, ai_status=str(analysis.ai_status)
            )
        except Exception:
            logger.exception("Falló la fila %s de la importación %s", item.row_index, job_id)
            jobs.update_item(
                item.id,
                ItemStatus.FAILED,
                story_id=story_id,
                error="No se pudo importar esta fila. Puedes reintentarla.",
            )

    final = jobs.get_job(job_id)
    if final is None or final.status != JobStatus.RUNNING:
        return
    if final.failed == 0:
        jobs.set_status(job_id, JobStatus.SUCCEEDED)
    elif final.done + final.skipped == 0:
        jobs.set_status(job_id, JobStatus.FAILED)
    else:
        jobs.set_status(job_id, JobStatus.PARTIAL)
