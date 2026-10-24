from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.entities import (
    AIStatus,
    ChecklistPhase,
    DefectSeverity,
    EvidenceType,
    ExecutionResult,
    Frequency,
    Priority,
    Recommendation,
    Technique,
)


class SessionIn(BaseModel):
    environment_name: str = Field(min_length=1, max_length=100)
    environment_url: str = Field(min_length=1, max_length=500)
    build_version: str = Field(default="", max_length=100)
    tester_name: str = Field(default="", max_length=100)


class SessionSummaryOut(BaseModel):
    id: str
    story_id: str
    environment_name: str
    environment_url: str
    build_version: str
    tester_name: str
    started_at: datetime
    closed_at: datetime | None
    recommendation: Recommendation | None
    summary: str


class ChecklistItemOut(BaseModel):
    id: str
    phase: ChecklistPhase
    text: str
    checked: bool
    note: str


class ChecklistUpdate(BaseModel):
    checked: bool | None = None
    note: str | None = Field(default=None, max_length=1000)


class EvidenceOut(BaseModel):
    id: str
    execution_id: str
    type: EvidenceType
    description: str
    uploaded_at: datetime
    url: str | None = Field(description="Imagen: ruta del archivo · enlace: la URL · nota: null")


class EvidenceIn(BaseModel):
    """Nota o enlace. Las imágenes se suben por su propio endpoint (multipart)."""

    type: Literal["note", "link"]
    text: str = Field(default="", max_length=1000, description="Texto de la nota")
    url: str = Field(default="", max_length=500, description="URL del enlace")
    description: str = Field(default="", max_length=1000)


class DefectOut(BaseModel):
    id: str
    execution_id: str
    title: str
    preconditions: str
    steps: list[str]
    expected_result: str
    actual_result: str
    severity: DefectSeverity
    priority: Priority
    frequency: Frequency
    environment: str
    build_version: str
    ai_assisted: bool
    created_at: datetime


class DefectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    preconditions: str | None = Field(default=None, max_length=1000)
    steps: list[str] | None = Field(default=None, min_length=1, max_length=12)
    expected_result: str | None = Field(default=None, max_length=1000)
    actual_result: str | None = Field(default=None, max_length=1000)
    severity: DefectSeverity | None = None
    priority: Priority | None = None
    frequency: Frequency | None = None


class DefectDraftRequest(BaseModel):
    use_ai: bool = True


class DefectDraftOut(BaseModel):
    defect: DefectOut
    ai_status: AIStatus


class ExecutionUpdate(BaseModel):
    result: ExecutionResult | None = None
    actual_result: str | None = Field(default=None, max_length=1000)
    notes: str | None = Field(default=None, max_length=1000)


class ExecutionOut(BaseModel):
    id: str
    test_case_id: str
    case_title: str
    technique: Technique | None
    criterion_index: int | None
    preconditions: str
    steps: list[str]
    expected_result: str
    result: ExecutionResult
    actual_result: str
    notes: str
    executed_at: datetime | None
    evidences: list[EvidenceOut]
    defect: DefectOut | None


class ResultCounts(BaseModel):
    passed: int
    failed: int
    blocked: int
    not_run: int


class SessionDetailOut(SessionSummaryOut):
    checklist: list[ChecklistItemOut]
    executions: list[ExecutionOut]
    counts: ResultCounts
    pending: int
    suggested_recommendation: Recommendation | None


class CloseRequest(BaseModel):
    recommendation: Recommendation
    summary: str = Field(default="", max_length=2000)
