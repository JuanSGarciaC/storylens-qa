from typing import Protocol

from app.domain.entities.project import Epic, ProjectSettings, StoredProject, Version


class ProjectRepository(Protocol):
    def add_project(
        self,
        owner_id: str | None,
        name: str,
        description: str = "",
        objective: str = "",
        is_demo: bool = False,
    ) -> StoredProject: ...

    def get_project(self, project_id: str) -> StoredProject | None: ...

    def list_projects(self, owner_id: str | None, include_demo: bool = True) -> list[StoredProject]:
        """Proyectos del dueño y, si se pide, el de demostración."""
        ...

    def update_project(
        self,
        project_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        objective: str | None = None,
        settings: ProjectSettings | None = None,
    ) -> StoredProject | None:
        """Cambia solo los campos indicados. None si el proyecto no existe."""
        ...

    def delete_project_row(self, project_id: str) -> bool:
        """Borra el proyecto con sus épicas y versiones (no sus historias). False si no existe."""
        ...

    def get_demo_project(self) -> StoredProject | None: ...

    def add_epic(self, project_id: str, name: str) -> Epic: ...

    def list_epics(self, project_id: str) -> list[Epic]: ...

    def add_version(self, project_id: str, name: str) -> Version: ...

    def list_versions(self, project_id: str) -> list[Version]: ...
