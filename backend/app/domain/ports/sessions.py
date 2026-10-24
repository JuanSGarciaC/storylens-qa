from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from app.domain.entities import (
    ChecklistItem,
    ChecklistPhase,
    DefectDraft,
    DefectFields,
    Evidence,
    EvidenceType,
    Execution,
    ExecutionResult,
    QASession,
    Recommendation,
)


class SessionRepository(Protocol):
    def create_session(
        self,
        story_id: str,
        environment_name: str,
        environment_url: str,
        build_version: str,
        tester_name: str,
        checklist: Sequence[tuple[ChecklistPhase, str]],
        case_ids: Sequence[str],
    ) -> QASession:
        """Crea la sesión con su checklist y una ejecución (sin ejecutar) por caso."""
        ...

    def get_session(self, session_id: str) -> QASession | None: ...

    def list_sessions(self, story_id: str) -> list[QASession]: ...

    def close_session(
        self, session_id: str, recommendation: Recommendation, summary: str
    ) -> QASession: ...

    def delete_for_story(self, story_id: str) -> list[str]:
        """Borra todo lo de las sesiones de la historia. Devuelve las imágenes a eliminar."""
        ...

    # --- checklist ---
    def list_checklist(self, session_id: str) -> list[ChecklistItem]: ...

    def get_checklist_item(self, item_id: str) -> ChecklistItem | None: ...

    def update_checklist_item(self, item_id: str, checked: bool, note: str) -> ChecklistItem: ...

    # --- ejecuciones ---
    def list_executions(self, session_id: str) -> list[Execution]: ...

    def get_execution(self, execution_id: str) -> Execution | None: ...

    def update_execution(
        self, execution_id: str, result: ExecutionResult, actual_result: str, notes: str
    ) -> Execution: ...

    # --- evidencias ---
    def add_evidence(
        self, execution_id: str, type: EvidenceType, uri: str, description: str
    ) -> Evidence: ...

    def list_evidence(self, execution_id: str) -> list[Evidence]: ...

    def get_evidence(self, evidence_id: str) -> Evidence | None: ...

    # --- defectos ---
    def save_defect(self, execution_id: str, fields: DefectFields) -> DefectDraft:
        """Crea o reemplaza el defecto de una ejecución (hay uno por ejecución)."""
        ...

    def get_defect(self, defect_id: str) -> DefectDraft | None: ...

    def get_defect_for_execution(self, execution_id: str) -> DefectDraft | None: ...

    def list_defects(self, session_id: str) -> list[DefectDraft]: ...


class EvidenceStorage(Protocol):
    def save(self, content: bytes, extension: str) -> str:
        """Guarda el archivo y devuelve su nombre interno."""
        ...

    def path(self, name: str) -> Path:
        """Ruta del archivo guardado. Lanza ValueError si el nombre no es uno generado aquí."""
        ...

    def delete(self, name: str) -> None: ...
