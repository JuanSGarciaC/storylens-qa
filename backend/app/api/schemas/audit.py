from datetime import datetime

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    id: int
    at: datetime
    actor: str
    action: str
    entity: str
    entity_id: str
    project_id: str | None
    detail: str
