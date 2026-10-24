from app.application.errors import NotFoundError
from app.domain.entities import Epic, ProjectSettings, StoredProject, Version
from app.domain.ports import StoryRepository
from app.domain.ports.projects import ProjectRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository

MAX_NAME_CHARS = 120


class InvalidProjectError(Exception):
    pass


def _clean_name(name: str) -> str:
    cleaned = name.strip()
    if not cleaned or len(cleaned) > MAX_NAME_CHARS:
        raise InvalidProjectError(f"El nombre debe tener entre 1 y {MAX_NAME_CHARS} caracteres")
    return cleaned


def require_project(repo: ProjectRepository, project_id: str) -> StoredProject:
    project = repo.get_project(project_id)
    if project is None:
        raise NotFoundError(f"Proyecto {project_id} no encontrado")
    return project


def create_project(
    repo: ProjectRepository, owner_id: str | None, name: str, description: str, objective: str
) -> StoredProject:
    return repo.add_project(owner_id, _clean_name(name), description.strip(), objective.strip())


def update_project(
    repo: ProjectRepository,
    project_id: str,
    *,
    name: str | None = None,
    description: str | None = None,
    objective: str | None = None,
    settings: ProjectSettings | None = None,
) -> StoredProject:
    require_project(repo, project_id)
    updated = repo.update_project(
        project_id,
        name=_clean_name(name) if name is not None else None,
        description=description.strip() if description is not None else None,
        objective=objective.strip() if objective is not None else None,
        settings=settings,
    )
    if updated is None:  # no debería ocurrir: el proyecto existe
        raise NotFoundError(f"Proyecto {project_id} no encontrado")
    return updated


def delete_project(
    projects: ProjectRepository,
    repo: StoryRepository,
    sessions: SessionRepository,
    storage: EvidenceStorage,
    project_id: str,
) -> None:
    """Borra el proyecto con sus historias, sesiones y los archivos de evidencia."""
    from app.application.stories import delete_story  # evita el import circular

    require_project(projects, project_id)
    for story_id in repo.list_story_ids(project_id):
        delete_story(repo, sessions, storage, story_id)
    projects.delete_project_row(project_id)


def add_epic(repo: ProjectRepository, project_id: str, name: str) -> Epic:
    require_project(repo, project_id)
    return repo.add_epic(project_id, _clean_name(name))


def add_version(repo: ProjectRepository, project_id: str, name: str) -> Version:
    require_project(repo, project_id)
    return repo.add_version(project_id, _clean_name(name))
