from fastapi.testclient import TestClient

NOISY = {
    "title": "Notificaciones de pago",
    "description": (
        "Como cliente quiero recibir notificaciones adecuadas, normalmente por correo "
        "y/o SMS, para estar informado"
    ),
    "acceptance_criteria": ["El sistema notifica lo antes posible"],
}


def analyze(client: TestClient, project_id: str) -> dict:
    story = client.post(f"/api/v1/projects/{project_id}/stories", json=NOISY).json()
    response = client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    assert response.status_code == 201, response.text
    return response.json()


def patch_settings(client: TestClient, project_id: str, settings: dict):
    return client.patch(f"/api/v1/projects/{project_id}", json={"settings": settings})


def test_analysis_uses_project_settings(client: TestClient) -> None:
    before = analyze(client, client.project_id)
    assert (before["score"], before["verdict"]) == (66, "ready_with_notes")
    assert "US-AMB-001" in {f["rule_id"] for f in before["findings"]}

    assert (
        patch_settings(client, client.project_id, {"disabled_rules": ["US-AMB-001"]}).status_code
        == 200
    )
    after = analyze(client, client.project_id)

    assert "US-AMB-001" not in {f["rule_id"] for f in after["findings"]}
    assert after["score"] > before["score"]


def test_thresholds_apply_and_history_keeps_its_own_settings(client: TestClient) -> None:
    before = analyze(client, client.project_id)

    patch_settings(client, client.project_id, {"not_ready_below": 40, "ready_from": 60})
    after = analyze(client, client.project_id)

    assert after["verdict"] == "ready"
    assert client.get(f"/api/v1/analyses/{before['id']}").json()["verdict"] == "ready_with_notes"


def test_story_summary_reflects_settings_of_its_analysis(client: TestClient) -> None:
    patch_settings(client, client.project_id, {"not_ready_below": 40, "ready_from": 60})
    analysis = analyze(client, client.project_id)

    listed = client.get(f"/api/v1/projects/{client.project_id}/stories").json()

    assert listed[0]["latest_analysis"]["verdict"] == analysis["verdict"] == "ready"


def test_blocking_findings_ignore_relaxed_thresholds(client: TestClient) -> None:
    patch_settings(client, client.project_id, {"not_ready_below": 0, "ready_from": 1})
    story = client.post(
        f"/api/v1/projects/{client.project_id}/stories",
        json={"title": "Pago", "description": "El sistema permite pagar."},
    ).json()

    analysis = client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False}).json()

    assert analysis["verdict"] == "not_ready"


def test_invalid_settings_are_rejected(client: TestClient) -> None:
    bad = [
        {"not_ready_below": 60, "ready_from": 50},
        {"not_ready_below": 70, "ready_from": 70},
        {"disabled_rules": ["XX-999"]},
        {"penalties": {"fatal": 5}},
        {"penalties": {"major": -1}},
        {"ready_from": 101},
    ]
    for settings in bad:
        response = patch_settings(client, client.project_id, settings)
        assert response.status_code == 422, settings
    kept = client.get(f"/api/v1/projects/{client.project_id}").json()["settings"]
    assert kept["ready_from"] == 85 and kept["disabled_rules"] == []
