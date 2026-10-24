from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.domain.entities.test_case import Priority


class ChecklistPhase(StrEnum):
    PREPARATION = "preparation"
    EXECUTION = "execution"
    CLOSURE = "closure"


class ExecutionResult(StrEnum):
    NOT_RUN = "not_run"
    PASSED = "passed"
    FAILED = "failed"
    BLOCKED = "blocked"


class EvidenceType(StrEnum):
    IMAGE = "image"
    LINK = "link"
    NOTE = "note"


class Recommendation(StrEnum):
    ACCEPT = "accept"
    ACCEPT_WITH_MINOR_DEFECTS = "accept_with_minor_defects"
    REJECT = "reject"


class DefectSeverity(StrEnum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    TRIVIAL = "trivial"


class Frequency(StrEnum):
    ALWAYS = "always"
    INTERMITTENT = "intermittent"


@dataclass(frozen=True)
class QASession:
    id: str
    story_id: str
    environment_name: str
    environment_url: str
    build_version: str
    tester_name: str
    started_at: datetime
    closed_at: datetime | None = None
    recommendation: Recommendation | None = None
    summary: str = ""

    @property
    def closed(self) -> bool:
        return self.closed_at is not None


@dataclass(frozen=True)
class ChecklistItem:
    id: str
    session_id: str
    phase: ChecklistPhase
    text: str
    checked: bool = False
    note: str = ""


@dataclass(frozen=True)
class Execution:
    id: str
    session_id: str
    test_case_id: str
    result: ExecutionResult = ExecutionResult.NOT_RUN
    actual_result: str = ""
    notes: str = ""
    executed_at: datetime | None = None


@dataclass(frozen=True)
class Evidence:
    id: str
    execution_id: str
    type: EvidenceType
    uri: str  # imagen: nombre del archivo guardado · enlace: la URL · nota: vacío
    description: str  # imagen/enlace: descripción · nota: el texto de la nota
    uploaded_at: datetime


@dataclass(frozen=True)
class DefectFields:
    """Contenido de un defecto, sin identidad. Plantilla de ISO/IEC/IEEE 29119-3."""

    title: str
    preconditions: str
    steps: tuple[str, ...]
    expected_result: str
    actual_result: str
    severity: DefectSeverity
    priority: Priority
    frequency: Frequency
    environment: str
    build_version: str
    ai_assisted: bool = False


@dataclass(frozen=True)
class DefectDraft:
    id: str
    execution_id: str
    fields: DefectFields
    created_at: datetime
