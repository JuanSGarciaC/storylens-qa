from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.domain.entities.evaluation import EvaluationMode


class EvaluationStartIn(BaseModel):
    mode: EvaluationMode


class EvaluationRunOut(BaseModel):
    id: str
    project_id: str
    mode: str
    status: str
    actor: str
    created_at: datetime
    finished_at: datetime | None
    catalog_version: str
    model_name: str | None
    prompt_version: str | None
    total: int
    processed: int
    metrics: dict[str, Any]
    details: dict[str, Any]
    note: str


class EvaluationInfoOut(BaseModel):
    """Lo que la pantalla necesita saber antes de ejecutar una evaluación."""

    golden_stories: int
    injection_cases: int
    ai_available: bool
    ai_quota_remaining_today: int | None
