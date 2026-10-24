from collections.abc import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.domain.entities.project import ProjectSettings
from app.infrastructure.persistence.database import init_db
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository


@pytest.fixture
def repo() -> Iterator[SqlProjectRepository]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    init_db(engine)
    with Session(engine) as session:
        yield SqlProjectRepository(session)


def test_add_and_get_project_roundtrips_settings(repo: SqlProjectRepository) -> None:
    project = repo.add_project("u1", "Pagos")
    repo.update_project(
        project.id, settings=ProjectSettings(disabled_rules=("R-004",), ready_from=90)
    )

    stored = repo.get_project(project.id)

    assert stored is not None
    assert stored.name == "Pagos"
    assert stored.settings.ready_from == 90
    assert stored.settings.disabled_rules == ("R-004",)
    assert stored.is_demo is False


def test_list_projects_includes_demo_and_filters_by_owner(repo: SqlProjectRepository) -> None:
    mine = repo.add_project("u1", "Mío")
    repo.add_project("u2", "Ajeno")
    demo = repo.add_project(None, "Demo", is_demo=True)

    assert {p.id for p in repo.list_projects("u1")} == {mine.id, demo.id}
    assert [p.id for p in repo.list_projects("u1", include_demo=False)] == [mine.id]
    assert [p.id for p in repo.list_projects(None)] == [demo.id]


def test_epics_and_versions_are_scoped_to_project(repo: SqlProjectRepository) -> None:
    a = repo.add_project("u1", "A")
    b = repo.add_project("u1", "B")
    epic_a = repo.add_epic(a.id, "Checkout")
    repo.add_epic(b.id, "Perfil")
    version_a = repo.add_version(a.id, "v1.0")

    assert [e.id for e in repo.list_epics(a.id)] == [epic_a.id]
    assert [v.id for v in repo.list_versions(a.id)] == [version_a.id]
    assert repo.list_versions(b.id) == []


def test_update_project_changes_only_given_fields(repo: SqlProjectRepository) -> None:
    project = repo.add_project("u1", "Pagos", description="d", objective="o")

    updated = repo.update_project(project.id, name="Pagos v2")

    assert updated is not None
    assert (updated.name, updated.description, updated.objective) == ("Pagos v2", "d", "o")
    assert repo.update_project("no-existe", name="x") is None


def test_delete_project_row_removes_epics_and_versions(repo: SqlProjectRepository) -> None:
    project = repo.add_project("u1", "A")
    repo.add_epic(project.id, "E")
    repo.add_version(project.id, "V")

    assert repo.delete_project_row(project.id) is True

    assert repo.get_project(project.id) is None
    assert repo.list_epics(project.id) == []
    assert repo.list_versions(project.id) == []
    assert repo.delete_project_row(project.id) is False


def test_get_demo_project_returns_none_when_missing(repo: SqlProjectRepository) -> None:
    assert repo.get_demo_project() is None
    demo = repo.add_project(None, "Demo", is_demo=True)
    found = repo.get_demo_project()
    assert found is not None and found.id == demo.id
