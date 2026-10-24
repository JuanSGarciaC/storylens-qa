from app.application.reports import clean, filename
from tests.integration.test_qa_sessions_api import ENV, STORY, detail, make_session, make_story, run


def test_clean_flattens_lines_and_neutralizes_html():
    assert clean("uno\n## dos\r\n<script>x</script>") == "uno ## dos &lt;script>x&lt;/script>"
    assert clean(None) == ""


def test_filename_is_ascii_without_path_separators():
    name = filename('../../Retirar "efectivo" ñandú\n', "sesion")
    assert name == "retirar-efectivo-and-sesion"
    assert filename("???", "analisis") == "reporte-analisis"


def test_analysis_report_is_a_markdown_download(client):
    story_id = client.post("/api/v1/stories", json=STORY).json()["id"]
    analysis = client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": False}).json()

    response = client.get(f"/api/v1/analyses/{analysis['id']}/report?format=md")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/markdown")
    assert (
        response.headers["content-disposition"]
        == 'attachment; filename="retirar-efectivo-analisis.md"'
    )
    assert response.headers["x-content-type-options"] == "nosniff"
    body = response.text
    assert "# Reporte de análisis de historia" in body
    assert f"**Puntaje:** {analysis['score']}/100" in body
    assert "Dado un saldo de 500" in body


def test_report_shows_dismissed_findings_with_their_reason(client):
    story_id = client.post("/api/v1/stories", json={**STORY, "acceptance_criteria": []}).json()[
        "id"
    ]
    analysis = client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": False}).json()
    finding = analysis["findings"][0]
    client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"decision": "dismissed", "dismiss_reason": "Fuera de alcance <b>hoy</b>"},
    )

    body = client.get(f"/api/v1/analyses/{analysis['id']}/report").text

    assert "Descartado" in body and "Motivo del descarte: Fuera de alcance &lt;b>hoy&lt;/b>" in body
    assert "<b>" not in body


def test_unknown_analysis_and_unsupported_format(client):
    assert client.get("/api/v1/analyses/nope/report").status_code == 404
    story_id = client.post("/api/v1/stories", json=STORY).json()["id"]
    analysis = client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": False}).json()
    assert client.get(f"/api/v1/analyses/{analysis['id']}/report?format=docx").status_code == 422


def test_reports_can_be_downloaded_as_pdf(client):
    story_id = make_story(client)
    session = make_session(client, story_id)
    analysis = client.post(f"/api/v1/stories/{story_id}/analyses", json={"use_ai": False}).json()

    for url, name in (
        (f"/api/v1/analyses/{analysis['id']}/report?format=pdf", "retirar-efectivo-analisis.pdf"),
        (f"/api/v1/qa-sessions/{session['id']}/report?format=pdf", "retirar-efectivo-sesion.pdf"),
    ):
        response = client.get(url)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["content-disposition"] == f'attachment; filename="{name}"'
        assert response.content.startswith(b"%PDF") and response.content.rstrip().endswith(b"%%EOF")


def test_session_report_covers_results_checklist_and_defect(client):
    story_id = make_story(client)
    session = make_session(client, story_id)
    executions = detail(client, session["id"])["executions"]
    run(client, executions[0]["id"], result="passed")
    run(client, executions[1]["id"], result="failed", actual_result="Saldo -100\n# inyectado")
    failed_id = executions[1]["id"]
    client.post(f"/api/v1/executions/{failed_id}/defect-draft", json={"use_ai": False})
    client.post(
        f"/api/v1/executions/{failed_id}/evidences", json={"type": "note", "text": "Se ve el error"}
    )

    response = client.get(f"/api/v1/qa-sessions/{session['id']}/report?format=md")

    assert response.status_code == 200
    assert (
        response.headers["content-disposition"]
        == 'attachment; filename="retirar-efectivo-sesion.md"'
    )
    body = response.text
    assert "# Reporte de sesión de revisión QA" in body
    assert f"**Ambiente:** {ENV['environment_name']} ({ENV['environment_url']})" in body
    assert "- Pasaron: 1" in body and "- Fallaron: 1" in body
    assert "- [ ] " in body  # checklist sin marcar
    assert "**Defecto:** Falla en: Caso" in body
    assert "**Evidencia (note):** Se ve el error" in body
    assert "Resultado obtenido:** Saldo -100 # inyectado" in body
    assert "\n# inyectado" not in body


def test_unknown_session_report_is_404(client):
    assert client.get("/api/v1/qa-sessions/nope/report").status_code == 404
