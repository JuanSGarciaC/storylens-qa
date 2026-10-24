from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

SYSTEM_ACTOR = "sistema"


@dataclass(frozen=True)
class AuditEvent:
    id: int
    at: datetime
    actor: str
    action: str
    entity: str
    entity_id: str
    project_id: str | None
    detail: str


class AuditLog(Protocol):
    def record(
        self,
        actor: str,
        action: str,
        entity: str,
        entity_id: str,
        project_id: str | None,
        detail: str = "",
    ) -> None:
        """Anota quién hizo qué. `detail` nunca debe llevar secretos."""
        ...

    def list_events(self, project_id: str, limit: int = 50, offset: int = 0) -> list[AuditEvent]:
        """Eventos del proyecto, el más reciente primero."""
        ...
