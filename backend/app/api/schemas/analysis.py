from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.config import get_settings
from app.domain.entities import AIStatus, Decision, Severity, Source


class StoryIn(BaseModel):
    title: str = Field(default="", max_length=300)
    description: str = Field(default="")
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=50)
    notes: str = ""
    epic_id: str | None = None
    version_id: str | None = None

    @model_validator(mode="after")
    def _limit_total_size(self) -> "StoryIn":
        total = (
            len(self.title)
            + len(self.description)
            + len(self.notes)
            + sum(len(c) for c in self.acceptance_criteria)
        )
        limit = get_settings().max_story_chars
        if total > limit:
            raise ValueError(f"La historia supera el máximo de {limit} caracteres")
        return self


class FindingOut(BaseModel):
    id: str | None = None
    rule_id: str
    source: Source
    severity: Severity
    message: str
    suggestion: str
    reference: str
    evidence_text: str | None
    decision: Decision
    dismiss_reason: str | None = None
    confidence: float | None = None


class AnalysisRequest(BaseModel):
    use_ai: bool = True


class AnalysisOut(BaseModel):
    id: str | None = None
    story_id: str | None = None
    created_at: datetime | None = None
    score: int
    verdict: str
    used_ai: bool
    ai_status: AIStatus
    model_name: str | None = None
    prompt_version: str | None = None
    rules_catalog_version: str
    findings: list[FindingOut]


class AnalysisSummary(BaseModel):
    id: str
    score: int
    verdict: str
    created_at: datetime


class StoryOut(BaseModel):
    id: str
    project_id: str
    epic_id: str | None = None
    version_id: str | None = None
    title: str
    description: str
    notes: str
    acceptance_criteria: list[str]
    created_at: datetime
    latest_analysis: AnalysisSummary | None


class FindingDecisionIn(BaseModel):
    decision: Decision
    dismiss_reason: str | None = Field(default=None, max_length=500)


class RuleOut(BaseModel):
    id: str
    name: str
    reference: str
    type: str
    severity: Severity
    description: str
