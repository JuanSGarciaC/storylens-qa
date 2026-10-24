from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class UserRow(SQLModel, table=True):
    __tablename__ = "app_user"

    id: str = Field(primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime


class ProjectRow(SQLModel, table=True):
    __tablename__ = "project"

    id: str = Field(primary_key=True)
    name: str
    description: str = ""
    objective: str = ""
    settings: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    is_demo: bool = Field(default=False, index=True)
    owner_id: str | None = Field(default=None, index=True)
    created_at: datetime


class EpicRow(SQLModel, table=True):
    __tablename__ = "epic"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    name: str


class VersionRow(SQLModel, table=True):
    __tablename__ = "version"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    name: str


class AuditEventRow(SQLModel, table=True):
    __tablename__ = "audit_event"

    id: int | None = Field(default=None, primary_key=True)  # autoincremental: da el orden
    at: datetime
    actor: str
    action: str
    entity: str
    entity_id: str
    project_id: str | None = Field(default=None, index=True)
    detail: str = ""


class StoryRow(SQLModel, table=True):
    __tablename__ = "story"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="project.id", index=True)
    epic_id: str | None = Field(default=None, foreign_key="epic.id", index=True)
    version_id: str | None = Field(default=None, foreign_key="version.id", index=True)
    title: str
    description: str
    notes: str = ""
    criteria: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime


class AnalysisRow(SQLModel, table=True):
    __tablename__ = "analysis"

    id: str = Field(primary_key=True)
    story_id: str = Field(foreign_key="story.id", index=True)
    ai_status: str = "not_requested"
    model_name: str | None = None
    prompt_version: str | None = None
    catalog_version: str
    created_at: datetime


class FindingRow(SQLModel, table=True):
    __tablename__ = "finding"

    id: str = Field(primary_key=True)
    analysis_id: str = Field(foreign_key="analysis.id", index=True)
    position: int  # conserva el orden en que se emitieron los hallazgos
    rule_id: str
    source: str
    severity: str
    message: str
    suggestion: str
    reference: str
    evidence_text: str | None = None
    confidence: float | None = None
    decision: str = "pending"
    dismiss_reason: str | None = None


class CaseRow(SQLModel, table=True):
    __tablename__ = "test_case"

    id: str = Field(primary_key=True)
    story_id: str = Field(foreign_key="story.id", index=True)
    position: int
    criterion_index: int | None = None
    title: str
    technique: str
    preconditions: str = ""
    steps: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    test_data: str = ""
    expected_result: str
    gherkin: str | None = None
    priority: str = "medium"
    origin: str = "user"
    status: str = "proposed"
    created_at: datetime


class SessionRow(SQLModel, table=True):
    __tablename__ = "qa_session"

    id: str = Field(primary_key=True)
    story_id: str = Field(foreign_key="story.id", index=True)
    environment_name: str
    environment_url: str
    build_version: str
    tester_name: str
    started_at: datetime
    closed_at: datetime | None = None
    recommendation: str | None = None
    summary: str = ""


class ChecklistRow(SQLModel, table=True):
    __tablename__ = "checklist_item"

    id: str = Field(primary_key=True)
    session_id: str = Field(foreign_key="qa_session.id", index=True)
    position: int
    phase: str
    text: str
    checked: bool = False
    note: str = ""


class ExecutionRow(SQLModel, table=True):
    __tablename__ = "execution"

    id: str = Field(primary_key=True)
    session_id: str = Field(foreign_key="qa_session.id", index=True)
    test_case_id: str
    position: int
    result: str = "not_run"
    actual_result: str = ""
    notes: str = ""
    executed_at: datetime | None = None


class EvidenceRow(SQLModel, table=True):
    __tablename__ = "evidence"

    id: str = Field(primary_key=True)
    execution_id: str = Field(foreign_key="execution.id", index=True)
    type: str
    uri: str = ""
    description: str = ""
    uploaded_at: datetime


class DefectRow(SQLModel, table=True):
    __tablename__ = "defect_draft"

    id: str = Field(primary_key=True)
    execution_id: str = Field(foreign_key="execution.id", unique=True, index=True)
    title: str
    preconditions: str = ""
    steps: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    expected_result: str = ""
    actual_result: str = ""
    severity: str
    priority: str
    frequency: str
    environment: str = ""
    build_version: str = ""
    ai_assisted: bool = False
    created_at: datetime
