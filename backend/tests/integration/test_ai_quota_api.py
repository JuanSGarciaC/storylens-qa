from fastapi.testclient import TestClient

from app.api.deps import get_llm
from app.infrastructure.llm.gemini import GeminiAdapter
from app.main import app
from tests.unit.test_gemini_adapter import FakeClient, ok_response

STORY = {
    "title": "Recuperar contraseña",
    "description": "Como usuario registrado quiero restablecer mi contraseña para entrar",
    "acceptance_criteria": [],
}


class AllowFirst:
    """Cuota que concede solo las primeras `allowed` llamadas."""

    def __init__(self, allowed: int) -> None:
        self.allowed = allowed

    def try_acquire(self, key: str) -> bool:
        self.allowed -= 1
        return self.allowed >= 0


def use_adapter(quota, *responses) -> FakeClient:
    client = FakeClient(*responses)
    adapter = GeminiAdapter(client, model="primary", quota=quota)
    app.dependency_overrides[get_llm] = lambda: adapter
    return client


def analyze(client: TestClient, story_id: str):
    return client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": True})


def test_exhausted_quota_degrades_to_rules(client: TestClient) -> None:
    ai = use_adapter(AllowFirst(0), ok_response())
    story = client.post(f"/api/v1/projects/{client.project_id}/stories", json=STORY).json()

    response = analyze(client, story["id"])

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["ai_status"] == "unavailable" and body["used_ai"] is False
    assert any(f["source"] == "rule" for f in body["findings"])
    assert len(ai.calls) == 0


def test_quota_running_out_midway_keeps_earlier_results(client: TestClient) -> None:
    use_adapter(AllowFirst(1), ok_response("US-AC-004"), ok_response("US-AC-004"))
    url = f"/api/v1/projects/{client.project_id}/stories"
    story = client.post(url, json=STORY).json()
    other = client.post(url, json={**STORY, "title": "Otra historia distinta"}).json()

    first = analyze(client, story["id"]).json()
    second = analyze(client, other["id"])  # otra historia: la caché no la sirve sin cuota

    assert first["ai_status"] == "ok" and first["used_ai"] is True
    assert second.status_code == 201 and second.json()["ai_status"] == "unavailable"
    assert client.get(f"/api/v1/analyses/{first['id']}").json()["used_ai"] is True


def test_health_reports_remaining_quota_only_when_ai_is_configured(client: TestClient) -> None:
    body = client.get("/api/v1/health").json()

    assert body["ai_configured"] is False
    assert body["ai_quota_remaining_today"] is None
