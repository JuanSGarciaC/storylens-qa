import uuid
from datetime import UTC, datetime

from sqlalchemy import func, update
from sqlmodel import Session, col, select

from app.domain.entities.import_job import (
    ImportItem,
    ImportJob,
    ItemStatus,
    JobStatus,
    NewImportItem,
)
from app.infrastructure.persistence.models import ImportItemRow, ImportJobRow


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


class SqlImportJobRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_job(
        self,
        project_id: str,
        filename: str,
        use_ai: bool,
        actor: str,
        items: list[NewImportItem],
    ) -> ImportJob:
        now = _now()
        job_id = str(uuid.uuid4())
        self._session.add(
            ImportJobRow(
                id=job_id,
                project_id=project_id,
                filename=filename,
                status=JobStatus.QUEUED,
                use_ai=use_ai,
                actor=actor,
                created_at=now,
                updated_at=now,
            )
        )
        for item in items:
            self._session.add(
                ImportItemRow(
                    job_id=job_id,
                    row_index=item.row_index,
                    key=item.key,
                    title=item.title,
                    description=item.description,
                    criteria=list(item.acceptance_criteria),
                    status=ItemStatus.PENDING,
                )
            )
        self._session.commit()
        job = self.get_job(job_id)
        assert job is not None
        return job

    def get_job(self, job_id: str) -> ImportJob | None:
        self._session.expire_all()  # otro hilo pudo cambiar el estado desde la última lectura
        row = self._session.get(ImportJobRow, job_id)
        return self._job(row) if row else None

    def list_jobs(self, project_id: str, limit: int = 20) -> list[ImportJob]:
        statement = (
            select(ImportJobRow)
            .where(ImportJobRow.project_id == project_id)
            .order_by(col(ImportJobRow.created_at).desc())
            .limit(limit)
        )
        return [self._job(row) for row in self._session.exec(statement)]

    def set_status(self, job_id: str, status: JobStatus, note: str = "") -> None:
        row = self._session.get(ImportJobRow, job_id)
        if row is None:
            return
        row.status = status
        row.note = note
        row.updated_at = _now()
        self._session.add(row)
        self._session.commit()

    def list_items(
        self,
        job_id: str,
        status: ItemStatus | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[ImportItem]:
        statement = select(ImportItemRow).where(ImportItemRow.job_id == job_id)
        if status is not None:
            statement = statement.where(ImportItemRow.status == status)
        statement = statement.order_by(col(ImportItemRow.row_index)).offset(offset)
        if limit is not None:
            statement = statement.limit(limit)
        self._session.expire_all()
        return [self._item(row) for row in self._session.exec(statement)]

    def count_items(self, job_id: str, status: ItemStatus | None = None) -> int:
        statement = (
            select(func.count()).select_from(ImportItemRow).where(ImportItemRow.job_id == job_id)
        )
        if status is not None:
            statement = statement.where(ImportItemRow.status == status)
        return int(self._session.exec(statement).one())

    def update_item(
        self,
        item_id: int,
        status: ItemStatus,
        story_id: str | None = None,
        error: str = "",
        ai_status: str | None = None,
    ) -> None:
        row = self._session.get(ImportItemRow, item_id)
        if row is None:
            return
        row.status = status
        row.story_id = story_id or row.story_id
        row.error = error
        row.ai_status = ai_status
        self._session.add(row)
        self._session.commit()

    def reset_failed_items(self, job_id: str) -> int:
        failed = self.count_items(job_id, ItemStatus.FAILED)
        self._session.exec(
            update(ImportItemRow)
            .where(ImportItemRow.job_id == job_id, ImportItemRow.status == ItemStatus.FAILED)
            .values(status=ItemStatus.PENDING, error="")
        )
        self._session.commit()
        return failed

    def mark_interrupted(self) -> int:
        active = [JobStatus.QUEUED, JobStatus.RUNNING]
        rows = self._session.exec(select(ImportJobRow).where(col(ImportJobRow.status).in_(active)))
        count = 0
        for row in rows:
            row.status = JobStatus.INTERRUPTED
            row.note = "El servidor se reinició antes de terminar. Puedes reintentar."
            row.updated_at = _now()
            self._session.add(row)
            count += 1
        self._session.commit()
        return count

    def _counts(self, job_id: str) -> dict[str, int]:
        statement = (
            select(ImportItemRow.status, func.count())
            .where(ImportItemRow.job_id == job_id)
            .group_by(ImportItemRow.status)
        )
        return {status: int(n) for status, n in self._session.exec(statement)}

    def _job(self, row: ImportJobRow) -> ImportJob:
        counts = self._counts(row.id)
        return ImportJob(
            id=row.id,
            project_id=row.project_id,
            filename=row.filename,
            status=JobStatus(row.status),
            use_ai=row.use_ai,
            actor=row.actor,
            created_at=_aware(row.created_at),
            updated_at=_aware(row.updated_at),
            total=sum(counts.values()),
            done=counts.get(ItemStatus.DONE, 0),
            skipped=counts.get(ItemStatus.SKIPPED, 0),
            failed=counts.get(ItemStatus.FAILED, 0),
            pending=counts.get(ItemStatus.PENDING, 0),
            note=row.note,
        )

    @staticmethod
    def _item(row: ImportItemRow) -> ImportItem:
        assert row.id is not None
        return ImportItem(
            id=row.id,
            job_id=row.job_id,
            row_index=row.row_index,
            key=row.key,
            title=row.title,
            description=row.description,
            acceptance_criteria=tuple(row.criteria),
            status=ItemStatus(row.status),
            story_id=row.story_id,
            error=row.error,
            ai_status=row.ai_status,
        )
