from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import LLM, Repository, Sessions, Storage
from app.api.downloads import ReportFormat, report_download
from app.api.mappers_sessions import (
    checklist_out,
    defect_out,
    detail_out,
    evidence_out,
    execution_out,
    session_out,
)
from app.api.schemas.qa_session import (
    ChecklistItemOut,
    ChecklistUpdate,
    CloseRequest,
    DefectDraftOut,
    DefectDraftRequest,
    DefectOut,
    DefectUpdate,
    EvidenceIn,
    EvidenceOut,
    ExecutionOut,
    ExecutionUpdate,
    SessionDetailOut,
    SessionIn,
    SessionSummaryOut,
)
from app.application import qa_sessions, reports, test_design
from app.config import get_settings

router = APIRouter(tags=["qa-sessions"])


# --- sesión ---
@router.post(
    "/stories/{story_id}/qa-sessions",
    response_model=SessionDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    story_id: str, payload: SessionIn, repo: Repository, sessions: Sessions
) -> SessionDetailOut:
    session = qa_sessions.create_session(
        repo,
        sessions,
        story_id,
        payload.environment_name,
        payload.environment_url,
        payload.build_version,
        payload.tester_name,
    )
    return detail_out(qa_sessions.get_detail(repo, sessions, session.id))


@router.get("/stories/{story_id}/qa-sessions", response_model=list[SessionSummaryOut])
def list_sessions(story_id: str, repo: Repository, sessions: Sessions) -> list[SessionSummaryOut]:
    return [session_out(s) for s in qa_sessions.list_sessions(repo, sessions, story_id)]


@router.get("/qa-sessions/{session_id}", response_model=SessionDetailOut)
def get_session(session_id: str, repo: Repository, sessions: Sessions) -> SessionDetailOut:
    return detail_out(qa_sessions.get_detail(repo, sessions, session_id))


@router.get("/qa-sessions/{session_id}/report")
def session_report(
    session_id: str, repo: Repository, sessions: Sessions, format: ReportFormat = "md"
) -> Response:
    detail = qa_sessions.get_detail(repo, sessions, session_id)
    stored = repo.get_story(detail.session.story_id)
    if stored is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Historia no encontrada")
    traceability = test_design.get_traceability(repo, stored.id)
    text = reports.session_markdown(stored.story, detail, traceability)
    return report_download(
        text, reports.filename(stored.story.title, "sesion"), "Reporte de sesión QA", format
    )


@router.post("/qa-sessions/{session_id}:close", response_model=SessionDetailOut)
def close_session(
    session_id: str, payload: CloseRequest, repo: Repository, sessions: Sessions
) -> SessionDetailOut:
    qa_sessions.close_session(sessions, session_id, payload.recommendation, payload.summary)
    return detail_out(qa_sessions.get_detail(repo, sessions, session_id))


# --- checklist y ejecución ---
@router.patch("/checklist-items/{item_id}", response_model=ChecklistItemOut)
def update_checklist_item(
    item_id: str, payload: ChecklistUpdate, sessions: Sessions
) -> ChecklistItemOut:
    changes = payload.model_dump(exclude_none=True)
    return checklist_out(qa_sessions.update_checklist_item(sessions, item_id, changes))


@router.patch("/executions/{execution_id}", response_model=ExecutionOut)
def update_execution(
    execution_id: str, payload: ExecutionUpdate, repo: Repository, sessions: Sessions
) -> ExecutionOut:
    qa_sessions.update_execution(sessions, execution_id, payload.model_dump(exclude_none=True))
    return execution_out(qa_sessions.get_execution_view(repo, sessions, execution_id))


# --- evidencias ---
@router.post(
    "/executions/{execution_id}/evidences",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
)
def add_evidence(execution_id: str, payload: EvidenceIn, sessions: Sessions) -> EvidenceOut:
    if payload.type == "note":
        evidence = qa_sessions.add_note_evidence(sessions, execution_id, payload.text)
    else:
        evidence = qa_sessions.add_link_evidence(
            sessions, execution_id, payload.url, payload.description
        )
    return evidence_out(evidence)


@router.post(
    "/executions/{execution_id}/evidences/image",
    response_model=EvidenceOut,
    status_code=status.HTTP_201_CREATED,
)
def add_image_evidence(
    execution_id: str,
    sessions: Sessions,
    storage: Storage,
    file: Annotated[UploadFile, File()],
    description: Annotated[str, Form(max_length=1000)] = "",
) -> EvidenceOut:
    max_bytes = get_settings().max_evidence_mb * 1_000_000
    content = file.file.read(max_bytes + 1)  # un byte de más basta para detectar el exceso
    evidence = qa_sessions.add_image_evidence(
        sessions, storage, execution_id, content, description, max_bytes
    )
    return evidence_out(evidence)


@router.get("/evidences/{evidence_id}/file")
def get_evidence_file(evidence_id: str, sessions: Sessions, storage: Storage) -> FileResponse:
    path, media_type = qa_sessions.get_evidence_file(sessions, storage, evidence_id)
    return FileResponse(
        path,
        media_type=media_type,
        headers={"X-Content-Type-Options": "nosniff", "Content-Disposition": "inline"},
    )


# --- defectos ---
@router.post(
    "/executions/{execution_id}/defect-draft",
    response_model=DefectDraftOut,
    status_code=status.HTTP_201_CREATED,
)
def draft_defect(
    execution_id: str,
    repo: Repository,
    sessions: Sessions,
    llm: LLM,
    payload: DefectDraftRequest | None = None,
) -> DefectDraftOut:
    use_ai = payload.use_ai if payload else True
    defect, ai_status = qa_sessions.draft_defect(repo, sessions, llm, execution_id, use_ai)
    return DefectDraftOut(defect=defect_out(defect), ai_status=ai_status)


@router.patch("/defect-drafts/{defect_id}", response_model=DefectOut)
def update_defect(defect_id: str, payload: DefectUpdate, sessions: Sessions) -> DefectOut:
    changes = payload.model_dump(exclude_none=True)
    return defect_out(qa_sessions.update_defect(sessions, defect_id, changes))
