import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.deps import get_llm
from app.api.principal import Principal
from app.domain.entities import AIStatus, Story
from app.infrastructure.persistence.sql_project_repository import SqlProjectRepository
from app.infrastructure.persistence.sql_repository import SqlStoryRepository
from app.main import app

STORY = Story(
    title="Retirar efectivo",
    description="Como cliente quiero retirar efectivo para pagar en tiendas sin tarjeta",
    acceptance_criteria=("Dado saldo 500, cuando retiro 100, entonces el saldo es 400",),
)


@pytest.fixture
def demo(engine) -> dict[str, str]:
    """Proyecto de demostración con una historia analizada, sembrado directamente en la base."""
    with Session(engine) as db:
        project = SqlProjectRepository(db).add_project(None, "Demo", is_demo=True)
        repo = SqlStoryRepository(db)
        story = repo.add_story(project.id, STORY)
        analysis = repo.add_analysis(story.id, [], AIStatus.NOT_REQUESTED, "test")
    return {"project": project.id, "story": story.id, "analysis": analysis.id}


@pytest.fixture
def private(client: TestClient) -> dict[str, str]:
    """Historia y análisis del proyecto privado del dueño."""
    story = client.post(
        f"/api/v1/projects/{client.project_id}/stories",
        json={"title": STORY.title, "description": STORY.description},
    ).json()
    analysis = client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    return {"project": client.project_id, "story": story["id"], "analysis": analysis.json()["id"]}


def test_anonymous_can_read_demo_but_not_private_project(
    client: TestClient, anon_client: TestClient, demo, private
) -> None:
    assert anon_client.get(f"/api/v1/projects/{demo['project']}/stories").status_code == 200
    assert anon_client.get(f"/api/v1/projects/{demo['project']}").status_code == 200
    assert anon_client.get(f"/api/v1/projects/{private['project']}/stories").status_code == 404
    assert anon_client.get(f"/api/v1/projects/{private['project']}").status_code == 404
    assert anon_client.get(f"/api/v1/projects/{private['project']}/audit").status_code == 404

    assert [p["id"] for p in anon_client.get("/api/v1/projects").json()] == [demo["project"]]
    owner_ids = {p["id"] for p in client.get("/api/v1/projects").json()}
    assert owner_ids == {demo["project"], private["project"]}


WRITES = [
    ("post", "/api/v1/projects", {"json": {"name": "X"}}),
    ("patch", "/api/v1/projects/{project}", {"json": {"name": "X"}}),
    ("delete", "/api/v1/projects/{project}", {}),
    ("post", "/api/v1/projects/{project}/epics", {"json": {"name": "E"}}),
    ("post", "/api/v1/projects/{project}/stories", {"json": {"title": "t", "description": "d"}}),
    (
        "post",
        "/api/v1/projects/{project}/stories/import:confirm",
        {"files": {"file": ("a.csv", b"Summary,Description\nA,B\n", "text/csv")}},
    ),
    ("delete", "/api/v1/stories/{story}", {}),
    ("post", "/api/v1/stories/{story}/analyses", {"json": {"use_ai": False}}),
    ("patch", "/api/v1/findings/no-existe", {"json": {"decision": "accepted"}}),
    ("post", "/api/v1/stories/{story}/test-cases:generate", {}),
    ("post", "/api/v1/stories/{story}/gherkin:suggest", {}),
    ("patch", "/api/v1/test-cases/no-existe", {"json": {"status": "accepted"}}),
    ("post", "/api/v1/stories/{story}/qa-sessions", {"json": {}}),
    ("post", "/api/v1/qa-sessions/no-existe:close", {"json": {"recommendation": "accept"}}),
    ("patch", "/api/v1/checklist-items/no-existe", {"json": {"checked": True}}),
    ("patch", "/api/v1/executions/no-existe", {"json": {"result": "passed"}}),
    ("post", "/api/v1/executions/no-existe/evidences", {"json": {}}),
    ("patch", "/api/v1/defect-drafts/no-existe", {"json": {}}),
]


@pytest.mark.parametrize(("method", "url", "kwargs"), WRITES)
def test_anonymous_cannot_write_anywhere(
    anon_client: TestClient, demo, private, method, url, kwargs
) -> None:
    for target in (demo, private):
        response = getattr(anon_client, method)(url.format(**target), **kwargs)
        assert response.status_code == 401, (url, response.text)


def test_owner_cannot_write_demo_project(client: TestClient, demo) -> None:
    """Review Focus 7: el proyecto demo es de solo lectura incluso para el dueño."""
    checks = [
        client.patch(f"/api/v1/projects/{demo['project']}", json={"name": "X"}),
        client.delete(f"/api/v1/projects/{demo['project']}"),
        client.post(f"/api/v1/projects/{demo['project']}/epics", json={"name": "E"}),
        client.post(
            f"/api/v1/projects/{demo['project']}/stories", json={"title": "t", "description": "d"}
        ),
        client.post(f"/api/v1/stories/{demo['story']}/analyses", json={"use_ai": False}),
        client.delete(f"/api/v1/stories/{demo['story']}"),
    ]
    assert [c.status_code for c in checks] == [403] * len(checks)
    assert "solo lectura" in checks[0].json()["detail"]
    assert client.get(f"/api/v1/projects/{demo['project']}").json()["name"] == "Demo"


def test_item_routes_hide_other_projects_from_anonymous(
    anon_client: TestClient, demo, private
) -> None:
    assert anon_client.get(f"/api/v1/stories/{demo['story']}").status_code == 200
    assert anon_client.get(f"/api/v1/analyses/{demo['analysis']}").status_code == 200
    assert anon_client.get(f"/api/v1/stories/{demo['story']}/test-cases").status_code == 200

    assert anon_client.get(f"/api/v1/stories/{private['story']}").status_code == 404
    assert anon_client.get(f"/api/v1/analyses/{private['analysis']}").status_code == 404
    assert anon_client.get(f"/api/v1/analyses/{private['analysis']}/report").status_code == 404
    assert anon_client.get(f"/api/v1/stories/{private['story']}/test-cases").status_code == 404
    assert anon_client.get(f"/api/v1/stories/{private['story']}/qa-sessions").status_code == 404
    assert anon_client.get("/api/v1/stories/no-existe").status_code == 404


def test_other_owners_project_is_hidden_even_from_the_owner(client: TestClient, engine) -> None:
    with Session(engine) as db:
        foreign = SqlProjectRepository(db).add_project("otra-persona", "Ajeno").id

    assert client.get(f"/api/v1/projects/{foreign}").status_code == 404
    assert client.patch(f"/api/v1/projects/{foreign}", json={"name": "x"}).status_code == 404
    assert foreign not in {p["id"] for p in client.get("/api/v1/projects").json()}


def test_anonymous_never_reaches_ai_endpoints(anon_client: TestClient, demo) -> None:
    class Boom:
        def __getattr__(self, name):
            raise AssertionError(f"La IA no debía usarse: {name}")

    app.dependency_overrides[get_llm] = lambda: Boom()

    for url in (
        f"/api/v1/stories/{demo['story']}/analyses",
        f"/api/v1/stories/{demo['story']}/test-cases:generate",
        f"/api/v1/stories/{demo['story']}/gherkin:suggest",
    ):
        assert anon_client.post(url).status_code == 401, url


def test_get_llm_is_disabled_for_non_owners(monkeypatch) -> None:
    sentinel = object()
    monkeypatch.setattr("app.api.deps.build_llm", lambda: sentinel)

    assert get_llm(Principal()) is None
    assert get_llm(Principal("u1", "a@b.c")) is sentinel


def test_public_routes_stay_open(anon_client: TestClient) -> None:
    assert anon_client.get("/api/v1/health").status_code == 200
    assert anon_client.get("/api/v1/rules").status_code == 200
    story = {"title": "t", "description": "Como usuario quiero algo para lograr un fin"}
    assert anon_client.post("/api/v1/analyze", json=story).status_code == 200
