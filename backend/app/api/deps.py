from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.config import get_settings
from app.domain.ports import LLMPort, ProjectRepository, StoryRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository
from app.infrastructure.llm.factory import build_llm
from app.infrastructure.persistence.database import get_session
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.infrastructure.persistence.sql_session_repository import SqlSessionRepository
from app.infrastructure.storage.local import LocalEvidenceStorage


def get_repository(session: Annotated[Session, Depends(get_session)]) -> StoryRepository:
    return SqlStoryRepository(session)


def get_project_repository(session: Annotated[Session, Depends(get_session)]) -> ProjectRepository:
    return SqlProjectRepository(session)


def get_session_repository(session: Annotated[Session, Depends(get_session)]) -> SessionRepository:
    return SqlSessionRepository(session)


def get_storage() -> EvidenceStorage:
    return LocalEvidenceStorage(get_settings().evidence_dir)


def get_llm() -> LLMPort | None:
    return build_llm()


Repository = Annotated[StoryRepository, Depends(get_repository)]
Projects = Annotated[ProjectRepository, Depends(get_project_repository)]
LLM = Annotated[LLMPort | None, Depends(get_llm)]
Sessions = Annotated[SessionRepository, Depends(get_session_repository)]
Storage = Annotated[EvidenceStorage, Depends(get_storage)]
