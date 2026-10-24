from types import SimpleNamespace

import pytest
from google.genai import errors

from app.domain.ports import LLMInvalidResponseError, LLMUnavailableError
from app.domain.rules.catalog import load_catalog
from app.infrastructure.llm.gemini import GeminiAdapter, _AnalysisDTO, _FindingDTO
from tests.conftest import make_story

AI_RULES = load_catalog().of_type("ai")
SECRET = "AIzaSyFAKEKEYFORTESTING1234567890abcde"


def ok_response(*rule_ids: str):
    findings = [
        _FindingDTO(
            rule_id=rid,
            message="m",
            evidence_text="e",
            suggestion="s",
            confidence=0.8,
        )
        for rid in rule_ids
    ]
    return SimpleNamespace(
        parsed=_AnalysisDTO(findings=findings),
        usage_metadata=SimpleNamespace(prompt_token_count=120, candidates_token_count=45),
    )


INVALID = SimpleNamespace(parsed=None, usage_metadata=None)


def api_error(code: int) -> errors.APIError:
    cls = errors.ClientError if code < 500 else errors.ServerError
    return cls(code, {"error": {"message": "x", "status": "ERR"}})


class FakeClient:
    """Cliente de google-genai de mentira: devuelve o lanza lo que se le indique, en orden."""

    def __init__(self, *behaviors):
        self._behaviors = list(behaviors)
        self.calls: list[dict] = []
        self.models = SimpleNamespace(generate_content=self._generate)

    def _generate(self, model, contents, config):
        self.calls.append({"model": model, "contents": contents, "config": config})
        behavior = self._behaviors.pop(0)
        if isinstance(behavior, Exception):
            raise behavior
        return behavior


def adapter(client, **kwargs) -> GeminiAdapter:
    return GeminiAdapter(client, model="primary", **kwargs)


def test_successful_call_returns_drafts_tokens_and_model():
    client = FakeClient(ok_response("US-AC-004", "US-AC-005"))
    result = adapter(client).analyze_story(make_story(), AI_RULES)

    assert [f.rule_id for f in result.findings] == ["US-AC-004", "US-AC-005"]
    assert result.model_name == "primary"
    assert result.prompt_version == "analysis-v1"
    assert (result.prompt_tokens, result.output_tokens) == (120, 45)


def test_request_uses_structured_output_low_temperature_and_rules_prompt():
    client = FakeClient(ok_response())
    adapter(client).analyze_story(make_story(), AI_RULES)

    (call,) = client.calls
    config = call["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_schema is _AnalysisDTO
    assert config.temperature == pytest.approx(0.2)
    assert "US-AC-004" in config.system_instruction
    assert call["contents"].startswith("<historia>")


def test_invalid_response_is_retried_once():
    client = FakeClient(INVALID, ok_response("US-AC-004"))
    result = adapter(client).analyze_story(make_story(), AI_RULES)
    assert len(result.findings) == 1
    assert len(client.calls) == 2


def test_two_invalid_responses_raise_invalid_response():
    client = FakeClient(INVALID, INVALID)
    with pytest.raises(LLMInvalidResponseError):
        adapter(client).analyze_story(make_story(), AI_RULES)
    assert len(client.calls) == 2


def test_fallback_model_is_used_when_primary_is_rate_limited():
    client = FakeClient(api_error(429), ok_response("US-AC-004"))
    result = adapter(client, fallback_model="backup").analyze_story(make_story(), AI_RULES)

    assert [c["model"] for c in client.calls] == ["primary", "backup"]
    assert result.model_name == "backup"


def test_all_models_failing_raises_unavailable():
    client = FakeClient(api_error(429), api_error(503))
    with pytest.raises(LLMUnavailableError, match="503"):
        adapter(client, fallback_model="backup").analyze_story(make_story(), AI_RULES)


def test_network_failure_is_unavailable_and_never_leaks_the_message():
    client = FakeClient(ConnectionError(f"fallo con key={SECRET}"))
    with pytest.raises(LLMUnavailableError) as raised:
        adapter(client).analyze_story(make_story(), AI_RULES)
    assert SECRET not in str(raised.value)


def test_identical_story_is_served_from_cache():
    client = FakeClient(ok_response("US-AC-004"))
    gemini = adapter(client)
    first = gemini.analyze_story(make_story(), AI_RULES)
    second = gemini.analyze_story(make_story(), AI_RULES)

    assert first == second
    assert len(client.calls) == 1


def test_different_story_is_not_cached():
    client = FakeClient(ok_response(), ok_response())
    gemini = adapter(client)
    gemini.analyze_story(make_story(), AI_RULES)
    gemini.analyze_story(make_story(title="Otra historia"), AI_RULES)
    assert len(client.calls) == 2


def test_failures_are_not_cached():
    client = FakeClient(api_error(503), ok_response("US-AC-004"))
    gemini = adapter(client)
    with pytest.raises(LLMUnavailableError):
        gemini.analyze_story(make_story(), AI_RULES)
    assert len(gemini.analyze_story(make_story(), AI_RULES).findings) == 1


def test_local_per_minute_limit_blocks_before_calling_the_api():
    client = FakeClient(ok_response(), ok_response())
    gemini = adapter(client, requests_per_minute=1, clock=lambda: 0.0)
    gemini.analyze_story(make_story(title="A"), AI_RULES)

    with pytest.raises(LLMUnavailableError, match="Límite local"):
        gemini.analyze_story(make_story(title="B"), AI_RULES)
    assert len(client.calls) == 1


def test_local_daily_limit_blocks_before_calling_the_api():
    client = FakeClient(ok_response(), ok_response())
    gemini = adapter(client, daily_limit=1, clock=lambda: 0.0)
    gemini.analyze_story(make_story(title="A"), AI_RULES)

    with pytest.raises(LLMUnavailableError, match="Límite local"):
        gemini.analyze_story(make_story(title="B"), AI_RULES)
    assert len(client.calls) == 1


def test_fallback_has_its_own_quota():
    client = FakeClient(ok_response(), ok_response())
    gemini = adapter(client, fallback_model="backup", requests_per_minute=1, clock=lambda: 0.0)
    first = gemini.analyze_story(make_story(title="A"), AI_RULES)
    second = gemini.analyze_story(make_story(title="B"), AI_RULES)  # primario agotado -> respaldo

    assert (first.model_name, second.model_name) == ("primary", "backup")


# --- Diseño de pruebas ---
from app.domain.entities import Technique  # noqa: E402
from app.infrastructure.llm.gemini import _CaseDTO, _CasesDTO, _GherkinDTO, _ScenarioDTO  # noqa: E402


def cases_response():
    case = _CaseDTO(
        title="Retiro menor al saldo",
        technique="scenario",
        criterion_index=1,
        preconditions="Saldo 500",
        steps=["Retirar 100"],
        test_data="",
        expected_result="Saldo 400",
        gherkin=None,
        priority="high",
    )
    return SimpleNamespace(
        parsed=_CasesDTO(cases=[case]),
        usage_metadata=SimpleNamespace(prompt_token_count=200, candidates_token_count=80),
    )


def test_generate_test_cases_uses_requested_techniques_and_higher_temperature():
    client = FakeClient(cases_response())
    result = adapter(client).generate_test_cases(
        make_story(), [Technique.BOUNDARY_VALUE, Technique.SCENARIO]
    )

    (call,) = client.calls
    system = call["config"].system_instruction
    assert "boundary_value" in system and "scenario" in system
    assert "decision_table" not in system  # solo las técnicas pedidas
    assert call["config"].temperature == pytest.approx(0.5)
    assert call["config"].response_schema is _CasesDTO
    assert result.cases[0].title == "Retiro menor al saldo"
    assert result.meta.prompt_version == "test-cases-v2"
    assert (result.meta.prompt_tokens, result.meta.output_tokens) == (200, 80)


def test_suggest_gherkin_returns_scenarios_and_meta():
    scenario = _ScenarioDTO(criterion_index=2, scenario="Escenario: x\nCuando a\nEntonces b")
    response = SimpleNamespace(parsed=_GherkinDTO(scenarios=[scenario]), usage_metadata=None)
    client = FakeClient(response)

    result = adapter(client).suggest_gherkin(make_story())

    assert result.scenarios[0].criterion_index == 2
    assert result.meta.prompt_version == "gherkin-v1"
    assert client.calls[0]["config"].temperature == pytest.approx(0.3)


def test_operations_do_not_share_cache_entries():
    client = FakeClient(ok_response(), cases_response())
    gemini = adapter(client)
    gemini.analyze_story(make_story(), AI_RULES)
    gemini.generate_test_cases(make_story(), [Technique.SCENARIO])
    assert len(client.calls) == 2


def test_test_case_generation_falls_back_like_the_analysis():
    client = FakeClient(api_error(429), cases_response())
    result = adapter(client, fallback_model="backup").generate_test_cases(
        make_story(), [Technique.SCENARIO]
    )
    assert result.meta.model_name == "backup"


# --- defecto ---
from app.domain.ports import DefectContext  # noqa: E402
from app.infrastructure.llm.gemini import _DefectDTO  # noqa: E402


def defect_response():
    dto = _DefectDTO(
        title="Se permite retirar más que el saldo",
        preconditions="Saldo 500",
        steps=["Elegir Retirar", "Ingresar 600"],
        expected_result="Saldo insuficiente",
        actual_result="Saldo -100",
        severity="major",
        priority="high",
    )
    return SimpleNamespace(
        parsed=dto, usage_metadata=SimpleNamespace(prompt_token_count=90, candidates_token_count=40)
    )


def test_draft_defect_uses_the_defect_prompt_and_low_temperature():
    from app.domain.entities import QATestCase

    case = QATestCase(
        title="Retiro", technique=Technique.SCENARIO, steps=("a",), expected_result="b"
    )
    context = DefectContext("Historia", case, "falló", "", "QA", "1.0")
    client = FakeClient(defect_response())

    result = adapter(client).draft_defect(context)

    (call,) = client.calls
    assert call["contents"].startswith("<defecto>")
    assert "ISO/IEC/IEEE 29119-3" in call["config"].system_instruction
    assert call["config"].temperature == pytest.approx(0.2)
    assert result.draft.severity == "major"
    assert result.meta.prompt_version == "defect-v1"
