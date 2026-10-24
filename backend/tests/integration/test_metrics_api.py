def add_story(client, title, criteria=(), **extra):
    response = client.post(
        f"/api/v1/projects/{client.project_id}/stories",
        json={
            "title": title,
            "description": "Como usuario quiero algo claro",
            "acceptance_criteria": list(criteria),
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def url(client, path, **params):
    return client.get(f"/api/v1/projects/{client.project_id}/{path}", params=params)


def metric(client, metric_id):
    body = url(client, "metrics").json()
    return next(m for m in body["metrics"] if m["id"] == metric_id)


def test_empty_project_has_no_values_instead_of_zeroes(client):
    body = url(client, "metrics").json()
    assert all(m["value"] is None for m in body["metrics"])
    assert url(client, "traceability-matrix").json() == {"total": 0, "rows": []}


def test_metrics_reflect_analyses_with_visible_denominators(client):
    story = add_story(client, "Retirar efectivo", ["Dado saldo, entonces ok"])
    add_story(client, "Otra historia")
    client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    analyzed = metric(client, "analyzed_stories")
    assert (analyzed["numerator"], analyzed["denominator"], analyzed["value"]) == (1, 2, 50.0)
    assert metric(client, "criteria_coverage")["denominator"] == 1
    assert metric(client, "criteria_coverage")["value"] == 0.0  # hay criterio, ningún caso


def test_improvement_effect_needs_two_analyses(client):
    story = add_story(client, "Algo")
    client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    assert metric(client, "improvement_effect")["value"] is None
    client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    effect = metric(client, "improvement_effect")
    assert effect["denominator"] == 1 and effect["value"] == 0.0


def test_matrix_lists_every_criterion_and_paginates(client):
    add_story(client, "Una", ["c1", "c2", "c3"])
    body = url(client, "traceability-matrix", limit=2).json()
    assert body["total"] == 3 and len(body["rows"]) == 2
    rest = url(client, "traceability-matrix", limit=2, offset=2).json()
    assert len(rest["rows"]) == 1
    assert rest["rows"][0]["cases"] == [] and rest["rows"][0]["last_result"] is None


def test_version_comparison(client):
    v1 = client.post(f"/api/v1/projects/{client.project_id}/versions", json={"name": "v1"}).json()
    v2 = client.post(f"/api/v1/projects/{client.project_id}/versions", json={"name": "v2"}).json()
    add_story(client, "Login", version_id=v1["id"])
    add_story(client, "Pagos", version_id=v1["id"])
    add_story(client, "Login", ["nuevo criterio"], version_id=v2["id"])
    add_story(client, "Perfil", version_id=v2["id"])
    body = url(client, "version-comparison", **{"from": v1["id"], "to": v2["id"]}).json()
    assert [s["title"] for s in body["added"]] == ["Perfil"]
    assert [s["title"] for s in body["removed"]] == ["Pagos"]
    assert body["changed"][0]["what"] == ["criterios de aceptación"]
    assert body["unchanged"] == 0


def test_access_rules(client, anon_client):
    base = f"/api/v1/projects/{client.project_id}"
    assert anon_client.get(f"{base}/metrics").status_code == 404
    assert client.get("/api/v1/projects/no-existe/metrics").status_code == 404
    assert client.get(f"{base}/version-comparison").status_code == 422  # faltan from/to
