from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class ProjectSettingsIO(BaseModel):
    disabled_rules: list[str] = Field(default_factory=list, max_length=100)
    penalties: dict[str, int] | None = None
    not_ready_below: int = Field(default=60, ge=0, le=100)
    ready_from: int = Field(default=85, ge=0, le=100)


class ProjectIn(BaseModel):
    name: Name
    description: str = Field(default="", max_length=2000)
    objective: str = Field(default="", max_length=2000)


class ProjectPatch(BaseModel):
    name: Name | None = None
    description: str | None = Field(default=None, max_length=2000)
    objective: str | None = Field(default=None, max_length=2000)
    settings: ProjectSettingsIO | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    description: str
    objective: str
    settings: ProjectSettingsIO
    is_demo: bool
    created_at: datetime


class NamedIn(BaseModel):
    name: Name


class NamedOut(BaseModel):
    id: str
    project_id: str
    name: str
