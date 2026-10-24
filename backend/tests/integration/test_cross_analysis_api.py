def add_story(client, title, description, **extra):
    response = client.post(
        f"/api/v1/projects/{client.project_id}/stories",
        json={"title": title, "description": description, "acceptance_criteria": [], **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def get(client):
    response = client.get(f"/api/v1/projects/{client.project_id}/cross-analysis")
    assert response.status_code == 200, response.text
    return response.json()


def test_empty_project_returns_zeroes(client):
    result = get(client)
    assert result["total_stories"] == 0
    assert result["duplicates"] == [] and result["epic_risks"] == []


def test_detects_duplicates_and_lists_stories_without_cases(client):
    a = add_story(client, "Recuperar contraseña", "Como usuario recuperar contraseña por correo")
    b = add_story(client, "Recuperar contraseña", "Quiero recuperar mi contraseña por correo")
    result = get(client)
    assert [{d["a_id"], d["b_id"]} for d in result["duplicates"]] == [{a["id"], b["id"]}]
    assert set(result["without_cases"]) == {a["id"], b["id"]}
    assert {s["id"] for s in result["stories"]} == {a["id"], b["id"]}
    group = result["epic_risks"][0]
    assert group["epic_name"] == "Sin épica" and group["stories"] == 2
    assert group["level"] == "unknown"  # nada analizado: no se inventa un nivel


def test_analyzed_stories_drive_the_epic_risk(client):
    epic = client.post(f"/api/v1/projects/{client.project_id}/epics", json={"name": "Pagos"}).json()
    bad = add_story(client, "Algo", "rápido", epic_id=epic["id"])
    client.post(f"/api/v1/stories/{bad['id']}/analyses", json={"use_ai": False})
    risk = get(client)["epic_risks"][0]
    assert risk["epic_name"] == "Pagos"
    assert risk["analyzed"] == 1 and risk["not_ready"] == 1
    assert risk["level"] == "high"


def test_foreign_project_is_not_found_for_anonymous(client, anon_client):
    assert (
        anon_client.get(f"/api/v1/projects/{client.project_id}/cross-analysis").status_code == 404
    )
    assert client.get("/api/v1/projects/no-existe/cross-analysis").status_code == 404
