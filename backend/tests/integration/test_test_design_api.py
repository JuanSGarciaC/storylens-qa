import pytest

from app.api.deps import get_llm
from app.domain.entities import Technique
from app.domain.ports import (
    AIGherkinDraft,
    AITestCaseDraft,
    LLMInvalidResponseError,
    LLMUnavailableError,
)
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


def draft(title="Retiro menor al saldo", **overrides) -> AITestCaseDraft:
    base = {
        "title": title,
        "technique": "scenario",
        "criterion_index": 1,
        "preconditions": "Saldo 500",
        "steps": ["Elegir Retirar", "Ingresar 100", "Confirmar"],
        "test_data": "saldo=500",
        "expected_result": "El saldo queda en 400",
        "gherkin": None,
        "priority": "high",
    }
    return AITestCaseDraft(**{**base, **overrides})


def use_llm(llm):
    app.dependency_overrides[get_llm] = lambda: llm


def new_story(client, **overrides):
    return client.post(
        f"/api/v1/projects/{client.project_id}/stories", json={**STORY, **overrides}
    ).json()["id"]


def generate(client, story_id, **body):
    return client.post(f"/api/v1/stories/{story_id}/test-cases:generate", json=body or None)


# --- generación ---
def test_generate_stores_validated_cases_as_proposed(client):
    llm = FakeLLM(
        cases=[
            draft(),
            draft("Retiro mayor al saldo", technique="boundary_value", criterion_index=2),
            draft("Técnica inventada", technique="vudú"),
            draft("Criterio inexistente", criterion_index=9),
        ]
    )
    use_llm(llm)
    story_id = new_story(client)

    response = generate(client, story_id)

    assert response.status_code == 200
    cases = response.json()
    assert [c["title"] for c in cases] == [
        "Retiro menor al saldo",
        "Retiro mayor al saldo",
        "Criterio inexistente",
    ]
    assert {c["origin"] for c in cases} == {"ai"} and {c["status"] for c in cases} == {"proposed"}
    assert cases[2]["criterion_index"] is None  # el criterio 9 no existe
    assert all(c["id"] and c["story_id"] == story_id for c in cases)
    assert client.get(f"/api/v1/stories/{story_id}/test-cases").json() == cases
    assert llm.requested_techniques == list(Technique)  # sin cuerpo = todas


def test_generate_passes_only_the_requested_techniques(client):
    llm = FakeLLM(cases=[draft(), draft("Límites", technique="boundary_value")])
    use_llm(llm)
    story_id = new_story(client)

    cases = generate(client, story_id, techniques=["scenario"]).json()

    assert llm.requested_techniques == [Technique.SCENARIO]
    assert [c["technique"] for c in cases] == ["scenario"]  # la otra no se pidió


def test_regenerating_replaces_only_unreviewed_ai_cases(client):
    use_llm(FakeLLM(cases=[draft("Primero"), draft("Segundo", criterion_index=2)]))
    story_id = new_story(client)
    first = generate(client, story_id).json()
    client.patch(f"/api/v1/test-cases/{first[0]['id']}", json={"status": "accepted"})
    client.post(
        f"/api/v1/stories/{story_id}/test-cases",
        json={
            "title": "Mío",
            "technique": "error_guessing",
            "steps": ["a"],
            "expected_result": "b",
        },
    )

    use_llm(FakeLLM(cases=[draft("Nuevo")]))
    titles = [c["title"] for c in generate(client, story_id).json()]

    assert "Primero" in titles  # aceptado: se conserva
    assert "Mío" in titles  # escrito por el usuario: se conserva
    assert "Nuevo" in titles
    assert "Segundo" not in titles  # propuesto por IA y sin revisar: se reemplaza


@pytest.mark.parametrize(
    ("llm", "status"),
    [
        (None, 503),
        (FakeLLM(error=LLMUnavailableError("límite")), 503),
        (FakeLLM(error=LLMInvalidResponseError("esquema")), 502),
        (FakeLLM(cases=[draft(technique="vudú")]), 502),  # nada válido
    ],
)
def test_generate_failures_return_problem_details(client, llm, status):
    use_llm(llm)
    response = generate(client, new_story(client))
    assert response.status_code == status
    assert response.headers["content-type"].startswith("application/problem+json")


def test_failed_regeneration_keeps_previous_proposals(client):
    use_llm(FakeLLM(cases=[draft("Conservado")]))
    story_id = new_story(client)
    generate(client, story_id)

    use_llm(FakeLLM(error=LLMUnavailableError("límite")))
    assert generate(client, story_id).status_code == 503

    titles = [c["title"] for c in client.get(f"/api/v1/stories/{story_id}/test-cases").json()]
    assert titles == ["Conservado"]


def test_generate_for_unknown_story_is_404(client):
    use_llm(FakeLLM(cases=[draft()]))
    assert generate(client, "no-existe").status_code == 404


# --- revisión y edición ---
def test_accept_reject_and_restore(client):
    use_llm(FakeLLM(cases=[draft()]))
    case_id = generate(client, new_story(client)).json()[0]["id"]

    for status in ("accepted", "rejected", "proposed"):
        updated = client.patch(f"/api/v1/test-cases/{case_id}", json={"status": status}).json()
        assert updated["status"] == status


def test_edit_fields_and_clear_the_criterion(client):
    use_llm(FakeLLM(cases=[draft()]))
    case_id = generate(client, new_story(client)).json()[0]["id"]

    updated = client.patch(
        f"/api/v1/test-cases/{case_id}",
        json={
            "title": "Título editado",
            "steps": ["uno", "  dos  "],
            "criterion_index": None,
            "priority": "low",
        },
    ).json()

    assert updated["title"] == "Título editado"
    assert updated["steps"] == ["uno", "dos"]
    assert updated["criterion_index"] is None
    assert updated["priority"] == "low"
    assert updated["expected_result"] == "El saldo queda en 400"  # lo no enviado no cambia


@pytest.mark.parametrize(
    "body",
    [
        {"criterion_index": 9},
        {"steps": ["   "]},
        {"title": ""},
        {"status": "inventado"},
    ],
)
def test_invalid_edits_are_rejected(client, body):
    use_llm(FakeLLM(cases=[draft()]))
    case_id = generate(client, new_story(client)).json()[0]["id"]
    assert client.patch(f"/api/v1/test-cases/{case_id}", json=body).status_code == 422


def test_editing_an_unknown_case_is_404(client):
    assert (
        client.patch("/api/v1/test-cases/no-existe", json={"status": "accepted"}).status_code == 404
    )


def test_manual_case_is_accepted_and_owned_by_the_user(client):
    story_id = new_story(client)
    response = client.post(
        f"/api/v1/stories/{story_id}/test-cases",
        json={
            "title": "Doble clic en Confirmar",
            "technique": "error_guessing",
            "steps": ["Pulsar Confirmar dos veces"],
            "expected_result": "Solo se registra un retiro",
            "criterion_index": 1,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert (body["origin"], body["status"]) == ("user", "accepted")


def test_manual_case_with_unknown_criterion_is_rejected(client):
    response = client.post(
        f"/api/v1/stories/{new_story(client)}/test-cases",
        json={
            "title": "X",
            "technique": "scenario",
            "steps": ["a"],
            "expected_result": "b",
            "criterion_index": 5,
        },
    )
    assert response.status_code == 422


# --- trazabilidad ---
def test_traceability_reflects_review_decisions(client):
    use_llm(FakeLLM(cases=[draft("A", criterion_index=1), draft("B", criterion_index=2)]))
    story_id = new_story(client)
    a, b = generate(client, story_id).json()

    before = client.get(f"/api/v1/stories/{story_id}/traceability").json()
    assert before["coverage"] == 0.0  # nada aceptado todavía
    assert [r["proposed_ids"] for r in before["rows"]] == [[a["id"]], [b["id"]]]

    client.patch(f"/api/v1/test-cases/{a['id']}", json={"status": "accepted"})
    after = client.get(f"/api/v1/stories/{story_id}/traceability").json()
    assert after["coverage"] == 0.5
    assert [r["covered"] for r in after["rows"]] == [True, False]
    assert after["rows"][0]["text"] == STORY["acceptance_criteria"][0]


def test_traceability_for_unknown_story_is_404(client):
    assert client.get("/api/v1/stories/no-existe/traceability").status_code == 404


def test_deleting_a_story_removes_its_cases(client):
    use_llm(FakeLLM(cases=[draft()]))
    story_id = new_story(client)
    case_id = generate(client, story_id).json()[0]["id"]

    assert client.delete(f"/api/v1/stories/{story_id}").status_code == 204
    assert (
        client.patch(f"/api/v1/test-cases/{case_id}", json={"status": "accepted"}).status_code
        == 404
    )


# --- Gherkin ---
GOOD_SCENARIO = (
    "Escenario: Retiro\nDado un saldo de 500\nCuando retiro 100\nEntonces el saldo queda en 400"
)


def test_gherkin_suggestions_keep_only_well_formed_scenarios(client):
    use_llm(
        FakeLLM(
            scenarios=[
                AIGherkinDraft(1, GOOD_SCENARIO),
                AIGherkinDraft(2, "El usuario ve un error"),  # prosa: se descarta
            ]
        )
    )
    response = client.post(f"/api/v1/stories/{new_story(client)}/gherkin:suggest")

    assert response.status_code == 200
    body = response.json()
    assert body["scenarios"] == [{"criterion_index": 1, "text": GOOD_SCENARIO}]
    assert body["prompt_version"] == "gherkin-v1"


def test_gherkin_for_a_story_without_criteria_does_not_call_the_llm(client):
    llm = FakeLLM(scenarios=[AIGherkinDraft(1, GOOD_SCENARIO)])
    use_llm(llm)
    response = client.post(
        f"/api/v1/stories/{new_story(client, acceptance_criteria=[])}/gherkin:suggest"
    )

    assert response.json()["scenarios"] == []
    assert llm.calls == 0


def test_gherkin_without_ai_is_503(client):
    response = client.post(f"/api/v1/stories/{new_story(client)}/gherkin:suggest")
    assert response.status_code == 503
