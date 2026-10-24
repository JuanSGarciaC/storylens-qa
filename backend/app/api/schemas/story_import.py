from pydantic import BaseModel

from app.api.schemas.analysis import StoryOut


class ImportRowOut(BaseModel):
    index: int
    key: str
    title: str
    description: str
    acceptance_criteria: list[str]
    issues: list[str]
    duplicate: bool
    importable: bool


class ImportPreviewOut(BaseModel):
    format: str
    headers: list[str]
    mapping: dict[str, str | None]
    rows: list[ImportRowOut]
    truncated: bool


class ImportResultOut(BaseModel):
    created: list[StoryOut]
