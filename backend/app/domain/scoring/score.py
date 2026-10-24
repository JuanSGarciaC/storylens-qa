from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from app.domain.entities import Decision, Finding, Severity


class Verdict(StrEnum):
    READY = "ready"
    READY_WITH_NOTES = "ready_with_notes"
    NOT_READY = "not_ready"


PENALTY: dict[Severity, int] = {
    Severity.BLOCKING: 30,
    Severity.MAJOR: 10,
    Severity.MINOR: 4,
    Severity.INFO: 0,
}
NOT_READY_BELOW = 60
READY_FROM = 85


@dataclass(frozen=True)
class Score:
    value: int
    verdict: Verdict


def calculate_score(findings: Iterable[Finding]) -> Score:
    """Puntaje 0–100. Los hallazgos descartados por el usuario no penalizan."""
    active = [f for f in findings if f.decision != Decision.DISMISSED]
    value = max(0, 100 - sum(PENALTY[f.severity] for f in active))
    has_blocking = any(f.severity == Severity.BLOCKING for f in active)
    if has_blocking or value < NOT_READY_BELOW:
        verdict = Verdict.NOT_READY
    elif value < READY_FROM:
        verdict = Verdict.READY_WITH_NOTES
    else:
        verdict = Verdict.READY
    return Score(value=value, verdict=verdict)
