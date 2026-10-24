from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_ai_status_without_leaking_key():
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert isinstance(body["ai_configured"], bool)
    assert "key" not in str(body).lower()


def test_analyze_story_without_criteria_is_not_ready():
    response = client.post(
        "/api/v1/analyze",
        json={
            "title": "Login",
            "description": "Como usuario quiero iniciar sesión para acceder a mi cuenta",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verdict"] == "not_ready"
    assert body["used_ai"] is False
    assert "US-AC-001" in {f["rule_id"] for f in body["findings"]}


def test_analyze_rejects_oversized_story():
    response = client.post("/api/v1/analyze", json={"description": "x" * 10_001})
    assert response.status_code == 422


def test_rules_endpoint_lists_catalog():
    rules = client.get("/api/v1/rules").json()
    assert any(r["id"] == "US-AMB-001" for r in rules)
    assert all(r["reference"] for r in rules)
