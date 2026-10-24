from typing import Any, Protocol

from app.domain.entities.evaluation import EvaluationMode, EvaluationRun, EvaluationStatus


class EvaluationRepository(Protocol):
    def create_run(
        self,
        project_id: str,
        mode: EvaluationMode,
        actor: str,
        total: int,
        catalog_version: str,
    ) -> EvaluationRun: ...

    def get_run(self, run_id: str) -> EvaluationRun | None: ...

    def list_runs(self, project_id: str, limit: int = 30) -> list[EvaluationRun]:
        """Las más recientes primero."""
        ...

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
    ) -> None: ...

    def mark_interrupted(self) -> int:
        """Al arrancar: las corridas que seguían activas no terminaron. Devuelve cuántas."""
        ...
