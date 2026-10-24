from fastapi.testclient import TestClient
from sqlmodel import Session

from app.application.demo import DEMO_STORY_COUNT, seed_demo
from app.config import get_settings
from app.domain.scoring import Verdict, calculate_score
from app.infrastructure.persistence.database import get_engine
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.main import app


def test_seed_creates_demo_with_analyzed_stories(engine) -> None:
    with Session(engine) as db:
        projects, repo = SqlProjectRepository(db), SqlStoryRepository(db)

        demo = seed_demo(projects, repo)

        assert demo.is_demo and demo.owner_id is None
        stories = repo.list_stories(demo.id)
        assert len(stories) == DEMO_STORY_COUNT == 8
        analyses = [repo.latest_analysis(s.id) for s in stories]
        assert all(a is not None for a in analyses)
        verdicts = {calculate_score(a.findings).verdict for a in analyses if a}
        assert Verdict.NOT_READY in verdicts and Verdict.READY in verdicts
        assert {e.name for e in projects.list_epics(demo.id)} == {"Autenticación", "Pagos"}
        assert {v.name for v in projects.list_versions(demo.id)} == {"v2.2", "v2.3"}
        assert any(s.epic_id and s.version_id for s in stories)


def test_seed_is_idempotent(engine) -> None:
    with Session(engine) as db:
        projects, repo = SqlProjectRepository(db), SqlStoryRepository(db)

        first = seed_demo(projects, repo)
        second = seed_demo(projects, repo)

        assert first.id == second.id
        assert [p.id for p in projects.list_projects(None)] == [first.id]
        assert len(repo.list_stories(first.id)) == DEMO_STORY_COUNT


def test_startup_seeds_demo_when_enabled(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    monkeypatch.setenv("SEED_DEMO", "true")
    get_settings.cache_clear()
    get_engine.cache_clear()
    try:
        with TestClient(app) as anonymous:
            projects = anonymous.get("/api/v1/projects").json()
            assert [p["is_demo"] for p in projects] == [True]
            stories = anonymous.get(f"/api/v1/projects/{projects[0]['id']}/stories").json()
            assert len(stories) == DEMO_STORY_COUNT
            assert all(s["latest_analysis"] is not None for s in stories)
    finally:
        get_engine.cache_clear()


def test_startup_does_not_seed_when_disabled(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    monkeypatch.setenv("SEED_DEMO", "false")
    get_settings.cache_clear()
    get_engine.cache_clear()
    try:
        with TestClient(app) as anonymous:
            assert anonymous.get("/api/v1/projects").json() == []
    finally:
        get_engine.cache_clear()
