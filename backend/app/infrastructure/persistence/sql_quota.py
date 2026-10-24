import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import Engine, func
from sqlmodel import Session, col, delete, select

from app.infrastructure.persistence.models import AIUsageRow


def _utcnow() -> datetime:
    return datetime.now(UTC)


class SqlQuota:
    """Cuota de IA guardada en la base de datos: un reinicio del servidor no la reinicia.

    El candado protege contra peticiones simultáneas dentro de un proceso (un solo worker).
    """

    def __init__(
        self,
        engine: Engine,
        per_minute: int,
        per_day: int,
        clock: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._engine = engine
        self._per_minute = per_minute
        self._per_day = per_day
        self._clock = clock
        self._lock = threading.Lock()

    def try_acquire(self, key: str) -> bool:
        with self._lock, Session(self._engine) as session:
            now = self._clock()
            session.exec(delete(AIUsageRow).where(col(AIUsageRow.at) < now - timedelta(days=1)))
            used_minute = self._count(session, key, now - timedelta(seconds=60))
            used_day = self._count(session, key, now - timedelta(days=1))
            allowed = used_minute < self._per_minute and used_day < self._per_day
            if allowed:
                session.add(AIUsageRow(key=key, at=now))
            session.commit()
            return allowed

    def remaining_today(self, key: str) -> int:
        with Session(self._engine) as session:
            used = self._count(session, key, self._clock() - timedelta(days=1))
        return max(0, self._per_day - used)

    @staticmethod
    def _count(session: Session, key: str, since: datetime) -> int:
        statement = (
            select(func.count())
            .select_from(AIUsageRow)
            .where(AIUsageRow.key == key, col(AIUsageRow.at) >= since)
        )
        return int(session.exec(statement).one())
