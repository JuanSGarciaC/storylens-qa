import uuid
from datetime import UTC, datetime

from sqlmodel import Session, col, delete, or_, select

from app.domain.entities.project import Epic, ProjectSettings, StoredProject, Version
from app.infrastructure.persistence.models import (
    EpicRow,
    ImportItemRow,
    ImportJobRow,
    ProjectRow,
    VersionRow,
)
from app.infrastructure.persistence.settings_codec import settings_from_json, settings_to_json


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    # SQLite no guarda la zona horaria: si vuelve sin ella, siempre fue UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class SqlProjectRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def add_project(
        self,
        owner_id: str | None,
        name: str,
        description: str = "",
        objective: str = "",
        is_demo: bool = False,
    ) -> StoredProject:
        row = ProjectRow(
            id=_new_id(),
            name=name,
            description=description,
            objective=objective,
            settings=settings_to_json(ProjectSettings()),
            is_demo=is_demo,
            owner_id=owner_id,
            created_at=_now(),
        )
        self._session.add(row)
        self._session.commit()
        return self._project(row)

    def get_project(self, project_id: str) -> StoredProject | None:
        row = self._session.get(ProjectRow, project_id)
        return self._project(row) if row else None

    def list_projects(self, owner_id: str | None, include_demo: bool = True) -> list[StoredProject]:
        conditions = []
        if owner_id is not None:
            conditions.append(ProjectRow.owner_id == owner_id)
        if include_demo:
            conditions.append(col(ProjectRow.is_demo).is_(True))
        if not conditions:
            return []
        rows = self._session.exec(
            select(ProjectRow).where(or_(*conditions)).order_by(col(ProjectRow.created_at))
        )
        return [self._project(r) for r in rows]

    def update_project(
        self,
        project_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        objective: str | None = None,
        settings: ProjectSettings | None = None,
    ) -> StoredProject | None:
        row = self._session.get(ProjectRow, project_id)
        if row is None:
            return None
        if name is not None:
            row.name = name
        if description is not None:
            row.description = description
        if objective is not None:
            row.objective = objective
        if settings is not None:
            row.settings = settings_to_json(settings)
        self._session.add(row)
        self._session.commit()
        return self._project(row)

    def delete_project_row(self, project_id: str) -> bool:
        row = self._session.get(ProjectRow, project_id)
        if row is None:
            return False
        job_ids = select(ImportJobRow.id).where(ImportJobRow.project_id == project_id)
        self._session.exec(delete(ImportItemRow).where(col(ImportItemRow.job_id).in_(job_ids)))
        self._session.exec(delete(ImportJobRow).where(ImportJobRow.project_id == project_id))
        self._session.exec(delete(EpicRow).where(EpicRow.project_id == project_id))
        self._session.exec(delete(VersionRow).where(VersionRow.project_id == project_id))
        self._session.delete(row)
        self._session.commit()
        return True

    def get_demo_project(self) -> StoredProject | None:
        row = self._session.exec(
            select(ProjectRow).where(col(ProjectRow.is_demo).is_(True)).limit(1)
        ).first()
        return self._project(row) if row else None

    def add_epic(self, project_id: str, name: str) -> Epic:
        row = EpicRow(id=_new_id(), project_id=project_id, name=name)
        self._session.add(row)
        self._session.commit()
        return Epic(id=row.id, project_id=row.project_id, name=row.name)

    def list_epics(self, project_id: str) -> list[Epic]:
        rows = self._session.exec(
            select(EpicRow).where(EpicRow.project_id == project_id).order_by(col(EpicRow.name))
        )
        return [Epic(id=r.id, project_id=r.project_id, name=r.name) for r in rows]

    def add_version(self, project_id: str, name: str) -> Version:
        row = VersionRow(id=_new_id(), project_id=project_id, name=name)
        self._session.add(row)
        self._session.commit()
        return Version(id=row.id, project_id=row.project_id, name=row.name)

    def list_versions(self, project_id: str) -> list[Version]:
        rows = self._session.exec(
            select(VersionRow)
            .where(VersionRow.project_id == project_id)
            .order_by(col(VersionRow.name))
        )
        return [Version(id=r.id, project_id=r.project_id, name=r.name) for r in rows]

    @staticmethod
    def _project(row: ProjectRow) -> StoredProject:
        return StoredProject(
            id=row.id,
            name=row.name,
            description=row.description,
            objective=row.objective,
            settings=settings_from_json(row.settings),
            is_demo=row.is_demo,
            owner_id=row.owner_id,
            created_at=_aware(row.created_at),
        )
