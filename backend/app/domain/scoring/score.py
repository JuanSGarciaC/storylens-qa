from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from app.domain.entities import Decision, Finding, ProjectSettings, Severity


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


def calculate_score(findings: Iterable[Finding], settings: ProjectSettings | None = None) -> Score:
    """Puntaje 0–100. Los hallazgos descartados por el usuario no penalizan.

    `settings` ajusta pesos y umbrales por proyecto; un bloqueante siempre deja la historia
    "no lista", sin importar lo permisivos que sean los umbrales.
    """
    settings = settings or ProjectSettings()
    overrides = settings.penalties or {}

    def penalty(severity: Severity) -> int:
        return overrides.get(severity.value, PENALTY[severity])

    active = [f for f in findings if f.decision != Decision.DISMISSED]
    value = max(0, 100 - sum(penalty(f.severity) for f in active))
    has_blocking = any(f.severity == Severity.BLOCKING for f in active)
    if has_blocking or value < settings.not_ready_below:
        verdict = Verdict.NOT_READY
    elif value < settings.ready_from:
        verdict = Verdict.READY_WITH_NOTES
    else:
        verdict = Verdict.READY
    return Score(value=value, verdict=verdict)
