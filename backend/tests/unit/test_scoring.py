import pytest

from app.domain.entities import Decision, Finding, Severity, Source
from app.domain.scoring import Verdict, calculate_score


def finding(severity: Severity, decision: Decision = Decision.PENDING) -> Finding:
    return Finding("X", Source.RULE, severity, "m", "s", "r", decision=decision)


def test_no_findings_is_ready():
    score = calculate_score([])
    assert (score.value, score.verdict) == (100, Verdict.READY)


@pytest.mark.parametrize(
    ("severities", "value", "verdict"),
    [
        ([Severity.MINOR], 96, Verdict.READY),
        ([Severity.MAJOR, Severity.MAJOR], 80, Verdict.READY_WITH_NOTES),
        ([Severity.MAJOR] * 4, 60, Verdict.READY_WITH_NOTES),
        ([Severity.MAJOR] * 5, 50, Verdict.NOT_READY),
        ([Severity.INFO], 100, Verdict.READY),
    ],
)
def test_penalties_and_thresholds(severities, value, verdict):
    score = calculate_score([finding(s) for s in severities])
    assert (score.value, score.verdict) == (value, verdict)


def test_blocking_forces_not_ready_even_with_high_score():
    score = calculate_score([finding(Severity.BLOCKING)])
    assert score.value == 70
    assert score.verdict == Verdict.NOT_READY


def test_dismissed_findings_do_not_penalize():
    score = calculate_score([finding(Severity.BLOCKING, Decision.DISMISSED)])
    assert (score.value, score.verdict) == (100, Verdict.READY)


def test_score_never_below_zero():
    assert calculate_score([finding(Severity.BLOCKING)] * 5).value == 0
