import logging
import threading
from collections.abc import Callable

from sqlmodel import Session

from app.application.evaluations import execute_run
from app.application.import_jobs import run_job
from app.infrastructure.evaluation.golden import load_golden
from app.infrastructure.llm.factory import build_llm
from app.infrastructure.persistence.database import get_engine
from app.infrastructure.persistence.sql_evaluation_repository import SqlEvaluationRepository
from app.infrastructure.persistence.sql_import_job_repository import SqlImportJobRepository
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository

logger = logging.getLogger(__name__)

JobLauncher = Callable[[str], None]

_running: set[str] = set()
_lock = threading.Lock()


def run_now(job_id: str) -> None:
    """Procesa el trabajo con su propia sesión de base de datos."""
    with _lock:
        if job_id in _running:
            return
        _running.add(job_id)
    try:
        with Session(get_engine()) as session:
            run_job(
                SqlImportJobRepository(session),
                SqlStoryRepository(session),
                SqlProjectRepository(session),
                build_llm(),
                job_id,
            )
    except Exception:
        logger.exception("La importación %s terminó con un error inesperado", job_id)
    finally:
        with _lock:
            _running.discard(job_id)


def launch_in_thread(job_id: str) -> None:
    """Un hilo por trabajo, sin cola externa: el estado vive en la base de datos."""
    threading.Thread(target=run_now, args=(job_id,), name=f"import-{job_id}", daemon=True).start()


def run_evaluation_now(run_id: str) -> None:
    key = f"eval-{run_id}"
    with _lock:
        if key in _running:
            return
        _running.add(key)
    try:
        with Session(get_engine()) as session:
            execute_run(SqlEvaluationRepository(session), load_golden(), build_llm(), run_id)
    except Exception:
        logger.exception("La evaluación %s terminó con un error inesperado", run_id)
    finally:
        with _lock:
            _running.discard(key)


def launch_evaluation_in_thread(run_id: str) -> None:
    threading.Thread(
        target=run_evaluation_now, args=(run_id,), name=f"eval-{run_id}", daemon=True
    ).start()
