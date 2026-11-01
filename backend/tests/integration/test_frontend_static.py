import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.infrastructure.persistence.database import get_engine
from app.main import create_app


@pytest.fixture
def site(tmp_path, monkeypatch) -> TestClient:
    static = tmp_path / "dist"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text("<!doctype html><title>StoryLens</title>")
    (static / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "secreto.txt").write_text("no")
    monkeypatch.setenv("STATIC_DIR", str(static))
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    get_settings.cache_clear()
    get_engine.cache_clear()
    yield TestClient(create_app())
    get_engine.cache_clear()


def test_assets_and_spa_routes_are_served_from_the_same_origin(site: TestClient) -> None:
    assert site.get("/assets/app.js").text == "console.log(1)"
    page = site.get("/p/123/stories")  # ruta del router del navegador
    assert page.status_code == 200 and "StoryLens" in page.text
    assert page.headers["x-content-type-options"] == "nosniff"
    assert site.head("/").status_code == 200  # monitores de disponibilidad usan HEAD


def test_unknown_api_paths_stay_404_and_files_outside_dist_are_not_served(
    site: TestClient,
) -> None:
    missing = site.get("/api/v1/no-existe")
    assert missing.status_code == 404
    assert missing.headers["content-type"].startswith("application/problem+json")
    outside = site.get("/..%2Fsecreto.txt")  # fuera de dist: se responde la interfaz, no el archivo
    assert "StoryLens" in outside.text
