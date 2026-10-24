from typing import Protocol

from app.domain.entities.import_job import (
    ImportItem,
    ImportJob,
    ItemStatus,
    JobStatus,
    NewImportItem,
)


class ImportJobRepository(Protocol):
    def create_job(
        self,
        project_id: str,
        filename: str,
        use_ai: bool,
        actor: str,
        items: list[NewImportItem],
    ) -> ImportJob: ...

    def get_job(self, job_id: str) -> ImportJob | None:
        """El trabajo con sus contadores, calculados a partir de sus filas."""
        ...

    def list_jobs(self, project_id: str, limit: int = 20) -> list[ImportJob]:
        """Los más recientes primero."""
        ...

    def set_status(self, job_id: str, status: JobStatus, note: str = "") -> None: ...

    def list_items(
        self,
        job_id: str,
        status: ItemStatus | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[ImportItem]: ...

    def count_items(self, job_id: str, status: ItemStatus | None = None) -> int: ...

    def update_item(
        self,
        item_id: int,
        status: ItemStatus,
        story_id: str | None = None,
        error: str = "",
        ai_status: str | None = None,
    ) -> None: ...

    def reset_failed_items(self, job_id: str) -> int:
        """Vuelve a poner en pendiente las filas fallidas. Devuelve cuántas son."""
        ...

    def mark_interrupted(self) -> int:
        """Al arrancar: los trabajos que seguían activos no terminaron. Devuelve cuántos."""
        ...
