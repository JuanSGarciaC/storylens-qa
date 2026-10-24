from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.domain.audit import AuditEvent
from app.infrastructure.persistence.models import AuditEventRow


class SqlAuditLog:
    def __init__(self, session: Session) -> None:
        self._session = session

    def record(
        self,
        actor: str,
        action: str,
        entity: str,
        entity_id: str,
        project_id: str | None,
        detail: str = "",
    ) -> None:
        self._session.add(
            AuditEventRow(
                at=datetime.now(UTC),
                actor=actor,
                action=action,
                entity=entity,
                entity_id=entity_id,
                project_id=project_id,
                detail=detail,
            )
        )
        self._session.commit()

    def list_events(self, project_id: str, limit: int = 50, offset: int = 0) -> list[AuditEvent]:
        rows = self._session.exec(
            select(AuditEventRow)
            .where(AuditEventRow.project_id == project_id)
            .order_by(col(AuditEventRow.id).desc())
            .offset(offset)
            .limit(limit)
        )
        return [
            AuditEvent(
                id=r.id or 0,
                at=r.at if r.at.tzinfo else r.at.replace(tzinfo=UTC),
                actor=r.actor,
                action=r.action,
                entity=r.entity,
                entity_id=r.entity_id,
                project_id=r.project_id,
                detail=r.detail,
            )
            for r in rows
        ]
