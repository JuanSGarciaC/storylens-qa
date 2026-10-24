from collections.abc import Mapping

from sqlmodel import Session

from app.infrastructure.persistence.models import (
    AnalysisRow,
    CaseRow,
    ChecklistRow,
    DefectRow,
    EvidenceRow,
    ExecutionRow,
    FindingRow,
    SessionRow,
    StoryRow,
)


class SqlProjectResolver:
    """Averigua a qué proyecto pertenece el recurso que nombra una ruta."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def project_of(self, params: Mapping[str, str]) -> str | None:
        if "project_id" in params:
            return str(params["project_id"])
        for name, resolve in self._resolvers():
            if name in params:
                return resolve(str(params[name]))
        return None

    def _resolvers(self):  # type: ignore[no-untyped-def]
        return (
            ("story_id", self._story),
            ("analysis_id", self._analysis),
            ("finding_id", self._finding),
            ("case_id", self._case),
            ("session_id", self._session_row),
            ("item_id", self._checklist_item),
            ("execution_id", self._execution),
            ("evidence_id", self._evidence),
            ("defect_id", self._defect),
        )

    def _story(self, story_id: str | None) -> str | None:
        row = self._session.get(StoryRow, story_id) if story_id else None
        return row.project_id if row else None

    def _analysis(self, analysis_id: str | None) -> str | None:
        row = self._session.get(AnalysisRow, analysis_id) if analysis_id else None
        return self._story(row.story_id) if row else None

    def _finding(self, finding_id: str) -> str | None:
        row = self._session.get(FindingRow, finding_id)
        return self._analysis(row.analysis_id) if row else None

    def _case(self, case_id: str) -> str | None:
        row = self._session.get(CaseRow, case_id)
        return self._story(row.story_id) if row else None

    def _session_row(self, session_id: str | None) -> str | None:
        row = self._session.get(SessionRow, session_id) if session_id else None
        return self._story(row.story_id) if row else None

    def _checklist_item(self, item_id: str) -> str | None:
        row = self._session.get(ChecklistRow, item_id)
        return self._session_row(row.session_id) if row else None

    def _execution(self, execution_id: str | None) -> str | None:
        row = self._session.get(ExecutionRow, execution_id) if execution_id else None
        return self._session_row(row.session_id) if row else None

    def _evidence(self, evidence_id: str) -> str | None:
        row = self._session.get(EvidenceRow, evidence_id)
        return self._execution(row.execution_id) if row else None

    def _defect(self, defect_id: str) -> str | None:
        row = self._session.get(DefectRow, defect_id)
        return self._execution(row.execution_id) if row else None
