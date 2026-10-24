from fastapi.testclient import TestClient

STORY = {
    "title": "Retirar efectivo",
    "description": "Como cliente quiero retirar efectivo para pagar en tiendas sin tarjeta",
    "acceptance_criteria": [],
}
CSV = (
    "Summary,Issue key,Description,Acceptance Criteria\n"
    'Retirar efectivo,BANK-1,"Como cliente quiero retirar efectivo",'
    '"- Dado saldo 500, entonces ok"\n'
)


def audit(client: TestClient, project_id: str, query: str = "") -> list[dict]:
    response = client.get(f"/api/v1/projects/{project_id}/audit{query}")
    assert response.status_code == 200, response.text
    return response.json()


def add_story(client: TestClient, project_id: str) -> str:
    return client.post(f"/api/v1/projects/{project_id}/stories", json=STORY).json()["id"]


def test_creating_project_and_story_records_events(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"name": "Pagos"}).json()["id"]
    story_id = add_story(client, project)

    events = audit(client, project)

    assert [e["action"] for e in events] == ["story.created", "project.created"]
    assert events[0]["entity"] == "story" and events[0]["entity_id"] == story_id
    assert events[1]["entity_id"] == project
    assert all(e["project_id"] == project and e["actor"] == "owner@test.local" for e in events)


def test_audit_pagination_returns_newest_first(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"name": "Pagos"}).json()["id"]
    first, second = add_story(client, project), add_story(client, project)

    page = audit(client, project, "?limit=2&offset=1")

    assert [e["entity_id"] for e in page] == [first, project]
    assert audit(client, project, "?limit=1")[0]["entity_id"] == second


def test_audit_is_scoped_to_project(client: TestClient) -> None:
    a = client.post("/api/v1/projects", json={"name": "A"}).json()["id"]
    b = client.post("/api/v1/projects", json={"name": "B"}).json()["id"]
    add_story(client, a)

    assert [e["action"] for e in audit(client, b)] == ["project.created"]


def test_audit_of_unknown_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/projects/no-existe/audit").status_code == 404


def test_limit_is_capped_and_validated(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"name": "A"}).json()["id"]

    assert client.get(f"/api/v1/projects/{project}/audit?limit=201").status_code == 422
    assert client.get(f"/api/v1/projects/{project}/audit?offset=-1").status_code == 422


def test_analysis_decision_import_and_delete_are_recorded(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"name": "Pagos"}).json()["id"]
    story_id = add_story(client, project)
    analysis = client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": False}).json()
    finding = analysis["findings"][0]
    client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"decision": "dismissed", "dismiss_reason": "No aplica"},
    )
    client.post(
        f"/api/v1/projects/{project}/stories/import:confirm",
        files={"file": ("jira.csv", CSV.encode(), "text/csv")},
    )
    client.delete(f"/api/v1/stories/{story_id}")

    actions = [e["action"] for e in audit(client, project)]

    assert actions == [
        "story.deleted",
        "story.imported",
        "finding.decided",
        "analysis.run",
        "story.created",
        "project.created",
    ]


def test_update_and_delete_project_are_recorded(client: TestClient) -> None:
    project = client.post("/api/v1/projects", json={"name": "Pagos"}).json()["id"]
    client.patch(f"/api/v1/projects/{project}", json={"name": "Pagos v2"})
    other = client.post("/api/v1/projects", json={"name": "Otro"}).json()["id"]
    client.patch(f"/api/v1/projects/{other}", json={"settings": {"ready_from": 90}})

    assert [e["action"] for e in audit(client, project)] == ["project.updated", "project.created"]
    assert audit(client, other)[0]["action"] == "settings.changed"
    client.delete(f"/api/v1/projects/{other}")
    # Tras borrar el proyecto su historial deja de ser consultable (la ruta da 404).
    assert client.get(f"/api/v1/projects/{other}/audit").status_code == 404


def test_closing_a_session_is_recorded(client: TestClient) -> None:
    from tests.integration.test_qa_sessions_api import make_session, run

    session = make_session(client)
    for execution in session["executions"]:
        run(client, execution["id"], result="passed")

    response = client.post(
        f"/api/v1/qa-sessions/{session['id']}:close",
        json={"recommendation": "accept", "summary": "Todo en orden"},
    )

    assert response.status_code == 200, response.text
    assert audit(client, client.project_id)[0]["action"] == "session.closed"
