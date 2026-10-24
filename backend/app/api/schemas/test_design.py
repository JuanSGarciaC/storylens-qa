from pydantic import BaseModel, Field

from app.domain.entities import CaseOrigin, CaseStatus, Priority, Technique


class CaseIn(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    technique: Technique
    steps: list[str] = Field(min_length=1, max_length=12)
    expected_result: str = Field(min_length=1, max_length=500)
    criterion_index: int | None = None
    preconditions: str = Field(default="", max_length=500)
    test_data: str = Field(default="", max_length=500)
    gherkin: str | None = Field(default=None, max_length=1000)
    priority: Priority = Priority.MEDIUM


class CaseUpdate(BaseModel):
    """Todos los campos son opcionales: solo se cambian los que se envían."""

    title: str | None = Field(default=None, min_length=1, max_length=150)
    technique: Technique | None = None
    steps: list[str] | None = Field(default=None, min_length=1, max_length=12)
    expected_result: str | None = Field(default=None, min_length=1, max_length=500)
    criterion_index: int | None = None
    preconditions: str | None = Field(default=None, max_length=500)
    test_data: str | None = Field(default=None, max_length=500)
    gherkin: str | None = Field(default=None, max_length=1000)
    priority: Priority | None = None
    status: CaseStatus | None = None


class CaseOut(BaseModel):
    id: str
    story_id: str
    title: str
    technique: Technique
    criterion_index: int | None
    preconditions: str
    steps: list[str]
    test_data: str
    expected_result: str
    gherkin: str | None
    priority: Priority
    origin: CaseOrigin
    status: CaseStatus


class GenerateCasesRequest(BaseModel):
    techniques: list[Technique] = Field(default_factory=list, description="Vacío = todas")


class TraceRowOut(BaseModel):
    index: int
    text: str
    accepted_ids: list[str]
    proposed_ids: list[str]
    covered: bool


class TraceabilityOut(BaseModel):
    rows: list[TraceRowOut]
    unlinked_ids: list[str]
    coverage: float


class ScenarioOut(BaseModel):
    criterion_index: int | None
    text: str


class GherkinOut(BaseModel):
    scenarios: list[ScenarioOut]
    model_name: str | None
    prompt_version: str | None
