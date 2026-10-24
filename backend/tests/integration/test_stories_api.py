STORY = {
    "title": "Recuperar contraseña",
    "description": "Como usuario quiero un acceso rápido para entrar",
    "acceptance_criteria": ["El sistema responde rápidamente"],
}


def create_story(client, **overrides):
    response = client.post(
        f"/api/v1/projects/{client.project_id}/stories", json={**STORY, **overrides}
    )
    assert response.status_code == 201
    return response.json()


def create_analysis(client, story_id):
    response = client.post(f"/api/v1/stories/{story_id}/analyses")
    assert response.status_code == 201
    return response.json()


def test_create_and_get_story_roundtrip(client):
    created = create_story(client)
    assert created["latest_analysis"] is None

    fetched = client.get(f"/api/v1/stories/{created['id']}").json()
    assert fetched["title"] == STORY["title"]
    assert fetched["acceptance_criteria"] == STORY["acceptance_criteria"]
    assert fetched["created_at"].endswith("Z") or "+" in fetched["created_at"]


def test_analysis_is_persisted_and_listed_with_story(client):
    story = create_story(client)
    analysis = create_analysis(client, story["id"])

    assert analysis["story_id"] == story["id"]
    assert all(f["id"] for f in analysis["findings"])

    again = client.get(f"/api/v1/analyses/{analysis['id']}").json()
    assert again == analysis  # mismo orden y mismo contenido tras el viaje por la BD

    listed = client.get(f"/api/v1/projects/{client.project_id}/stories").json()
    assert listed[0]["latest_analysis"]["id"] == analysis["id"]
    assert listed[0]["latest_analysis"]["score"] == analysis["score"]


def test_dismissing_a_finding_recalculates_score_and_keeps_reason(client):
    story = create_story(client)
    analysis = create_analysis(client, story["id"])
    major = next(f for f in analysis["findings"] if f["severity"] == "major")

    response = client.patch(
        f"/api/v1/findings/{major['id']}",
        json={"decision": "dismissed", "dismiss_reason": "Aceptado por el PO"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["score"] == analysis["score"] + 10
    changed = next(f for f in updated["findings"] if f["id"] == major["id"])
    assert changed["decision"] == "dismissed"
    assert changed["dismiss_reason"] == "Aceptado por el PO"

    # El puntaje persiste: el listado refleja la decisión.
    listed = client.get(f"/api/v1/stories/{story['id']}").json()
    assert listed["latest_analysis"]["score"] == updated["score"]


def test_dismiss_requires_a_reason(client):
    analysis = create_analysis(client, create_story(client)["id"])
    finding_id = analysis["findings"][0]["id"]

    response = client.patch(
        f"/api/v1/findings/{finding_id}", json={"decision": "dismissed", "dismiss_reason": "  "}
    )
    assert response.status_code == 422
    assert response.headers["content-type"].startswith("application/problem+json")


def test_restoring_a_finding_clears_the_reason(client):
    analysis = create_analysis(client, create_story(client)["id"])
    finding_id = analysis["findings"][0]["id"]
    client.patch(
        f"/api/v1/findings/{finding_id}", json={"decision": "dismissed", "dismiss_reason": "x"}
    )

    restored = client.patch(f"/api/v1/findings/{finding_id}", json={"decision": "pending"}).json()
    finding = next(f for f in restored["findings"] if f["id"] == finding_id)
    assert finding["decision"] == "pending"
    assert finding["dismiss_reason"] is None
    assert restored["score"] == analysis["score"]


def test_each_analysis_is_a_new_snapshot_and_latest_wins(client):
    story = create_story(client)
    first = create_analysis(client, story["id"])
    second = create_analysis(client, story["id"])

    assert first["id"] != second["id"]
    latest = client.get(f"/api/v1/stories/{story['id']}").json()["latest_analysis"]
    assert latest["id"] == second["id"]


def test_delete_story_removes_analyses_and_findings(client):
    story = create_story(client)
    analysis = create_analysis(client, story["id"])
    finding_id = analysis["findings"][0]["id"]

    assert client.delete(f"/api/v1/stories/{story['id']}").status_code == 204
    assert client.get(f"/api/v1/stories/{story['id']}").status_code == 404
    assert client.get(f"/api/v1/analyses/{analysis['id']}").status_code == 404
    assert (
        client.patch(f"/api/v1/findings/{finding_id}", json={"decision": "accepted"}).status_code
        == 404
    )


def test_not_found_returns_problem_details(client):
    response = client.get("/api/v1/stories/no-existe")
    assert response.status_code == 404
    body = response.json()
    assert body["status"] == 404 and body["title"] and body["detail"]
    assert response.headers["content-type"].startswith("application/problem+json")

    assert client.post("/api/v1/stories/no-existe/analyses").status_code == 404
    assert client.delete("/api/v1/stories/no-existe").status_code == 404


def test_stories_are_listed_newest_first(client):
    first = create_story(client, title="Primera")
    second = create_story(client, title="Segunda")
    ids = [s["id"] for s in client.get(f"/api/v1/projects/{client.project_id}/stories").json()]
    assert ids == [second["id"], first["id"]]
