import uuid
from datetime import UTC, datetime

from sqlmodel import Session, col, delete, select

from app.domain.entities import (
    AIStatus,
    CaseOrigin,
    CaseStatus,
    Decision,
    Finding,
    Priority,
    ProjectSettings,
    QATestCase,
    Severity,
    Source,
    StoredAnalysis,
    StoredStory,
    Story,
    Technique,
)
from app.infrastructure.persistence.models import AnalysisRow, CaseRow, FindingRow, StoryRow
from app.infrastructure.persistence.settings_codec import settings_from_json, settings_to_json


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    # SQLite no guarda la zona horaria: si vuelve sin ella, siempre fue UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class SqlStoryRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    # --- historias ---
    def add_story(
        self,
        project_id: str,
        story: Story,
        epic_id: str | None = None,
        version_id: str | None = None,
    ) -> StoredStory:
        row = StoryRow(
            id=_new_id(),
            project_id=project_id,
            epic_id=epic_id,
            version_id=version_id,
            title=story.title,
            description=story.description,
            notes=story.notes,
            criteria=list(story.acceptance_criteria),
            created_at=_now(),
        )
        self._session.add(row)
        self._session.commit()
        return self._story(row)

    def get_story(self, story_id: str) -> StoredStory | None:
        row = self._session.get(StoryRow, story_id)
        return self._story(row) if row else None

    def list_stories(
        self, project_id: str, epic_id: str | None = None, version_id: str | None = None
    ) -> list[StoredStory]:
        query = select(StoryRow).where(StoryRow.project_id == project_id)
        if epic_id is not None:
            query = query.where(StoryRow.epic_id == epic_id)
        if version_id is not None:
            query = query.where(StoryRow.version_id == version_id)
        rows = self._session.exec(query.order_by(col(StoryRow.created_at).desc()))
        return [self._story(r) for r in rows]

    def list_story_ids(self, project_id: str) -> list[str]:
        return list(
            self._session.exec(select(StoryRow.id).where(StoryRow.project_id == project_id))
        )

    def delete_story(self, story_id: str) -> bool:
        row = self._session.get(StoryRow, story_id)
        if row is None:
            return False
        analysis_ids = select(AnalysisRow.id).where(AnalysisRow.story_id == story_id)
        self._session.exec(delete(FindingRow).where(col(FindingRow.analysis_id).in_(analysis_ids)))
        self._session.exec(delete(AnalysisRow).where(AnalysisRow.story_id == story_id))
        self._session.exec(delete(CaseRow).where(CaseRow.story_id == story_id))
        self._session.delete(row)
        self._session.commit()
        return True

    # --- análisis ---
    def add_analysis(
        self,
        story_id: str,
        findings: list[Finding],
        ai_status: AIStatus,
        catalog_version: str,
        model_name: str | None = None,
        prompt_version: str | None = None,
        settings: ProjectSettings | None = None,
    ) -> StoredAnalysis:
        analysis = AnalysisRow(
            id=_new_id(),
            story_id=story_id,
            ai_status=ai_status,
            model_name=model_name,
            prompt_version=prompt_version,
            catalog_version=catalog_version,
            settings_snapshot=settings_to_json(settings or ProjectSettings()),
            created_at=_now(),
        )
        self._session.add(analysis)
        for position, f in enumerate(findings):
            self._session.add(
                FindingRow(
                    id=_new_id(),
                    analysis_id=analysis.id,
                    position=position,
                    rule_id=f.rule_id,
                    source=f.source,
                    severity=f.severity,
                    message=f.message,
                    suggestion=f.suggestion,
                    reference=f.reference,
                    evidence_text=f.evidence_text,
                    confidence=f.confidence,
                    decision=f.decision,
                    dismiss_reason=f.dismiss_reason,
                )
            )
        self._session.commit()
        return self._analysis(analysis)

    def get_analysis(self, analysis_id: str) -> StoredAnalysis | None:
        row = self._session.get(AnalysisRow, analysis_id)
        return self._analysis(row) if row else None

    def latest_analysis(self, story_id: str) -> StoredAnalysis | None:
        row = self._session.exec(
            select(AnalysisRow)
            .where(AnalysisRow.story_id == story_id)
            .order_by(col(AnalysisRow.created_at).desc())
            .limit(1)
        ).first()
        return self._analysis(row) if row else None

    def list_analyses(self, story_id: str) -> list[StoredAnalysis]:
        rows = self._session.exec(
            select(AnalysisRow)
            .where(AnalysisRow.story_id == story_id)
            .order_by(col(AnalysisRow.created_at))
        )
        return [self._analysis(row) for row in rows]

    def update_finding_decision(
        self, finding_id: str, decision: Decision, reason: str | None
    ) -> str | None:
        row = self._session.get(FindingRow, finding_id)
        if row is None:
            return None
        row.decision = decision
        row.dismiss_reason = reason
        self._session.add(row)
        self._session.commit()
        return row.analysis_id

    # --- casos de prueba ---
    def add_test_cases(self, story_id: str, cases: list[QATestCase]) -> list[QATestCase]:
        existing = len(
            self._session.exec(select(CaseRow.id).where(CaseRow.story_id == story_id)).all()
        )
        now = _now()
        rows = [
            CaseRow(
                id=_new_id(),
                story_id=story_id,
                position=existing + offset,
                criterion_index=c.criterion_index,
                title=c.title,
                technique=c.technique,
                preconditions=c.preconditions,
                steps=list(c.steps),
                test_data=c.test_data,
                expected_result=c.expected_result,
                gherkin=c.gherkin,
                priority=c.priority,
                origin=c.origin,
                status=c.status,
                created_at=now,
            )
            for offset, c in enumerate(cases)
        ]
        self._session.add_all(rows)
        self._session.commit()
        return [self._case(r) for r in rows]

    def list_test_cases(self, story_id: str) -> list[QATestCase]:
        rows = self._session.exec(
            select(CaseRow).where(CaseRow.story_id == story_id).order_by(col(CaseRow.position))
        )
        return [self._case(r) for r in rows]

    def get_test_case(self, case_id: str) -> QATestCase | None:
        row = self._session.get(CaseRow, case_id)
        return self._case(row) if row else None

    def save_test_case(self, case: QATestCase) -> QATestCase:
        row = self._session.get(CaseRow, case.id) if case.id else None
        if row is None:
            raise KeyError(case.id)
        row.criterion_index = case.criterion_index
        row.title = case.title
        row.technique = case.technique
        row.preconditions = case.preconditions
        row.steps = list(case.steps)
        row.test_data = case.test_data
        row.expected_result = case.expected_result
        row.gherkin = case.gherkin
        row.priority = case.priority
        row.status = case.status
        self._session.add(row)
        self._session.commit()
        return self._case(row)

    def delete_proposed_ai_test_cases(self, story_id: str) -> int:
        rows = self._session.exec(
            select(CaseRow).where(
                CaseRow.story_id == story_id,
                CaseRow.origin == CaseOrigin.AI,
                CaseRow.status == CaseStatus.PROPOSED,
            )
        ).all()
        for row in rows:
            self._session.delete(row)
        self._session.commit()
        return len(rows)

    @staticmethod
    def _case(row: CaseRow) -> QATestCase:
        return QATestCase(
            id=row.id,
            story_id=row.story_id,
            criterion_index=row.criterion_index,
            title=row.title,
            technique=Technique(row.technique),
            preconditions=row.preconditions,
            steps=tuple(row.steps),
            test_data=row.test_data,
            expected_result=row.expected_result,
            gherkin=row.gherkin,
            priority=Priority(row.priority),
            origin=CaseOrigin(row.origin),
            status=CaseStatus(row.status),
        )

    # --- mapeo fila -> dominio ---
    @staticmethod
    def _story(row: StoryRow) -> StoredStory:
        story = Story(
            title=row.title,
            description=row.description,
            acceptance_criteria=tuple(row.criteria),
            notes=row.notes,
        )
        return StoredStory(
            id=row.id,
            story=story,
            created_at=_aware(row.created_at),
            project_id=row.project_id,
            epic_id=row.epic_id,
            version_id=row.version_id,
        )

    def _analysis(self, row: AnalysisRow) -> StoredAnalysis:
        finding_rows = self._session.exec(
            select(FindingRow)
            .where(FindingRow.analysis_id == row.id)
            .order_by(col(FindingRow.position))
        )
        findings = [
            Finding(
                id=f.id,
                rule_id=f.rule_id,
                source=Source(f.source),
                severity=Severity(f.severity),
                message=f.message,
                suggestion=f.suggestion,
                reference=f.reference,
                evidence_text=f.evidence_text,
                confidence=f.confidence,
                decision=Decision(f.decision),
                dismiss_reason=f.dismiss_reason,
            )
            for f in finding_rows
        ]
        return StoredAnalysis(
            id=row.id,
            story_id=row.story_id,
            findings=findings,
            ai_status=AIStatus(row.ai_status),
            catalog_version=row.catalog_version,
            created_at=_aware(row.created_at),
            model_name=row.model_name,
            prompt_version=row.prompt_version,
            settings=settings_from_json(row.settings_snapshot),
        )
