from collections.abc import Iterator

import pytest
from sqlalchemy import Engine
from sqlmodel import Session

from app.api.deps import get_job_launcher, get_llm
from app.application.import_jobs import run_job
from app.domain.entities.import_job import JobStatus
from app.domain.ports import LLMUnavailableError
from app.infrastructure.persistence.sql_import_job_repository import SqlImportJobRepository
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.main import app


def make_csv(count: int, prefix: str = "Historia") -> str:
    lines = ["Summary,Issue key,Description"]
    for n in range(1, count + 1):
        lines.append(f"{prefix} {n},K-{n},Como usuario {n} quiero una función clara")
    return "\n".join(lines) + "\n"


@pytest.fixture
def launched(client, engine: Engine) -> Iterator[list[str]]:
    """Ejecuta el trabajo en el mismo hilo para que las pruebas sean deterministas."""
    ids: list[str] = []

    def launch(job_id: str) -> None:
        ids.append(job_id)
        with Session(engine) as session:
            run_job(
                SqlImportJobRepository(session),
                SqlStoryRepository(session),
                SqlProjectRepository(session),
                None,
                job_id,
            )

    app.dependency_overrides[get_job_launcher] = lambda: launch
    yield ids


def start(client, content: str, **data):
    return client.post(
        f"/api/v1/projects/{client.project_id}/import-jobs",
        files={"file": ("jira.csv", content.encode(), "text/csv")},
        data=data,
    )


def job(client, job_id: str, **params):
    response = client.get(f"/api/v1/import-jobs/{job_id}", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def story_count(client) -> int:
    return len(client.get(f"/api/v1/projects/{client.project_id}/stories").json())


def test_job_creates_and_analyzes_every_row(client, launched):
    response = start(client, make_csv(3))
    assert response.status_code == 202
    detail = job(client, response.json()["id"])
    assert detail["status"] == "succeeded"
    assert (detail["total"], detail["done"], detail["failed"], detail["pending"]) == (3, 3, 0, 0)
    assert story_count(client) == 3
    stories = client.get(f"/api/v1/projects/{client.project_id}/stories").json()
    assert all(s["latest_analysis"] is not None for s in stories)
    assert all(i["ai_status"] == "not_requested" for i in detail["items"])


def test_progress_is_paginated_and_filterable(client, launched):
    detail = job(client, start(client, make_csv(5)).json()["id"], limit=2, offset=2)
    assert [i["row_index"] for i in detail["items"]] == [3, 4]
    assert detail["items_total"] == 5
    only_failed = job(client, detail["id"], status="failed")
    assert only_failed["items"] == [] and only_failed["items_total"] == 0


def test_rows_that_already_exist_are_skipped_not_duplicated(client, launched):
    start(client, make_csv(2))
    second = job(client, start(client, make_csv(3)).json()["id"])
    # El segundo archivo repite 2 historias que la vista previa ya marca como duplicadas.
    assert second["total"] == 1 and second["done"] == 1
    assert story_count(client) == 3


def test_failed_row_is_retried_without_duplicating_others(client, launched, monkeypatch):
    from app.application import import_jobs

    real = import_jobs.run_analysis
    boom = {"on": True}

    def flaky(stories, story_id, **kwargs):
        if boom["on"] and stories.get_story(story_id).story.title == "Historia 2":
            raise RuntimeError("fallo simulado")
        return real(stories, story_id, **kwargs)

    monkeypatch.setattr(import_jobs, "run_analysis", flaky)
    created = start(client, make_csv(3)).json()
    detail = job(client, created["id"])
    assert detail["status"] == "partial"
    assert (detail["done"], detail["failed"]) == (2, 1)
    failed = job(client, created["id"], status="failed")["items"][0]
    assert failed["row_index"] == 2 and "reintentarla" in failed["error"]
    assert "fallo simulado" not in failed["error"]  # nunca se filtran detalles internos

    boom["on"] = False
    retried = client.post(f"/api/v1/import-jobs/{created['id']}:retry")
    assert retried.status_code == 200
    final = job(client, created["id"])
    assert final["status"] == "succeeded" and final["done"] == 3
    assert story_count(client) == 3  # la historia de la fila 2 no se duplicó


def test_interrupted_job_can_be_retried(client, launched, engine):
    created = start(client, make_csv(2)).json()["id"]
    # Simula un reinicio: el trabajo quedó activo y sin terminar.
    with Session(engine) as session:
        repo = SqlImportJobRepository(session)
        repo.reset_failed_items(created)
        repo.set_status(created, JobStatus.RUNNING)
        assert repo.mark_interrupted() == 1
    assert job(client, created)["status"] == "interrupted"
    # No hay filas pendientes (ya estaban hechas): no se reintenta nada.
    assert client.post(f"/api/v1/import-jobs/{created}:retry").status_code == 409


def test_retry_and_cancel_are_refused_in_the_wrong_state(client, launched):
    created = start(client, make_csv(1)).json()["id"]
    assert client.post(f"/api/v1/import-jobs/{created}:cancel").status_code == 409
    assert client.post(f"/api/v1/import-jobs/{created}:retry").status_code == 409


def test_more_than_500_rows_is_rejected(client, launched):
    response = start(client, make_csv(501))
    assert response.status_code == 422
    assert "500" in response.json()["detail"]
    assert story_count(client) == 0


def test_selection_and_empty_selection(client, launched):
    created = start(client, make_csv(3), selected="[1, 3]").json()
    assert created["total"] == 2
    assert start(client, make_csv(3), selected="[]").status_code == 422


def test_ai_unavailable_degrades_to_rules(client, engine, launched):
    class NoQuota:
        def analyze_story(self, story, rules):
            raise LLMUnavailableError("cuota agotada")

    app.dependency_overrides[get_llm] = lambda: NoQuota()

    def launch(job_id: str) -> None:
        with Session(engine) as session:
            run_job(
                SqlImportJobRepository(session),
                SqlStoryRepository(session),
                SqlProjectRepository(session),
                NoQuota(),  # type: ignore[arg-type]
                job_id,
            )

    app.dependency_overrides[get_job_launcher] = lambda: launch
    detail = job(client, start(client, make_csv(2), use_ai="true").json()["id"])
    assert detail["status"] == "succeeded"  # la IA falló, el trabajo no
    assert [i["ai_status"] for i in detail["items"]] == ["unavailable", "unavailable"]
    stories = client.get(f"/api/v1/projects/{client.project_id}/stories").json()
    assert all(s["latest_analysis"] is not None for s in stories)


def test_access_rules(client, anon_client, launched):
    created = start(client, make_csv(1)).json()["id"]
    assert anon_client.get(f"/api/v1/import-jobs/{created}").status_code == 404
    assert anon_client.post(f"/api/v1/import-jobs/{created}:cancel").status_code == 401
    anonymous_start = anon_client.post(
        f"/api/v1/projects/{client.project_id}/import-jobs",
        files={"file": ("a.csv", make_csv(1).encode(), "text/csv")},
    )
    assert anonymous_start.status_code == 401
    assert client.get("/api/v1/import-jobs/no-existe").status_code == 404


def test_deleting_project_removes_its_jobs(client, launched):
    created = start(client, make_csv(2)).json()["id"]
    assert client.delete(f"/api/v1/projects/{client.project_id}").status_code == 204
    assert client.get(f"/api/v1/import-jobs/{created}").status_code == 404
