from fastapi.testclient import TestClient


def _create(client: TestClient, name: str = "Pagos") -> dict:
    response = client.post("/api/v1/projects", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_and_get_project(client: TestClient) -> None:
    created = _create(client)

    fetched = client.get(f"/api/v1/projects/{created['id']}")

    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Pagos"
    assert fetched.json()["is_demo"] is False
    listed = {p["id"] for p in client.get("/api/v1/projects").json()}
    assert listed == {created["id"], client.project_id}


def test_rejects_empty_and_too_long_name(client: TestClient) -> None:
    for name in ("", "   ", "x" * 121):
        response = client.post("/api/v1/projects", json={"name": name})
        assert response.status_code == 422, name


def test_unknown_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/projects/no-existe").status_code == 404
    assert client.patch("/api/v1/projects/no-existe", json={"name": "x"}).status_code == 404
    assert client.delete("/api/v1/projects/no-existe").status_code == 404


def test_patch_settings_persists_thresholds(client: TestClient) -> None:
    project = _create(client)

    response = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"settings": {"ready_from": 90, "disabled_rules": ["R-004"]}},
    )

    assert response.status_code == 200
    settings = client.get(f"/api/v1/projects/{project['id']}").json()["settings"]
    assert settings["ready_from"] == 90
    assert settings["disabled_rules"] == ["R-004"]
    assert settings["not_ready_below"] == 60


def test_epics_and_versions_endpoints(client: TestClient) -> None:
    project = _create(client)
    base = f"/api/v1/projects/{project['id']}"

    epic = client.post(f"{base}/epics", json={"name": "Checkout"})
    version = client.post(f"{base}/versions", json={"name": "v1.0"})

    assert epic.status_code == 201 and version.status_code == 201
    assert [e["name"] for e in client.get(f"{base}/epics").json()] == ["Checkout"]
    assert [v["name"] for v in client.get(f"{base}/versions").json()] == ["v1.0"]
    other = _create(client, "Otro")
    assert client.get(f"/api/v1/projects/{other['id']}/epics").json() == []


def test_epics_of_unknown_project_return_404(client: TestClient) -> None:
    assert client.get("/api/v1/projects/no-existe/epics").status_code == 404
    assert client.post("/api/v1/projects/no-existe/versions", json={"name": "v"}).status_code == 404


def test_delete_project_removes_it(client: TestClient) -> None:
    project = _create(client)
    client.post(f"/api/v1/projects/{project['id']}/epics", json={"name": "E"})

    assert client.delete(f"/api/v1/projects/{project['id']}").status_code == 204

    assert client.get(f"/api/v1/projects/{project['id']}").status_code == 404
