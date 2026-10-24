import pytest

from app.api.deps import get_llm
from app.domain.ports import (
    AIFindingDraft,
    LLMInvalidResponseError,
    LLMUnavailableError,
)
from app.infrastructure.llm.fake import FakeLLM
from app.main import app

STORY = {
    "title": "Login",
    "description": "Como usuario quiero un acceso rápido para entrar",
    "acceptance_criteria": ["El sistema responde rápidamente"],
}
GOOD_DRAFT = AIFindingDraft(
    rule_id="US-AC-004",
    message="Solo se describe el camino feliz.",
    evidence_text="El sistema responde rápidamente",
    suggestion="Agregue criterios de error.",
    confidence=0.85,
)
HALLUCINATED = AIFindingDraft(
    rule_id="US-NFR-002",
    message="Falta cifrado.",
    evidence_text="El sistema cifra la tarjeta con AES-256",  # no está en la historia
    suggestion="Agregue cifrado.",
    confidence=0.99,
)


def use_llm(llm):
    app.dependency_overrides[get_llm] = lambda: llm


def analyze(client, **body):
    story = client.post("/api/v1/stories", json=STORY).json()
    response = client.post(f"/api/v1/stories/{story['id']}/analyses", json=body or None)
    assert response.status_code == 201
    return response.json()


def test_ai_findings_are_merged_persisted_and_scored(client):
    rules_only = analyze(client, use_ai=False)
    use_llm(FakeLLM([GOOD_DRAFT]))
    result = analyze(client)

    assert result["ai_status"] == "ok" and result["used_ai"] is True
    assert result["model_name"] == "fake-model" and result["prompt_version"] == "analysis-v1"

    ai = [f for f in result["findings"] if f["source"] == "ai"]
    assert len(ai) == 1
    assert ai[0]["rule_id"] == "US-AC-004" and ai[0]["confidence"] == 0.85
    assert ai[0]["id"]  # persistido: se puede aceptar o descartar
    assert result["score"] == rules_only["score"] - 10  # US-AC-004 es "mayor"

    stored = client.get(f"/api/v1/analyses/{result['id']}").json()
    assert stored == result


def test_ai_findings_can_be_dismissed_like_any_other(client):
    use_llm(FakeLLM([GOOD_DRAFT]))
    result = analyze(client)
    ai = next(f for f in result["findings"] if f["source"] == "ai")

    updated = client.patch(
        f"/api/v1/findings/{ai['id']}",
        json={"decision": "dismissed", "dismiss_reason": "No aplica"},
    ).json()
    assert updated["score"] == result["score"] + 10


def test_hallucinated_findings_never_reach_the_analysis(client):
    use_llm(FakeLLM([HALLUCINATED]))
    result = analyze(client)
    assert result["ai_status"] == "ok"
    assert [f for f in result["findings"] if f["source"] == "ai"] == []


@pytest.mark.parametrize(
    ("error", "status"),
    [
        (LLMUnavailableError("límite"), "unavailable"),
        (LLMInvalidResponseError("esquema"), "invalid_response"),
    ],
)
def test_ai_failure_degrades_to_rules_only_without_errors(client, error, status):
    rules_only = analyze(client, use_ai=False)
    use_llm(FakeLLM(error=error))
    result = analyze(client)

    assert result["ai_status"] == status and result["used_ai"] is False
    assert result["findings"] == [
        {**f, "id": g["id"]}
        for f, g in zip(rules_only["findings"], result["findings"], strict=True)
    ]
    assert result["score"] == rules_only["score"]


def test_use_ai_false_does_not_call_the_llm(client):
    llm = FakeLLM([GOOD_DRAFT])
    use_llm(llm)
    result = analyze(client, use_ai=False)

    assert result["ai_status"] == "not_requested"
    assert llm.calls == 0


def test_requesting_ai_without_configuration_is_reported_as_unavailable(client):
    result = analyze(client)  # el fixture inyecta llm=None
    assert result["ai_status"] == "unavailable"
    assert any(f["source"] == "rule" for f in result["findings"])
