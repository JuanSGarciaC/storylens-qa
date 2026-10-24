from app.domain.entities import CaseOrigin, CaseStatus, Priority, QATestCase, Technique
from app.domain.ports import AIGherkinDraft, AITestCaseDraft
from app.domain.test_design import (
    MAX_CASES,
    MAX_STEPS,
    build_gherkin,
    build_test_cases,
    build_traceability,
)
from tests.conftest import make_story

STORY = make_story()  # 3 criterios
ALL = list(Technique)


def draft(**overrides) -> AITestCaseDraft:
    base = {
        "title": "Solicitar enlace con correo registrado",
        "technique": "scenario",
        "criterion_index": 1,
        "preconditions": "Usuario registrado",
        "steps": ["Abrir recuperar contraseña", "Ingresar correo", "Enviar"],
        "test_data": "correo=ana@example.com",
        "expected_result": "Llega un enlace que expira en 30 minutos",
        "gherkin": None,
        "priority": "high",
    }
    return AITestCaseDraft(**{**base, **overrides})


def build(*drafts, allowed=ALL):
    return build_test_cases(STORY, drafts, allowed)


def test_valid_draft_becomes_a_proposed_ai_case():
    result = build(draft())
    (case,) = result.cases
    assert not result.discarded
    assert case.origin == CaseOrigin.AI and case.status == CaseStatus.PROPOSED
    assert case.technique == Technique.SCENARIO and case.priority == Priority.HIGH
    assert case.criterion_index == 1
    assert case.steps == ("Abrir recuperar contraseña", "Ingresar correo", "Enviar")


def test_unknown_technique_is_discarded():
    result = build(draft(technique="magia_negra"))
    assert result.cases == [] and result.discarded["unknown_technique"] == 1


def test_technique_that_was_not_requested_is_discarded():
    result = build(draft(technique="boundary_value"), allowed=[Technique.SCENARIO])
    assert result.cases == [] and result.discarded["technique_not_requested"] == 1


def test_incomplete_cases_are_discarded():
    result = build(
        draft(title="  "),
        draft(title="B", steps=[]),
        draft(title="C", steps=["  ", ""]),
        draft(title="D", expected_result=" "),
    )
    assert result.cases == [] and result.discarded["incomplete"] == 4


def test_criterion_outside_the_story_is_unlinked_not_discarded():
    cases = build(draft(criterion_index=99), draft(title="Otro", criterion_index=0)).cases
    assert [c.criterion_index for c in cases] == [None, None]


def test_criterion_none_is_kept_as_none():
    assert build(draft(criterion_index=None)).cases[0].criterion_index is None


def test_unknown_priority_falls_back_to_medium():
    assert build(draft(priority="urgentísima")).cases[0].priority == Priority.MEDIUM


def test_duplicate_titles_are_discarded_ignoring_case_and_spacing():
    result = build(draft(), draft(title="  SOLICITAR  enlace con correo REGISTRADO "))
    assert len(result.cases) == 1 and result.discarded["duplicate"] == 1


def test_cases_and_steps_are_capped():
    many = [draft(title=f"Caso {i}") for i in range(MAX_CASES + 5)]
    result = build(*many)
    assert len(result.cases) == MAX_CASES and result.discarded["over_limit"] == 5

    long_steps = build(draft(steps=[f"paso {i}" for i in range(MAX_STEPS + 10)])).cases[0]
    assert len(long_steps.steps) == MAX_STEPS


def test_blank_gherkin_becomes_none():
    assert build(draft(gherkin="   ")).cases[0].gherkin is None


# --- Gherkin ---
def scenario(text, index=1):
    return AIGherkinDraft(criterion_index=index, scenario=text)


def test_gherkin_requires_when_and_then():
    good = "Escenario: ok\nDado un usuario\nCuando solicito\nEntonces veo el enlace"
    no_then = "Escenario: mal\nDado un usuario\nCuando solicito"
    prose = "El usuario recibe un enlace"
    result = build_gherkin(STORY, [scenario(good), scenario(no_then), scenario(prose)])
    assert [s.text for s in result] == [good]


def test_gherkin_accepts_english_keywords_and_validates_index():
    text = "Scenario: ok\nGiven a user\nWhen I ask\nThen I see it"
    (result,) = build_gherkin(STORY, [scenario(text, index=7)])
    assert result.criterion_index is None


# --- Trazabilidad ---
def case(id, index, status):
    return QATestCase(
        id=id,
        story_id="s",
        title=id,
        technique=Technique.SCENARIO,
        steps=("x",),
        expected_result="y",
        criterion_index=index,
        status=status,
    )


def test_traceability_groups_cases_by_criterion_and_status():
    trace = build_traceability(
        STORY,
        [
            case("a", 1, CaseStatus.ACCEPTED),
            case("b", 1, CaseStatus.PROPOSED),
            case("c", 2, CaseStatus.PROPOSED),
            case("d", 3, CaseStatus.REJECTED),
        ],
    )
    first, second, third = trace.rows
    assert (first.accepted_ids, first.proposed_ids, first.covered) == (["a"], ["b"], True)
    assert (second.accepted_ids, second.proposed_ids, second.covered) == ([], ["c"], False)
    assert (third.accepted_ids, third.proposed_ids, third.covered) == ([], [], False)
    assert trace.coverage == 1 / 3


def test_traceability_lists_active_unlinked_cases_only():
    trace = build_traceability(
        STORY,
        [
            case("x", None, CaseStatus.PROPOSED),
            case("y", None, CaseStatus.ACCEPTED),
            case("z", None, CaseStatus.REJECTED),
        ],
    )
    assert trace.unlinked_ids == ["x", "y"]
    assert trace.coverage == 0.0


def test_traceability_of_a_story_without_criteria_has_zero_coverage():
    trace = build_traceability(make_story(criteria=[]), [])
    assert trace.rows == [] and trace.coverage == 0.0
