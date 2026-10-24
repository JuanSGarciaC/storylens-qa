from dataclasses import dataclass
from enum import StrEnum


class Severity(StrEnum):
    BLOCKING = "blocking"
    MAJOR = "major"
    MINOR = "minor"
    INFO = "info"


class Source(StrEnum):
    RULE = "rule"
    AI = "ai"


class Decision(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class AIStatus(StrEnum):
    NOT_REQUESTED = "not_requested"
    OK = "ok"
    UNAVAILABLE = "unavailable"  # sin configurar, límite alcanzado, red o servicio caído
    INVALID_RESPONSE = "invalid_response"  # la IA respondió algo que no cumple el esquema


@dataclass(frozen=True)
class Finding:
    rule_id: str
    source: Source
    severity: Severity
    message: str
    suggestion: str
    reference: str
    evidence_text: str | None = None
    decision: Decision = Decision.PENDING
    dismiss_reason: str | None = None
    id: str | None = None  # lo asigna la persistencia
    confidence: float | None = None  # solo hallazgos de IA, 0–1
