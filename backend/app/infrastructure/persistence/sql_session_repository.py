import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlmodel import Session, col, delete, select

from app.domain.entities import (
    ChecklistItem,
    ChecklistPhase,
    DefectDraft,
    DefectFields,
    DefectSeverity,
    Evidence,
    EvidenceType,
    Execution,
    ExecutionResult,
    Frequency,
    Priority,
    QASession,
    Recommendation,
)
from app.infrastructure.persistence.models import (
    ChecklistRow,
    DefectRow,
    EvidenceRow,
    ExecutionRow,
    SessionRow,
)


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime | None) -> datetime | None:
    # SQLite no guarda la zona horaria: si vuelve sin ella, siempre fue UTC.
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class SqlSessionRepository:
    def __init__(self, session: Session) -> None:
        self._db = session

    # --- sesiones ---
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
        row = SessionRow(
            id=_new_id(),
            story_id=story_id,
            environment_name=environment_name,
            environment_url=environment_url,
            build_version=build_version,
            tester_name=tester_name,
            started_at=_now(),
        )
        self._db.add(row)
        for position, (phase, text) in enumerate(checklist):
            self._db.add(
                ChecklistRow(
                    id=_new_id(), session_id=row.id, position=position, phase=phase, text=text
                )
            )
        for position, case_id in enumerate(case_ids):
            self._db.add(
                ExecutionRow(
                    id=_new_id(), session_id=row.id, test_case_id=case_id, position=position
                )
            )
        self._db.commit()
        return self._session(row)

    def get_session(self, session_id: str) -> QASession | None:
        row = self._db.get(SessionRow, session_id)
        return self._session(row) if row else None

    def list_sessions(self, story_id: str) -> list[QASession]:
        rows = self._db.exec(
            select(SessionRow)
            .where(SessionRow.story_id == story_id)
            .order_by(col(SessionRow.started_at).desc())
        )
        return [self._session(r) for r in rows]

    def close_session(
        self, session_id: str, recommendation: Recommendation, summary: str
    ) -> QASession:
        row = self._db.get(SessionRow, session_id)
        if row is None:
            raise KeyError(session_id)
        row.closed_at = _now()
        row.recommendation = recommendation
        row.summary = summary
        self._db.add(row)
        self._db.commit()
        return self._session(row)

    def delete_for_story(self, story_id: str) -> list[str]:
        session_ids = select(SessionRow.id).where(SessionRow.story_id == story_id)
        execution_ids = select(ExecutionRow.id).where(col(ExecutionRow.session_id).in_(session_ids))
        files = [
            e.uri
            for e in self._db.exec(
                select(EvidenceRow).where(
                    col(EvidenceRow.execution_id).in_(execution_ids),
                    EvidenceRow.type == EvidenceType.IMAGE,
                )
            )
        ]
        self._db.exec(delete(EvidenceRow).where(col(EvidenceRow.execution_id).in_(execution_ids)))
        self._db.exec(delete(DefectRow).where(col(DefectRow.execution_id).in_(execution_ids)))
        self._db.exec(delete(ExecutionRow).where(col(ExecutionRow.session_id).in_(session_ids)))
        self._db.exec(delete(ChecklistRow).where(col(ChecklistRow.session_id).in_(session_ids)))
        self._db.exec(delete(SessionRow).where(SessionRow.story_id == story_id))
        self._db.commit()
        return files

    # --- checklist ---
    def list_checklist(self, session_id: str) -> list[ChecklistItem]:
        rows = self._db.exec(
            select(ChecklistRow)
            .where(ChecklistRow.session_id == session_id)
            .order_by(col(ChecklistRow.position))
        )
        return [self._item(r) for r in rows]

    def get_checklist_item(self, item_id: str) -> ChecklistItem | None:
        row = self._db.get(ChecklistRow, item_id)
        return self._item(row) if row else None

    def update_checklist_item(self, item_id: str, checked: bool, note: str) -> ChecklistItem:
        row = self._db.get(ChecklistRow, item_id)
        if row is None:
            raise KeyError(item_id)
        row.checked, row.note = checked, note
        self._db.add(row)
        self._db.commit()
        return self._item(row)

    # --- ejecuciones ---
    def list_executions(self, session_id: str) -> list[Execution]:
        rows = self._db.exec(
            select(ExecutionRow)
            .where(ExecutionRow.session_id == session_id)
            .order_by(col(ExecutionRow.position))
        )
        return [self._execution(r) for r in rows]

    def get_execution(self, execution_id: str) -> Execution | None:
        row = self._db.get(ExecutionRow, execution_id)
        return self._execution(row) if row else None

    def update_execution(
        self, execution_id: str, result: ExecutionResult, actual_result: str, notes: str
    ) -> Execution:
        row = self._db.get(ExecutionRow, execution_id)
        if row is None:
            raise KeyError(execution_id)
        row.result, row.actual_result, row.notes = result, actual_result, notes
        row.executed_at = None if result == ExecutionResult.NOT_RUN else _now()
        self._db.add(row)
        self._db.commit()
        return self._execution(row)

    # --- evidencias ---
    def add_evidence(
        self, execution_id: str, type: EvidenceType, uri: str, description: str
    ) -> Evidence:
        row = EvidenceRow(
            id=_new_id(),
            execution_id=execution_id,
            type=type,
            uri=uri,
            description=description,
            uploaded_at=_now(),
        )
        self._db.add(row)
        self._db.commit()
        return self._evidence(row)

    def list_evidence(self, execution_id: str) -> list[Evidence]:
        rows = self._db.exec(
            select(EvidenceRow)
            .where(EvidenceRow.execution_id == execution_id)
            .order_by(col(EvidenceRow.uploaded_at))
        )
        return [self._evidence(r) for r in rows]

    def get_evidence(self, evidence_id: str) -> Evidence | None:
        row = self._db.get(EvidenceRow, evidence_id)
        return self._evidence(row) if row else None

    # --- defectos ---
    def save_defect(self, execution_id: str, fields: DefectFields) -> DefectDraft:
        row = self._db.exec(select(DefectRow).where(DefectRow.execution_id == execution_id)).first()
        if row is None:
            row = DefectRow(
                id=_new_id(), execution_id=execution_id, created_at=_now(), **self._columns(fields)
            )
        else:
            for name, value in self._columns(fields).items():
                setattr(row, name, value)
        self._db.add(row)
        self._db.commit()
        return self._defect(row)

    def get_defect(self, defect_id: str) -> DefectDraft | None:
        row = self._db.get(DefectRow, defect_id)
        return self._defect(row) if row else None

    def get_defect_for_execution(self, execution_id: str) -> DefectDraft | None:
        row = self._db.exec(select(DefectRow).where(DefectRow.execution_id == execution_id)).first()
        return self._defect(row) if row else None

    def list_defects(self, session_id: str) -> list[DefectDraft]:
        execution_ids = select(ExecutionRow.id).where(ExecutionRow.session_id == session_id)
        rows = self._db.exec(
            select(DefectRow)
            .where(col(DefectRow.execution_id).in_(execution_ids))
            .order_by(col(DefectRow.created_at))
        )
        return [self._defect(r) for r in rows]

    # --- mapeo fila <-> dominio ---
    @staticmethod
    def _columns(fields: DefectFields) -> dict[str, object]:
        return {
            "title": fields.title,
            "preconditions": fields.preconditions,
            "steps": list(fields.steps),
            "expected_result": fields.expected_result,
            "actual_result": fields.actual_result,
            "severity": fields.severity,
            "priority": fields.priority,
            "frequency": fields.frequency,
            "environment": fields.environment,
            "build_version": fields.build_version,
            "ai_assisted": fields.ai_assisted,
        }

    @staticmethod
    def _session(row: SessionRow) -> QASession:
        started = _aware(row.started_at)
        assert started is not None
        return QASession(
            id=row.id,
            story_id=row.story_id,
            environment_name=row.environment_name,
            environment_url=row.environment_url,
            build_version=row.build_version,
            tester_name=row.tester_name,
            started_at=started,
            closed_at=_aware(row.closed_at),
            recommendation=Recommendation(row.recommendation) if row.recommendation else None,
            summary=row.summary,
        )

    @staticmethod
    def _item(row: ChecklistRow) -> ChecklistItem:
        return ChecklistItem(
            id=row.id,
            session_id=row.session_id,
            phase=ChecklistPhase(row.phase),
            text=row.text,
            checked=row.checked,
            note=row.note,
        )

    @staticmethod
    def _execution(row: ExecutionRow) -> Execution:
        return Execution(
            id=row.id,
            session_id=row.session_id,
            test_case_id=row.test_case_id,
            result=ExecutionResult(row.result),
            actual_result=row.actual_result,
            notes=row.notes,
            executed_at=_aware(row.executed_at),
        )

    @staticmethod
    def _evidence(row: EvidenceRow) -> Evidence:
        uploaded = _aware(row.uploaded_at)
        assert uploaded is not None
        return Evidence(
            id=row.id,
            execution_id=row.execution_id,
            type=EvidenceType(row.type),
            uri=row.uri,
            description=row.description,
            uploaded_at=uploaded,
        )

    @staticmethod
    def _defect(row: DefectRow) -> DefectDraft:
        created = _aware(row.created_at)
        assert created is not None
        fields = DefectFields(
            title=row.title,
            preconditions=row.preconditions,
            steps=tuple(row.steps),
            expected_result=row.expected_result,
            actual_result=row.actual_result,
            severity=DefectSeverity(row.severity),
            priority=Priority(row.priority),
            frequency=Frequency(row.frequency),
            environment=row.environment,
            build_version=row.build_version,
            ai_assisted=row.ai_assisted,
        )
        return DefectDraft(
            id=row.id, execution_id=row.execution_id, fields=fields, created_at=created
        )
