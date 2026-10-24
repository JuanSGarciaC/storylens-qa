import json

CSV = (
    "Summary,Issue key,Description,Acceptance Criteria\n"
    'Retirar efectivo,BANK-1,"Como cliente quiero retirar efectivo",'
    '"- Dado saldo 500, entonces ok\n- Error si excede"\n'
    "Sin descripción,BANK-2,,\n"
    'Login,BANK-3,"Como usuario quiero entrar",\n'
)


def upload(client, path, content=CSV, name="jira.csv", **data):
    return client.post(
        f"/api/v1/projects/{client.project_id}/stories{path}",
        files={"file": (name, content.encode(), "text/csv")},
        data=data,
    )


def stories(client):
    return client.get(f"/api/v1/projects/{client.project_id}/stories").json()


def test_preview_shows_mapping_rows_and_problems_without_saving(client):
    response = upload(client, "/import")

    assert response.status_code == 200
    body = response.json()
    assert body["format"] == "csv"
    assert body["mapping"]["title"] == "Summary" and body["mapping"]["key"] == "Issue key"
    first, second, third = body["rows"]
    assert first["importable"] and first["acceptance_criteria"][0].startswith("Dado saldo 500")
    assert second["issues"] == ["Sin descripción"] and not second["importable"]
    assert third["importable"] and third["acceptance_criteria"] == []
    assert stories(client) == []


def test_confirm_creates_only_valid_rows_and_keeps_the_jira_key(client):
    response = upload(client, "/import:confirm")

    assert response.status_code == 201
    created = response.json()["created"]
    assert [s["title"] for s in created] == ["Retirar efectivo", "Login"]
    assert created[0]["notes"] == "Importada de Jira: BANK-1"
    assert len(stories(client)) == 2


def test_selection_limits_what_is_created(client):
    response = upload(client, "/import:confirm", selected=json.dumps([3]))

    assert [s["title"] for s in response.json()["created"]] == ["Login"]


def test_selecting_an_invalid_row_creates_nothing(client):
    response = upload(client, "/import:confirm", selected=json.dumps([2]))

    assert response.status_code == 422
    assert stories(client) == []


def test_importing_twice_skips_duplicates(client):
    upload(client, "/import:confirm")

    preview = upload(client, "/import").json()
    assert [r["duplicate"] for r in preview["rows"]] == [True, False, True]
    assert upload(client, "/import:confirm").status_code == 422
    assert len(stories(client)) == 2


def test_repeated_rows_inside_one_file_are_flagged(client):
    content = "Summary,Description\nA,Igual\nA,Igual\n"
    rows = upload(client, "/import", content).json()["rows"]
    assert [r["duplicate"] for r in rows] == [False, True]


def test_custom_mapping_is_applied(client):
    content = "Nombre,Texto\nMi historia,Quiero algo\n"
    mapping = json.dumps({"title": "Nombre", "description": "Texto"})

    rows = upload(client, "/import", content, mapping=mapping).json()["rows"]

    assert rows[0]["title"] == "Mi historia" and rows[0]["description"] == "Quiero algo"


def test_missing_description_column_asks_for_a_mapping(client):
    response = upload(client, "/import", "Nombre,Otro\nA,B\n")
    assert response.status_code == 422
    assert "descripción" in response.json()["detail"]


def test_bad_mapping_and_bad_files_are_422_with_a_reason(client):
    assert upload(client, "/import", mapping="{no").status_code == 422
    assert upload(client, "/import", mapping=json.dumps({"description": "Nope"})).status_code == 422
    assert upload(client, "/import", "", name="vacio.csv").status_code == 422
    assert upload(client, "/import:confirm", selected='["a"]').status_code == 422


def test_files_over_one_megabyte_are_rejected(client):
    big = "Summary,Description\n" + "T," + "x" * 1_100_000 + "\n"
    assert upload(client, "/import", big).status_code == 413


def test_imported_story_can_be_analyzed(client):
    story = upload(client, "/import:confirm").json()["created"][0]
    response = client.post(f"/api/v1/stories/{story['id']}/analyses", json={"use_ai": False})
    assert response.status_code == 201
