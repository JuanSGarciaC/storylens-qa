from dataclasses import dataclass
from enum import StrEnum


class Technique(StrEnum):
    """Técnicas de diseño de pruebas de caja negra (ISTQB CTFL v4.0)."""

    EQUIVALENCE_PARTITIONING = "equivalence_partitioning"
    BOUNDARY_VALUE = "boundary_value"
    DECISION_TABLE = "decision_table"
    STATE_TRANSITION = "state_transition"
    SCENARIO = "scenario"
    ERROR_GUESSING = "error_guessing"


class Priority(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CaseOrigin(StrEnum):
    AI = "ai"
    USER = "user"


class CaseStatus(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


@dataclass(frozen=True)
class QATestCase:
    title: str
    technique: Technique
    steps: tuple[str, ...]
    expected_result: str
    criterion_index: int | None = None  # posición 1-based del criterio que cubre
    preconditions: str = ""
    test_data: str = ""
    gherkin: str | None = None
    priority: Priority = Priority.MEDIUM
    origin: CaseOrigin = CaseOrigin.USER
    status: CaseStatus = CaseStatus.PROPOSED
    id: str | None = None  # los asigna la persistencia
    story_id: str | None = None
