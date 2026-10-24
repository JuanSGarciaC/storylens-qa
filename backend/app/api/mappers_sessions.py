from app.api.schemas.qa_session import (
    ChecklistItemOut,
    DefectOut,
    EvidenceOut,
    ExecutionOut,
    ResultCounts,
    SessionDetailOut,
    SessionSummaryOut,
)
from app.application.qa_sessions import ExecutionView, SessionDetail
from app.domain.entities import (
    ChecklistItem,
    DefectDraft,
    Evidence,
    EvidenceType,
    ExecutionResult,
    QASession,
)


def session_out(session: QASession) -> SessionSummaryOut:
    return SessionSummaryOut(
        id=session.id,
        story_id=session.story_id,
        environment_name=session.environment_name,
        environment_url=session.environment_url,
        build_version=session.build_version,
        tester_name=session.tester_name,
        started_at=session.started_at,
        closed_at=session.closed_at,
        recommendation=session.recommendation,
        summary=session.summary,
    )


def checklist_out(item: ChecklistItem) -> ChecklistItemOut:
    return ChecklistItemOut(
        id=item.id, phase=item.phase, text=item.text, checked=item.checked, note=item.note
    )


def evidence_out(evidence: Evidence) -> EvidenceOut:
    url = None
    if evidence.type == EvidenceType.IMAGE:
        url = f"/api/v1/evidences/{evidence.id}/file"  # el nombre interno no se expone
    elif evidence.type == EvidenceType.LINK:
        url = evidence.uri
    return EvidenceOut(
        id=evidence.id,
        execution_id=evidence.execution_id,
        type=evidence.type,
        description=evidence.description,
        uploaded_at=evidence.uploaded_at,
        url=url,
    )


def defect_out(defect: DefectDraft) -> DefectOut:
    f = defect.fields
    return DefectOut(
        id=defect.id,
        execution_id=defect.execution_id,
        title=f.title,
        preconditions=f.preconditions,
        steps=list(f.steps),
        expected_result=f.expected_result,
        actual_result=f.actual_result,
        severity=f.severity,
        priority=f.priority,
        frequency=f.frequency,
        environment=f.environment,
        build_version=f.build_version,
        ai_assisted=f.ai_assisted,
        created_at=defect.created_at,
    )


def execution_out(view: ExecutionView) -> ExecutionOut:
    e, case = view.execution, view.case
    return ExecutionOut(
        id=e.id,
        test_case_id=e.test_case_id,
        case_title=case.title if case else "(caso eliminado)",
        technique=case.technique if case else None,
        criterion_index=case.criterion_index if case else None,
        preconditions=case.preconditions if case else "",
        steps=list(case.steps) if case else [],
        expected_result=case.expected_result if case else "",
        result=e.result,
        actual_result=e.actual_result,
        notes=e.notes,
        executed_at=e.executed_at,
        evidences=[evidence_out(ev) for ev in view.evidences],
        defect=defect_out(view.defect) if view.defect else None,
    )


def detail_out(detail: SessionDetail) -> SessionDetailOut:
    results = [v.execution.result for v in detail.executions]
    counts = ResultCounts(
        passed=results.count(ExecutionResult.PASSED),
        failed=results.count(ExecutionResult.FAILED),
        blocked=results.count(ExecutionResult.BLOCKED),
        not_run=results.count(ExecutionResult.NOT_RUN),
    )
    return SessionDetailOut(
        **session_out(detail.session).model_dump(),
        checklist=[checklist_out(i) for i in detail.checklist],
        executions=[execution_out(v) for v in detail.executions],
        counts=counts,
        pending=detail.pending,
        suggested_recommendation=detail.suggested_recommendation,
    )
