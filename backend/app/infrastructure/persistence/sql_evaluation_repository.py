import uuid
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, col, select

from app.domain.entities.evaluation import EvaluationMode, EvaluationRun, EvaluationStatus
from app.infrastructure.persistence.models import EvaluationRunRow


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


class SqlEvaluationRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_run(
        self,
        project_id: str,
        mode: EvaluationMode,
        actor: str,
        total: int,
        catalog_version: str,
    ) -> EvaluationRun:
        row = EvaluationRunRow(
            id=str(uuid.uuid4()),
            project_id=project_id,
            mode=mode,
            status=EvaluationStatus.RUNNING,
            actor=actor,
            catalog_version=catalog_version,
            total=total,
            created_at=_now(),
        )
        self._session.add(row)
        self._session.commit()
        return self._run(row)

    def get_run(self, run_id: str) -> EvaluationRun | None:
        self._session.expire_all()  # otro hilo pudo actualizar la corrida
        row = self._session.get(EvaluationRunRow, run_id)
        return self._run(row) if row else None

    def list_runs(self, project_id: str, limit: int = 30) -> list[EvaluationRun]:
        self._session.expire_all()
        rows = self._session.exec(
            select(EvaluationRunRow)
            .where(EvaluationRunRow.project_id == project_id)
            .order_by(col(EvaluationRunRow.created_at).desc())
            .limit(limit)
        )
        return [self._run(row) for row in rows]

    def update_run(
        self,
        run_id: str,
        *,
        status: EvaluationStatus | None = None,
        processed: int | None = None,
        model_name: str | None = None,
        prompt_version: str | None = None,
        metrics: dict[str, Any] | None = None,
        details: dict[str, Any] | None = None,
        note: str | None = None,
    ) -> None:
        row = self._session.get(EvaluationRunRow, run_id)
        if row is None:
            return
        if status is not None:
            row.status = status
            if not status.active:
                row.finished_at = _now()
        if processed is not None:
            row.processed = processed
        if model_name is not None:
            row.model_name = model_name
        if prompt_version is not None:
            row.prompt_version = prompt_version
        if metrics is not None:
            row.metrics = metrics
        if details is not None:
            row.details = details
        if note is not None:
            row.note = note
        self._session.add(row)
        self._session.commit()

    def mark_interrupted(self) -> int:
        rows = self._session.exec(
            select(EvaluationRunRow).where(EvaluationRunRow.status == EvaluationStatus.RUNNING)
        )
        count = 0
        for row in rows:
            row.status = EvaluationStatus.INTERRUPTED
            row.note = "El servidor se reinició antes de terminar. Vuelve a ejecutarla."
            row.finished_at = _now()
            self._session.add(row)
            count += 1
        self._session.commit()
        return count

    @staticmethod
    def _run(row: EvaluationRunRow) -> EvaluationRun:
        return EvaluationRun(
            id=row.id,
            project_id=row.project_id,
            mode=EvaluationMode(row.mode),
            status=EvaluationStatus(row.status),
            actor=row.actor,
            created_at=_aware(row.created_at),
            catalog_version=row.catalog_version,
            model_name=row.model_name,
            prompt_version=row.prompt_version,
            total=row.total,
            processed=row.processed,
            metrics=dict(row.metrics),
            details=dict(row.details),
            note=row.note,
            finished_at=_aware(row.finished_at) if row.finished_at else None,
        )
