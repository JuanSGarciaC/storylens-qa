from fastapi import APIRouter, Response, status

from app.api.deps import Projects
from app.api.schemas.project import (
    NamedIn,
    NamedOut,
    ProjectIn,
    ProjectOut,
    ProjectPatch,
    ProjectSettingsIO,
)
from app.application import projects as uc
from app.domain.entities import Epic, ProjectSettings, StoredProject, Version

router = APIRouter(tags=["projects"])

# Provisional: la cuenta de dueño llega con la sesión (Tarea 5); hasta entonces todo es del "dueño".
OWNER_PLACEHOLDER = "owner"


def _project_out(project: StoredProject) -> ProjectOut:
    s = project.settings
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        objective=project.objective,
        settings=ProjectSettingsIO(
            disabled_rules=list(s.disabled_rules),
            penalties=s.penalties,
            not_ready_below=s.not_ready_below,
            ready_from=s.ready_from,
        ),
        is_demo=project.is_demo,
        created_at=project.created_at,
    )


def _named_out(item: Epic | Version) -> NamedOut:
    return NamedOut(id=item.id, project_id=item.project_id, name=item.name)


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectIn, projects: Projects) -> ProjectOut:
    project = uc.create_project(
        projects, OWNER_PLACEHOLDER, payload.name, payload.description, payload.objective
    )
    return _project_out(project)


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(projects: Projects) -> list[ProjectOut]:
    return [_project_out(p) for p in projects.list_projects(OWNER_PLACEHOLDER)]


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, projects: Projects) -> ProjectOut:
    return _project_out(uc.require_project(projects, project_id))


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(project_id: str, payload: ProjectPatch, projects: Projects) -> ProjectOut:
    settings = None
    if payload.settings is not None:
        s = payload.settings
        settings = ProjectSettings(
            disabled_rules=tuple(s.disabled_rules),
            penalties=s.penalties,
            not_ready_below=s.not_ready_below,
            ready_from=s.ready_from,
        )
    project = uc.update_project(
        projects,
        project_id,
        name=payload.name,
        description=payload.description,
        objective=payload.objective,
        settings=settings,
    )
    return _project_out(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, projects: Projects) -> Response:
    uc.delete_project(projects, project_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/projects/{project_id}/epics", response_model=NamedOut, status_code=status.HTTP_201_CREATED
)
def create_epic(project_id: str, payload: NamedIn, projects: Projects) -> NamedOut:
    return _named_out(uc.add_epic(projects, project_id, payload.name))


@router.get("/projects/{project_id}/epics", response_model=list[NamedOut])
def list_epics(project_id: str, projects: Projects) -> list[NamedOut]:
    uc.require_project(projects, project_id)
    return [_named_out(e) for e in projects.list_epics(project_id)]


@router.post(
    "/projects/{project_id}/versions", response_model=NamedOut, status_code=status.HTTP_201_CREATED
)
def create_version(project_id: str, payload: NamedIn, projects: Projects) -> NamedOut:
    return _named_out(uc.add_version(projects, project_id, payload.name))


@router.get("/projects/{project_id}/versions", response_model=list[NamedOut])
def list_versions(project_id: str, projects: Projects) -> list[NamedOut]:
    uc.require_project(projects, project_id)
    return [_named_out(v) for v in projects.list_versions(project_id)]
