from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.api.job_runner import JobLauncher, launch_in_thread
from app.api.principal import Principal, get_principal
from app.config import get_settings
from app.domain.audit import SYSTEM_ACTOR, AuditLog
from app.domain.ports import ImportJobRepository, LLMPort, ProjectRepository, StoryRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository
from app.infrastructure.llm.factory import build_llm
from app.infrastructure.persistence.database import get_session
from app.infrastructure.persistence.sql_audit import SqlAuditLog
from app.infrastructure.persistence.sql_import_job_repository import SqlImportJobRepository
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.infrastructure.persistence.sql_resolver import SqlProjectResolver
from app.infrastructure.persistence.sql_session_repository import SqlSessionRepository
from app.infrastructure.storage.local import LocalEvidenceStorage


def get_repository(session: Annotated[Session, Depends(get_session)]) -> StoryRepository:
    return SqlStoryRepository(session)


def get_project_repository(session: Annotated[Session, Depends(get_session)]) -> ProjectRepository:
    return SqlProjectRepository(session)


def get_audit_log(session: Annotated[Session, Depends(get_session)]) -> AuditLog:
    return SqlAuditLog(session)


def get_actor(principal: Annotated[Principal, Depends(get_principal)]) -> str:
    return principal.email or SYSTEM_ACTOR


def get_session_repository(session: Annotated[Session, Depends(get_session)]) -> SessionRepository:
    return SqlSessionRepository(session)


def get_import_jobs(session: Annotated[Session, Depends(get_session)]) -> ImportJobRepository:
    return SqlImportJobRepository(session)


def get_job_launcher() -> JobLauncher:
    return launch_in_thread


def get_storage() -> EvidenceStorage:
    return LocalEvidenceStorage(get_settings().evidence_dir)


def get_resolver(session: Annotated[Session, Depends(get_session)]) -> SqlProjectResolver:
    return SqlProjectResolver(session)


def get_llm(principal: Annotated[Principal, Depends(get_principal)]) -> LLMPort | None:
    """Solo el dueño puede usar IA: para el resto siempre hay motor determinístico."""
    return build_llm() if principal.is_owner else None


Repository = Annotated[StoryRepository, Depends(get_repository)]
Resolver = Annotated[SqlProjectResolver, Depends(get_resolver)]
Audit = Annotated[AuditLog, Depends(get_audit_log)]
Actor = Annotated[str, Depends(get_actor)]
Projects = Annotated[ProjectRepository, Depends(get_project_repository)]
LLM = Annotated[LLMPort | None, Depends(get_llm)]
Sessions = Annotated[SessionRepository, Depends(get_session_repository)]
Storage = Annotated[EvidenceStorage, Depends(get_storage)]
ImportJobs = Annotated[ImportJobRepository, Depends(get_import_jobs)]
JobLaunch = Annotated[JobLauncher, Depends(get_job_launcher)]
