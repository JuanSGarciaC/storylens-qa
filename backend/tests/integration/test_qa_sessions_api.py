import pytest

from app.api.deps import get_llm
from app.domain.ports import AIDefectDraft, AITestCaseDraft, LLMUnavailableError
from app.domain.qa_session import PNG_SIGNATURE
from app.infrastructure.llm.fake import FakeLLM
from app.main import app

STORY = {
    "title": "Retirar efectivo",
    "description": "Como cliente quiero retirar efectivo para disponer de mi dinero",
    "acceptance_criteria": [
        "Dado un saldo de 500, cuando retiro 100, entonces el saldo queda en 400",
        "Dado un retiro mayor al saldo, cuando confirmo, entonces veo 'Saldo insuficiente'",
    ],
}
ENV = {
    "environment_name": "QA",
    "environment_url": "https://qa.example.com",
    "build_version": "1.4.2",
    "tester_name": "Ana",
}
PNG = PNG_SIGNATURE + b"\x00" * 64


def case_draft(title, criterion=1, priority="high") -> AITestCaseDraft:
    return AITestCaseDraft(
        title=title,
        technique="scenario",
        criterion_index=criterion,
        preconditions="Saldo 500",
        steps=["Elegir Retirar", "Ingresar monto", "Confirmar"],
        test_data="",
        expected_result="Resultado esperado",
        gherkin=None,
        priority=priority,
    )


def use_llm(llm):
    app.dependency_overrides[get_llm] = lambda: llm


def make_story(client, accept=2) -> str:
    """Historia con 3 casos generados; se aceptan los primeros `accept`."""
    story_id = client.post(f"/api/v1/projects/{client.project_id}/stories", json=STORY).json()["id"]
    use_llm(FakeLLM(cases=[case_draft("Caso A"), case_draft("Caso B", 2), case_draft("Caso C")]))
    cases = client.post(f"/api/v1/stories/{story_id}/test-cases:generate").json()
    for case in cases[:accept]:
        client.patch(f"/api/v1/test-cases/{case['id']}", json={"status": "accepted"})
    use_llm(None)
    return story_id


def make_session(client, story_id=None, **overrides) -> dict:
    story_id = story_id or make_story(client)
    response = client.post(f"/api/v1/stories/{story_id}/qa-sessions", json={**ENV, **overrides})
    assert response.status_code == 201, response.text
    return response.json()


def run(client, execution_id, **body):
    response = client.patch(f"/api/v1/executions/{execution_id}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def detail(client, session_id) -> dict:
    return client.get(f"/api/v1/qa-sessions/{session_id}").json()


# --- creación ---
def test_session_is_built_from_accepted_cases_only(client):
    session = make_session(client)

    titles = [e["case_title"] for e in session["executions"]]
    assert titles == ["Caso A", "Caso B"]  # el caso C no se aceptó
    assert {e["result"] for e in session["executions"]} == {"not_run"}
    assert session["pending"] == 2
    assert session["counts"] == {"passed": 0, "failed": 0, "blocked": 0, "not_run": 2}
    assert session["suggested_recommendation"] is None
    assert session["closed_at"] is None
    assert session["executions"][0]["steps"] == ["Elegir Retirar", "Ingresar monto", "Confirmar"]


def test_session_gets_the_standard_checklist(client):
    checklist = make_session(client)["checklist"]
    assert {i["phase"] for i in checklist} == {"preparation", "execution", "closure"}
    assert len(checklist) == 13 and not any(i["checked"] for i in checklist)


def test_session_requires_accepted_cases(client):
    story_id = make_story(client, accept=0)
    response = client.post(f"/api/v1/stories/{story_id}/qa-sessions", json=ENV)
    assert response.status_code == 422
    assert "aceptado" in response.json()["detail"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"environment_url": "javascript:alert(1)"},
        {"environment_url": "ftp://qa.example.com"},
        {"environment_url": "no-es-una-url"},
        {"environment_name": "   "},
    ],
)
def test_invalid_environment_is_rejected(client, overrides):
    story_id = make_story(client)
    response = client.post(f"/api/v1/stories/{story_id}/qa-sessions", json={**ENV, **overrides})
    assert response.status_code == 422


def test_session_for_unknown_story_is_404(client):
    assert client.post("/api/v1/stories/no-existe/qa-sessions", json=ENV).status_code == 404


def test_sessions_are_listed_newest_first(client):
    story_id = make_story(client)
    first = make_session(client, story_id, environment_name="Primero")
    second = make_session(client, story_id, environment_name="Segundo")
    ids = [s["id"] for s in client.get(f"/api/v1/stories/{story_id}/qa-sessions").json()]
    assert ids == [second["id"], first["id"]]


# --- checklist y ejecución ---
def test_checklist_item_can_be_checked_with_a_note(client):
    session = make_session(client)
    item = session["checklist"][0]

    updated = client.patch(
        f"/api/v1/checklist-items/{item['id']}", json={"checked": True, "note": "Verificado"}
    ).json()

    assert updated["checked"] is True and updated["note"] == "Verificado"
    assert detail(client, session["id"])["checklist"][0]["checked"] is True
    unchecked = client.patch(
        f"/api/v1/checklist-items/{item['id']}", json={"checked": False}
    ).json()
    assert unchecked["checked"] is False and unchecked["note"] == "Verificado"


def test_unknown_checklist_item_is_404(client):
    assert client.patch("/api/v1/checklist-items/x", json={"checked": True}).status_code == 404


def test_execution_results_update_counts_and_timestamps(client):
    session = make_session(client)
    first, second = (e["id"] for e in session["executions"])

    passed = run(client, first, result="passed")
    assert passed["result"] == "passed" and passed["executed_at"]

    run(client, second, result="failed", actual_result="Falló", notes="Intermitente")
    current = detail(client, session["id"])
    assert current["counts"] == {"passed": 1, "failed": 1, "blocked": 0, "not_run": 0}
    assert current["pending"] == 0

    reverted = run(client, first, result="not_run")
    assert reverted["executed_at"] is None  # volver a "no ejecutado" borra la fecha


def test_partial_execution_updates_keep_other_fields(client):
    execution = make_session(client)["executions"][0]
    run(client, execution["id"], result="failed", actual_result="El saldo queda en -100")
    after = run(client, execution["id"], notes="Solo cambio las notas")
    assert after["actual_result"] == "El saldo queda en -100" and after["result"] == "failed"


def test_unknown_execution_is_404(client):
    assert client.patch("/api/v1/executions/x", json={"result": "passed"}).status_code == 404


# --- cierre ---
def close(client, session_id, recommendation, summary=""):
    return client.post(
        f"/api/v1/qa-sessions/{session_id}:close",
        json={"recommendation": recommendation, "summary": summary},
    )


def test_cannot_close_with_pending_cases(client):
    session = make_session(client)
    response = close(client, session["id"], "reject")
    assert response.status_code == 409
    assert "2 casos" in response.json()["detail"]


def test_cannot_accept_when_there_are_failed_or_blocked_cases(client):
    session = make_session(client)
    first, second = (e["id"] for e in session["executions"])
    run(client, first, result="passed")
    run(client, second, result="blocked")

    response = close(client, session["id"], "accept")

    assert response.status_code == 422
    assert detail(client, session["id"])["closed_at"] is None


def test_full_flow_to_an_accepted_closure(client):
    session = make_session(client)
    for execution in session["executions"]:
        run(client, execution["id"], result="passed")
    assert detail(client, session["id"])["suggested_recommendation"] == "accept"

    closed = close(client, session["id"], "accept", "Todo en orden").json()

    assert closed["recommendation"] == "accept" and closed["summary"] == "Todo en orden"
    assert closed["closed_at"]


def test_closed_session_rejects_every_change(client):
    session = make_session(client)
    first, second = session["executions"]
    run(client, first["id"], result="passed")
    run(client, second["id"], result="failed")
    close(client, session["id"], "reject")

    item = session["checklist"][0]["id"]
    assert (
        client.patch(f"/api/v1/checklist-items/{item}", json={"checked": True}).status_code == 409
    )
    assert (
        client.patch(f"/api/v1/executions/{first['id']}", json={"result": "failed"}).status_code
        == 409
    )
    assert (
        client.post(
            f"/api/v1/executions/{first['id']}/evidences", json={"type": "note", "text": "x"}
        ).status_code
        == 409
    )
    assert client.post(f"/api/v1/executions/{second['id']}/defect-draft").status_code == 409
    assert close(client, session["id"], "reject").status_code == 409  # tampoco se cierra dos veces


# --- evidencias ---
def test_note_and_link_evidence(client):
    execution = make_session(client)["executions"][0]
    url = f"/api/v1/executions/{execution['id']}/evidences"

    note = client.post(url, json={"type": "note", "text": "Se vio el error 500"})
    link = client.post(
        url, json={"type": "link", "url": "https://jira.example.com/QA-1", "description": "Ticket"}
    )

    assert note.status_code == 201 and note.json()["description"] == "Se vio el error 500"
    assert note.json()["url"] is None
    assert link.json()["url"] == "https://jira.example.com/QA-1"
    shown = run(client, execution["id"], notes="x")["evidences"]
    assert [e["type"] for e in shown] == ["note", "link"]


@pytest.mark.parametrize(
    "body",
    [
        {"type": "note", "text": "   "},
        {"type": "link", "url": "javascript:alert(1)"},
        {"type": "link", "url": "data:text/html,<b>x</b>"},
        {"type": "link", "url": ""},
        {"type": "image"},
    ],
)
def test_invalid_evidence_is_rejected(client, body):
    execution = make_session(client)["executions"][0]
    response = client.post(f"/api/v1/executions/{execution['id']}/evidences", json=body)
    assert response.status_code == 422


def upload(client, execution_id, content, filename="captura.png", description="Pantalla"):
    return client.post(
        f"/api/v1/executions/{execution_id}/evidences/image",
        files={"file": (filename, content, "image/png")},
        data={"description": description},
    )


def test_image_upload_is_stored_and_served_with_safe_headers(client, storage_dir):
    execution = make_session(client)["executions"][0]

    response = upload(client, execution["id"], PNG)

    assert response.status_code == 201
    evidence = response.json()
    assert evidence["type"] == "image" and evidence["description"] == "Pantalla"
    assert evidence["url"] == f"/api/v1/evidences/{evidence['id']}/file"
    assert len(list(storage_dir.iterdir())) == 1

    served = client.get(evidence["url"])
    assert served.status_code == 200 and served.content == PNG
    assert served.headers["content-type"] == "image/png"
    assert served.headers["x-content-type-options"] == "nosniff"


def test_image_type_comes_from_content_not_from_the_filename_or_header(client, storage_dir):
    execution = make_session(client)["executions"][0]

    fake = upload(client, execution["id"], b"<script>alert(1)</script>", filename="x.png")
    gif = upload(client, execution["id"], b"GIF89a" + b"\x00" * 32)
    real = upload(client, execution["id"], PNG, filename="no-es-una-imagen.txt")

    assert fake.status_code == 422 and gif.status_code == 422
    assert real.status_code == 201  # lo que cuenta es el contenido
    assert len(list(storage_dir.iterdir())) == 1  # lo rechazado no quedó en disco


def test_empty_and_oversized_images_are_rejected(client, storage_dir):
    execution = make_session(client)["executions"][0]

    assert upload(client, execution["id"], b"").status_code == 422
    too_big = PNG + b"\x00" * 5_000_000
    assert upload(client, execution["id"], too_big).status_code == 413  # tope: 1 MB
    assert not storage_dir.exists() or not list(storage_dir.iterdir())


def test_gigantic_uploads_are_refused_by_size_before_processing(client):
    execution = make_session(client)["executions"][0]
    response = upload(client, execution["id"], PNG + b"\x00" * 6_500_000)
    assert response.status_code == 413
    assert response.headers["content-type"].startswith("application/problem+json")


def test_only_images_have_a_downloadable_file(client):
    execution = make_session(client)["executions"][0]
    note = client.post(
        f"/api/v1/executions/{execution['id']}/evidences", json={"type": "note", "text": "n"}
    ).json()
    assert client.get(f"/api/v1/evidences/{note['id']}/file").status_code == 404
    assert client.get("/api/v1/evidences/no-existe/file").status_code == 404


def test_deleting_a_story_removes_sessions_and_evidence_files(client, storage_dir):
    story_id = make_story(client)
    session = make_session(client, story_id)
    upload(client, session["executions"][0]["id"], PNG)
    assert len(list(storage_dir.iterdir())) == 1

    assert client.delete(f"/api/v1/stories/{story_id}").status_code == 204

    assert client.get(f"/api/v1/qa-sessions/{session['id']}").status_code == 404
    assert list(storage_dir.iterdir()) == []  # sin archivos huérfanos


# --- defectos ---
def failed_execution(client, **fields) -> tuple[dict, dict]:
    session = make_session(client)
    execution = session["executions"][0]
    run(client, execution["id"], result="failed", **fields)
    return session, execution


def draft(client, execution_id, **body):
    return client.post(f"/api/v1/executions/{execution_id}/defect-draft", json=body or None)


def test_defect_requires_a_failed_execution(client):
    session = make_session(client)
    execution = session["executions"][0]
    run(client, execution["id"], result="passed")
    assert draft(client, execution["id"]).status_code == 409


def test_defect_template_without_ai(client):
    session, execution = failed_execution(client, actual_result="El saldo queda en -100")

    response = draft(client, execution["id"], use_ai=False)

    assert response.status_code == 201
    body = response.json()
    defect = body["defect"]
    assert body["ai_status"] == "not_requested"
    assert defect["title"] == "Falla en: Caso A"
    assert defect["steps"] == ["Elegir Retirar", "Ingresar monto", "Confirmar"]
    assert defect["expected_result"] == "Resultado esperado"
    assert defect["actual_result"] == "El saldo queda en -100"
    assert defect["environment"] == "QA (https://qa.example.com)"
    assert defect["build_version"] == "1.4.2"
    assert defect["severity"] == "major" and defect["ai_assisted"] is False
    shown = detail(client, session["id"])["executions"][0]["defect"]
    assert shown["id"] == defect["id"]


def test_ai_improves_the_wording_and_receives_only_real_facts(client):
    llm = FakeLLM(
        defect=AIDefectDraft(
            title="Se permite retirar más que el saldo",
            preconditions="Cuenta con saldo 500",
            steps=["Elegir Retirar", "Ingresar 600", "Confirmar"],
            expected_result="Se muestra Saldo insuficiente",
            actual_result="El saldo queda en -100",
            severity="critical",
            priority="high",
        )
    )
    _, execution = failed_execution(client, actual_result="saldo en -100", notes="siempre pasa")
    use_llm(llm)

    body = draft(client, execution["id"]).json()

    assert body["ai_status"] == "ok" and body["defect"]["ai_assisted"] is True
    assert body["defect"]["title"] == "Se permite retirar más que el saldo"
    assert body["defect"]["environment"] == "QA (https://qa.example.com)"  # la IA no lo toca
    context = llm.last_defect_context
    assert context.actual_result == "saldo en -100" and context.notes == "siempre pasa"
    assert context.build_version == "1.4.2" and context.case.title == "Caso A"


@pytest.mark.parametrize("llm", [None, FakeLLM(error=LLMUnavailableError("sin cuota"))])
def test_defect_falls_back_to_the_template_when_ai_fails(client, llm):
    _, execution = failed_execution(client, actual_result="falla")
    use_llm(llm)

    response = draft(client, execution["id"])

    assert response.status_code == 201
    body = response.json()
    assert body["ai_status"] == "unavailable"
    assert body["defect"]["title"] == "Falla en: Caso A" and body["defect"]["ai_assisted"] is False


def test_regenerating_replaces_the_single_defect_of_an_execution(client):
    session, execution = failed_execution(client, actual_result="falla")
    first = draft(client, execution["id"], use_ai=False).json()["defect"]
    client.patch(f"/api/v1/defect-drafts/{first['id']}", json={"title": "Editado a mano"})

    second = draft(client, execution["id"], use_ai=False).json()["defect"]

    assert second["id"] == first["id"]
    assert second["title"] == "Falla en: Caso A"
    assert detail(client, session["id"])["executions"][0]["defect"]["id"] == first["id"]


def test_defect_can_be_edited(client):
    _, execution = failed_execution(client, actual_result="falla")
    defect = draft(client, execution["id"], use_ai=False).json()["defect"]

    updated = client.patch(
        f"/api/v1/defect-drafts/{defect['id']}",
        json={
            "title": "Título nuevo",
            "severity": "minor",
            "frequency": "intermittent",
            "steps": ["Uno", " Dos "],
        },
    ).json()

    assert updated["title"] == "Título nuevo" and updated["severity"] == "minor"
    assert updated["frequency"] == "intermittent" and updated["steps"] == ["Uno", "Dos"]
    assert updated["expected_result"] == defect["expected_result"]  # lo no enviado no cambia


@pytest.mark.parametrize(
    "body", [{"steps": ["  "]}, {"steps": []}, {"title": ""}, {"severity": "x"}]
)
def test_invalid_defect_edits_are_rejected(client, body):
    _, execution = failed_execution(client, actual_result="falla")
    defect = draft(client, execution["id"], use_ai=False).json()["defect"]
    assert client.patch(f"/api/v1/defect-drafts/{defect['id']}", json=body).status_code == 422


def test_unknown_defect_is_404(client):
    assert client.patch("/api/v1/defect-drafts/x", json={"title": "t"}).status_code == 404


# --- recomendación según defectos ---
def test_minor_defect_suggests_accepting_with_minor_defects(client):
    session = make_session(client)
    first, second = (e["id"] for e in session["executions"])
    run(client, first, result="passed")
    run(client, second, result="failed", actual_result="Texto con error ortográfico")
    defect = draft(client, second, use_ai=False).json()["defect"]
    client.patch(f"/api/v1/defect-drafts/{defect['id']}", json={"severity": "trivial"})

    assert detail(client, session["id"])["suggested_recommendation"] == "accept_with_minor_defects"
    assert close(client, session["id"], "accept_with_minor_defects").status_code == 200


def test_major_defect_suggests_rejecting(client):
    session = make_session(client)
    first, second = (e["id"] for e in session["executions"])
    run(client, first, result="passed")
    run(client, second, result="failed", actual_result="Pérdida de datos")
    draft(client, second, use_ai=False)  # prioridad alta -> severidad mayor

    assert detail(client, session["id"])["suggested_recommendation"] == "reject"
