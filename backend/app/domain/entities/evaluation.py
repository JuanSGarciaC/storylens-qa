from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class EvaluationMode(StrEnum):
    RULES = "rules"  # solo reglas determinísticas: sin red, sin cuota
    RULES_AI = "rules_ai"  # reglas + IA: consume cuota de Gemini
    INJECTION = "injection"  # pruebas de inyección de instrucciones: consume cuota


class EvaluationStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    INCOMPLETE = "incomplete"  # terminó, pero la IA dejó de responder o se agotó la cuota
    FAILED = "failed"
    INTERRUPTED = "interrupted"  # el servidor se reinició a mitad de la corrida

    @property
    def active(self) -> bool:
        return self is EvaluationStatus.RUNNING


@dataclass(frozen=True)
class EvaluationRun:
    id: str
    project_id: str
    mode: EvaluationMode
    status: EvaluationStatus
    actor: str
    created_at: datetime
    catalog_version: str = ""
    model_name: str | None = None
    prompt_version: str | None = None
    total: int = 0  # historias o casos que hay que evaluar
    processed: int = 0
    metrics: dict[str, Any] = field(default_factory=dict)
    details: dict[str, Any] = field(default_factory=dict)
    note: str = ""
    finished_at: datetime | None = None
