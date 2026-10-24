from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.infrastructure.persistence.models import (
    AnalysisRow,
    CaseRow,
    EvidenceRow,
    SessionRow,
    StoryRow,
)
from tests.integration.test_qa_sessions_api import PNG, make_session, upload

STORY = {
    "title": "Retirar efectivo",
    "description": "Como cliente quiero retirar efectivo para pagar en tiendas sin tarjeta",
    "acceptance_criteria": ["Dado saldo 500, cuando retiro 100, entonces el saldo es 400"],
}
CSV = (
    "Summary,Issue key,Description,Acceptance Criteria\n"
    'Retirar efectivo,BANK-1,"Como cliente quiero retirar efectivo",'
    '"- Dado saldo 500, entonces ok"\n'
)


def new_project(client: TestClient, name: str) -> str:
    return client.post("/api/v1/projects", json={"name": name}).json()["id"]


def add_story(client: TestClient, project_id: str, **extra) -> dict:
    response = client.post(f"/api/v1/projects/{project_id}/stories", json={**STORY, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_stories_are_listed_per_project(client: TestClient) -> None:
    a, b = new_project(client, "A"), new_project(client, "B")
    story_a = add_story(client, a)
    add_story(client, b)

    listed = client.get(f"/api/v1/projects/{a}/stories").json()

    assert [s["id"] for s in listed] == [story_a["id"]]
    assert listed[0]["project_id"] == a


def test_story_filters_by_epic_and_version(client: TestClient) -> None:
    project = new_project(client, "A")
    epic = client.post(f"/api/v1/projects/{project}/epics", json={"name": "Checkout"}).json()
    version = client.post(f"/api/v1/projects/{project}/versions", json={"name": "v1"}).json()
    tagged = add_story(client, project, epic_id=epic["id"], version_id=version["id"])
    add_story(client, project)

    by_epic = client.get(f"/api/v1/projects/{project}/stories?epic_id={epic['id']}").json()
    by_version = client.get(f"/api/v1/projects/{project}/stories?version_id={version['id']}").json()

    assert [s["id"] for s in by_epic] == [tagged["id"]]
    assert [s["id"] for s in by_version] == [tagged["id"]]
    assert tagged["epic_id"] == epic["id"] and tagged["version_id"] == version["id"]
    assert len(client.get(f"/api/v1/projects/{project}/stories").json()) == 2


def test_epic_from_other_project_is_rejected(client: TestClient) -> None:
    a, b = new_project(client, "A"), new_project(client, "B")
    epic_b = client.post(f"/api/v1/projects/{b}/epics", json={"name": "Perfil"}).json()

    response = client.post(f"/api/v1/projects/{a}/stories", json={**STORY, "epic_id": epic_b["id"]})

    assert response.status_code == 422
    assert client.get(f"/api/v1/projects/{a}/stories").json() == []


def test_import_duplicates_are_detected_only_within_project(client: TestClient) -> None:
    a, b = new_project(client, "A"), new_project(client, "B")
    files = {"file": ("jira.csv", CSV.encode(), "text/csv")}

    def confirm(project: str):
        return client.post(f"/api/v1/projects/{project}/stories/import:confirm", files=files)

    def preview(project: str):
        return client.post(f"/api/v1/projects/{project}/stories/import", files=files)

    assert confirm(a).status_code == 201
    assert preview(a).json()["rows"][0]["duplicate"] is True
    assert preview(b).json()["rows"][0]["duplicate"] is False
    assert confirm(b).status_code == 201
    assert len(client.get(f"/api/v1/projects/{b}/stories").json()) == 1


def test_story_in_unknown_project_returns_404(client: TestClient) -> None:
    assert client.post("/api/v1/projects/no-existe/stories", json=STORY).status_code == 404
    assert client.get("/api/v1/projects/no-existe/stories").status_code == 404
    files = {"file": ("jira.csv", CSV.encode(), "text/csv")}
    assert client.post("/api/v1/projects/no-existe/stories/import", files=files).status_code == 404


def test_delete_project_removes_stories_sessions_and_evidence_files(
    client: TestClient, storage_dir, engine
) -> None:
    """Review Focus 4: borrar un proyecto no deja huérfanos en base de datos ni en disco."""
    execution = make_session(client)["executions"][0]
    assert upload(client, execution["id"], PNG).status_code == 201
    assert any(storage_dir.iterdir())

    assert client.delete(f"/api/v1/projects/{client.project_id}").status_code == 204

    assert client.get(f"/api/v1/projects/{client.project_id}").status_code == 404
    assert not any(storage_dir.iterdir())
    with Session(engine) as db:
        for table in (StoryRow, AnalysisRow, CaseRow, SessionRow, EvidenceRow):
            assert db.exec(select(table)).first() is None, table.__name__
