import pytest

from app.domain.entities import (
    ChecklistPhase,
    DefectSeverity,
    Execution,
    ExecutionResult,
    Frequency,
    Priority,
    QASession,
    QATestCase,
    Recommendation,
    Technique,
)
from app.domain.ports import AIDefectDraft
from app.domain.qa_session import (
    CHECKLIST_TEMPLATE,
    PNG_SIGNATURE,
    build_base_defect,
    detect_image_extension,
    has_failures,
    is_safe_link,
    merge_ai_defect,
    pending_count,
    suggest_recommendation,
)

R = ExecutionResult


def execution(id: str, result: ExecutionResult, **kw) -> Execution:
    return Execution(id=id, session_id="s", test_case_id=f"c-{id}", result=result, **kw)


# --- checklist ---
def test_checklist_template_covers_the_three_phases():
    phases = {phase for phase, _ in CHECKLIST_TEMPLATE}
    assert phases == set(ChecklistPhase)
    assert len({text for _, text in CHECKLIST_TEMPLATE}) == len(CHECKLIST_TEMPLATE)


# --- recomendación ---
def test_no_suggestion_without_executions_or_with_pending_cases():
    assert suggest_recommendation([], {}) is None
    assert suggest_recommendation([execution("a", R.PASSED), execution("b", R.NOT_RUN)], {}) is None


def test_all_passed_suggests_accept():
    assert suggest_recommendation([execution("a", R.PASSED)], {}) == Recommendation.ACCEPT


@pytest.mark.parametrize(
    ("severity", "expected"),
    [
        (DefectSeverity.TRIVIAL, Recommendation.ACCEPT_WITH_MINOR_DEFECTS),
        (DefectSeverity.MINOR, Recommendation.ACCEPT_WITH_MINOR_DEFECTS),
        (DefectSeverity.MAJOR, Recommendation.REJECT),
        (DefectSeverity.CRITICAL, Recommendation.REJECT),
    ],
)
def test_failures_are_judged_by_defect_severity(severity, expected):
    executions = [execution("a", R.PASSED), execution("b", R.FAILED)]
    assert suggest_recommendation(executions, {"b": severity}) == expected


def test_failure_without_a_registered_defect_is_treated_conservatively():
    assert suggest_recommendation([execution("a", R.FAILED)], {}) == Recommendation.REJECT


def test_blocked_cases_always_reject():
    executions = [execution("a", R.BLOCKED)]
    assert suggest_recommendation(executions, {"a": DefectSeverity.TRIVIAL}) == (
        Recommendation.REJECT
    )


def test_one_major_failure_among_minor_ones_rejects():
    executions = [execution("a", R.FAILED), execution("b", R.FAILED)]
    severities = {"a": DefectSeverity.MINOR, "b": DefectSeverity.MAJOR}
    assert suggest_recommendation(executions, severities) == Recommendation.REJECT


def test_counters():
    executions = [execution("a", R.PASSED), execution("b", R.NOT_RUN), execution("c", R.FAILED)]
    assert pending_count(executions) == 1
    assert has_failures(executions) and not has_failures(executions[:2])


# --- defecto base ---
SESSION = QASession(
    id="s",
    story_id="st",
    environment_name="QA",
    environment_url="https://qa.example.com",
    build_version="1.4.2",
    tester_name="Ana",
    started_at=__import__("datetime").datetime(2026, 1, 1),
)


def case(priority=Priority.HIGH) -> QATestCase:
    return QATestCase(
        title="Retiro mayor al saldo",
        technique=Technique.BOUNDARY_VALUE,
        steps=("Elegir Retirar", "Ingresar 600"),
        expected_result="Se muestra Saldo insuficiente",
        preconditions="Saldo 500",
        priority=priority,
    )


def test_base_defect_uses_only_real_session_data():
    failed = execution("a", R.FAILED, actual_result="El saldo queda en -100")
    defect = build_base_defect(case(), failed, SESSION)

    assert defect.title == "Falla en: Retiro mayor al saldo"
    assert defect.steps == ("Elegir Retirar", "Ingresar 600")
    assert defect.expected_result == "Se muestra Saldo insuficiente"
    assert defect.actual_result == "El saldo queda en -100"
    assert defect.environment == "QA (https://qa.example.com)"
    assert defect.build_version == "1.4.2"
    assert defect.frequency == Frequency.ALWAYS
    assert defect.ai_assisted is False


@pytest.mark.parametrize(
    ("priority", "severity"),
    [
        (Priority.HIGH, DefectSeverity.MAJOR),
        (Priority.MEDIUM, DefectSeverity.MINOR),
        (Priority.LOW, DefectSeverity.TRIVIAL),
    ],
)
def test_base_defect_severity_follows_case_priority(priority, severity):
    assert build_base_defect(case(priority), execution("a", R.FAILED), SESSION).severity == severity


def test_base_defect_falls_back_to_notes_then_to_a_placeholder():
    with_notes = execution("a", R.FAILED, notes="se cuelga")
    assert build_base_defect(case(), with_notes, SESSION).actual_result == "se cuelga"
    empty = execution("a", R.FAILED)
    assert "sin descripción" in build_base_defect(case(), empty, SESSION).actual_result


# --- mezcla con la IA ---
def ai(**overrides) -> AIDefectDraft:
    base = {
        "title": "Se permite retirar más que el saldo",
        "preconditions": "Cuenta con saldo 500",
        "steps": ["Elegir Retirar", "Ingresar 600", "Confirmar"],
        "expected_result": "Se muestra el error",
        "actual_result": "El saldo queda en -100",
        "severity": "critical",
        "priority": "high",
    }
    return AIDefectDraft(**{**base, **overrides})


def base_defect():
    return build_base_defect(case(), execution("a", R.FAILED, actual_result="x"), SESSION)


def test_ai_wording_replaces_the_base_and_marks_the_defect():
    merged = merge_ai_defect(base_defect(), ai())
    assert merged.title == "Se permite retirar más que el saldo"
    assert merged.steps[-1] == "Confirmar"
    assert merged.ai_assisted is True


def test_ai_never_changes_severity_or_priority():
    base = base_defect()
    merged = merge_ai_defect(base, ai(severity="critical", priority="low"))
    assert base.severity != DefectSeverity.CRITICAL  # la prueba solo vale si la IA difiere
    assert (merged.severity, merged.priority) == (base.severity, base.priority)


def test_ai_never_changes_environment_build_or_frequency():
    base = base_defect()
    merged = merge_ai_defect(base, ai())
    assert (merged.environment, merged.build_version, merged.frequency) == (
        base.environment,
        base.build_version,
        base.frequency,
    )


def test_invalid_or_empty_ai_fields_fall_back_to_the_base():
    base = base_defect()
    merged = merge_ai_defect(
        base,
        ai(title="  ", steps=["", " "], severity="apocalíptica", priority="ya", actual_result=""),
    )
    assert merged.title == base.title
    assert merged.steps == base.steps
    assert merged.severity == base.severity and merged.priority == base.priority
    assert merged.actual_result == base.actual_result


def test_ai_title_is_capped():
    assert len(merge_ai_defect(base_defect(), ai(title="x" * 400)).title) == 150


# --- imágenes y enlaces ---
@pytest.mark.parametrize(
    ("content", "extension"),
    [
        (PNG_SIGNATURE + b"\x00" * 16, "png"),
        (b"\xff\xd8\xff\xe0" + b"\x00" * 16, "jpg"),
        (b"RIFF\x24\x00\x00\x00WEBPVP8 ", "webp"),
        (b"GIF89a" + b"\x00" * 16, None),
        (b"<script>alert(1)</script>", None),
        (b"%PDF-1.7", None),
        (b"", None),
    ],
)
def test_image_type_is_detected_from_content(content, extension):
    assert detect_image_extension(content) == extension


@pytest.mark.parametrize(
    ("url", "safe"),
    [
        ("https://qa.example.com/ticket/1", True),
        ("http://localhost:8000/x", True),
        ("  https://example.com  ", True),
        ("javascript:alert(1)", False),
        ("data:text/html,<script>1</script>", False),
        ("file:///etc/passwd", False),
        ("ftp://example.com/x", False),
        ("https://", False),
        ("example.com", False),
        ("", False),
        ("https://example.com/" + "a" * 600, False),
    ],
)
def test_links_must_be_http_or_https(url, safe):
    assert is_safe_link(url) is safe
