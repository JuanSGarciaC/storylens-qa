from datetime import datetime

from pydantic import BaseModel


class ImportItemOut(BaseModel):
    row_index: int
    key: str
    title: str
    status: str
    story_id: str | None
    error: str
    ai_status: str | None


class ImportJobOut(BaseModel):
    id: str
    project_id: str
    filename: str
    status: str
    use_ai: bool
    total: int
    processed: int
    done: int
    skipped: int
    failed: int
    pending: int
    note: str
    created_at: datetime
    updated_at: datetime


class ImportJobDetailOut(ImportJobOut):
    items: list[ImportItemOut]
    items_total: int  # filas que cumplen el filtro (para paginar)
