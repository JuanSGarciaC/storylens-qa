from pydantic import BaseModel


class MetricOut(BaseModel):
    id: str
    label: str
    definition: str
    numerator: float | None
    denominator: float | None
    value: float | None
    unit: str


class BreakdownItemOut(BaseModel):
    key: str
    count: int


class BreakdownOut(BaseModel):
    id: str
    label: str
    items: list[BreakdownItemOut]


class MetricsOut(BaseModel):
    metrics: list[MetricOut]
    breakdowns: list[BreakdownOut]


class MatrixCaseOut(BaseModel):
    id: str
    title: str


class MatrixRowOut(BaseModel):
    story_id: str
    story_title: str
    criterion_index: int
    criterion: str
    cases: list[MatrixCaseOut]
    last_result: str | None
    defects: int


class MatrixOut(BaseModel):
    total: int  # filas que tiene la matriz completa (para paginar)
    rows: list[MatrixRowOut]


class ChangedStoryOut(BaseModel):
    from_id: str
    to_id: str
    what: list[str]


class VersionStoryOut(BaseModel):
    id: str
    title: str


class VersionComparisonOut(BaseModel):
    added: list[VersionStoryOut]
    removed: list[VersionStoryOut]
    changed: list[ChangedStoryOut]
    unchanged: int
