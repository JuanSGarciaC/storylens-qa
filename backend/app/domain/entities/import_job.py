from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    PARTIAL = "partial"  # terminó, pero alguna fila falló
    FAILED = "failed"  # terminó y ninguna fila se pudo importar
    CANCELLED = "cancelled"
    INTERRUPTED = "interrupted"  # el servidor se reinició a mitad del trabajo

    @property
    def active(self) -> bool:
        return self in (JobStatus.QUEUED, JobStatus.RUNNING)


class ItemStatus(StrEnum):
    PENDING = "pending"
    DONE = "done"
    SKIPPED = "skipped"  # duplicada: ya existía una historia igual
    FAILED = "failed"


@dataclass(frozen=True)
class ImportItem:
    id: int
    job_id: str
    row_index: int
    key: str
    title: str
    description: str
    acceptance_criteria: tuple[str, ...]
    status: ItemStatus
    story_id: str | None = None
    error: str = ""
    ai_status: str | None = None


@dataclass(frozen=True)
class NewImportItem:
    row_index: int
    key: str
    title: str
    description: str
    acceptance_criteria: tuple[str, ...]


@dataclass(frozen=True)
class ImportJob:
    id: str
    project_id: str
    filename: str
    status: JobStatus
    use_ai: bool
    actor: str
    created_at: datetime
    updated_at: datetime
    total: int = 0
    done: int = 0
    skipped: int = 0
    failed: int = 0
    pending: int = 0
    note: str = ""

    @property
    def processed(self) -> int:
        return self.done + self.skipped + self.failed
