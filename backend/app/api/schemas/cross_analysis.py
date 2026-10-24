from pydantic import BaseModel


class DuplicateOut(BaseModel):
    a_id: str
    b_id: str
    similarity: float


class DependencyOut(BaseModel):
    from_id: str
    to_id: str
    evidence: str


class ContradictionOut(BaseModel):
    a_id: str
    b_id: str
    reason: str
    is_hypothesis: bool = True  # siempre: el sistema sospecha, no afirma


class EpicRiskOut(BaseModel):
    epic_id: str | None
    epic_name: str
    stories: int
    analyzed: int
    not_ready: int
    without_cases: int
    average_score: float | None
    level: str
    reason: str


class StoryRefOut(BaseModel):
    id: str
    title: str


class CrossAnalysisOut(BaseModel):
    total_stories: int
    stories: list[StoryRefOut]  # para mostrar títulos en cada hallazgo
    duplicates: list[DuplicateOut]
    dependencies: list[DependencyOut]
    contradictions: list[ContradictionOut]
    epic_risks: list[EpicRiskOut]
    without_cases: list[str]
