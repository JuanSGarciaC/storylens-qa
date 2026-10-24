from app.domain.evaluation import (
    INJECTION_CASES,
    StoryOutcome,
    check_injection,
    diffs,
    ratios,
    score,
)


def outcome(id, expected, found, found_ai=(), ai_status="not_requested"):
    return StoryOutcome(id, frozenset(expected), frozenset(found), frozenset(found_ai), ai_status)


DET = {"R1", "R2"}
AI = {"A1", "A2"}


def test_ratios_handle_empty_denominators():
    assert ratios(0, 0, 0).precision == 1.0 and ratios(0, 0, 0).recall == 1.0
    metrics = ratios(2, 1, 1)
    assert (metrics.precision, metrics.recall) == (0.6667, 0.6667)
    assert metrics.f1 == 0.6667


def test_deterministic_metrics_count_hits_extras_and_misses():
    outcomes = [
        outcome("a", {"R1", "R2"}, {"R1"}),  # R2 faltó
        outcome("b", set(), {"R2"}),  # R2 sobró
    ]
    det = score(outcomes, DET, AI)["det"]
    assert (det.tp, det.fp, det.fn) == (1, 1, 1)


def test_ai_metrics_ignore_stories_where_the_ai_did_not_answer():
    outcomes = [
        outcome("a", {"A1"}, {"A1"}, {"A1"}, ai_status="ok"),
        outcome("b", {"A1"}, set(), set(), ai_status="unavailable"),  # no cuenta
    ]
    ai = score(outcomes, DET, AI)["ai"]
    assert (ai.tp, ai.fp, ai.fn) == (1, 0, 0)


def test_diffs_only_report_differences_within_scored_rules():
    outcomes = [
        outcome("ok", {"R1"}, {"R1"}),
        outcome("falta", {"R1", "A1"}, set()),
        outcome("sobra", set(), {"R2"}),
    ]
    result = diffs(outcomes, DET)  # sin reglas de IA en el alcance
    assert [(d.id, d.missing, d.extra) for d in result] == [
        ("falta", ["R1"], []),
        ("sobra", [], ["R2"]),
    ]


def test_injection_passes_only_when_the_ai_answered_and_ignored_the_order():
    case = INJECTION_CASES[0]
    assert check_injection(case, ["Falta un criterio"], "ok").status == "passed"
    assert check_injection(case, [f"... {case.canary.lower()} ..."], "ok").status == "failed"
    assert check_injection(case, [], "unavailable").status == "not_evaluable"


def test_every_injection_case_has_its_own_canary_inside_the_story():
    for case in INJECTION_CASES:
        assert case.canary in case.description
    assert len({c.canary for c in INJECTION_CASES}) == len(INJECTION_CASES)
