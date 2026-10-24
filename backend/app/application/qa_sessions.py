import logging
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from app.application.stories import NotFoundError
from app.domain.entities import (
    AIStatus,
    CaseStatus,
    ChecklistItem,
    DefectDraft,
    Evidence,
    EvidenceType,
    Execution,
    ExecutionResult,
    QASession,
    QATestCase,
    Recommendation,
)
from app.domain.ports import DefectContext, LLMError, LLMPort, StoryRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository
from app.domain.qa_session import (
    CHECKLIST_TEMPLATE,
    build_base_defect,
    detect_image_extension,
    has_failures,
    is_safe_link,
    merge_ai_defect,
    pending_count,
    suggest_recommendation,
)

logger = logging.getLogger(__name__)

MAX_NOTE_CHARS = 1000
DEFECT_EDITABLE = {
    "title",
    "preconditions",
    "steps",
    "expected_result",
    "actual_result",
    "severity",
    "priority",
    "frequency",
}


class ConflictError(Exception):
    """La acción no es posible en el estado actual (sesión cerrada, casos pendientes…)."""


class InvalidSessionDataError(Exception):
    pass


@dataclass(frozen=True)
class ExecutionView:
    execution: Execution
    case: QATestCase | None
    evidences: list[Evidence]
    defect: DefectDraft | None


@dataclass(frozen=True)
class SessionDetail:
    session: QASession
    checklist: list[ChecklistItem]
    executions: list[ExecutionView]
    suggested_recommendation: Recommendation | None

    @property
    def pending(self) -> int:
        return pending_count([v.execution for v in self.executions])


# --- utilidades ---
def _require_session(sessions: SessionRepository, session_id: str) -> QASession:
    session = sessions.get_session(session_id)
    if session is None:
        raise NotFoundError(f"Sesión {session_id} no encontrada")
    return session


def _require_open(session: QASession) -> QASession:
    if session.closed:
        raise ConflictError("La sesión ya está cerrada y no admite cambios")
    return session


def _require_execution(sessions: SessionRepository, execution_id: str) -> Execution:
    execution = sessions.get_execution(execution_id)
    if execution is None:
        raise NotFoundError(f"Ejecución {execution_id} no encontrada")
    return execution


def _open_session_of(sessions: SessionRepository, execution: Execution) -> QASession:
    return _require_open(_require_session(sessions, execution.session_id))


# --- sesión ---
def create_session(
    stories: StoryRepository,
    sessions: SessionRepository,
    story_id: str,
    environment_name: str,
    environment_url: str,
    build_version: str,
    tester_name: str,
) -> QASession:
    if stories.get_story(story_id) is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    if not environment_name.strip():
        raise InvalidSessionDataError("El nombre del ambiente es obligatorio")
    if not is_safe_link(environment_url):
        raise InvalidSessionDataError("La URL del ambiente debe ser http o https")
    accepted = [c for c in stories.list_test_cases(story_id) if c.status == CaseStatus.ACCEPTED]
    if not accepted:
        raise InvalidSessionDataError(
            "No hay casos de prueba aceptados: acepta al menos uno antes de iniciar la sesión"
        )
    return sessions.create_session(
        story_id=story_id,
        environment_name=environment_name.strip(),
        environment_url=environment_url.strip(),
        build_version=build_version.strip(),
        tester_name=tester_name.strip(),
        checklist=CHECKLIST_TEMPLATE,
        case_ids=[c.id for c in accepted if c.id],
    )


def list_sessions(
    stories: StoryRepository, sessions: SessionRepository, story_id: str
) -> list[QASession]:
    if stories.get_story(story_id) is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    return sessions.list_sessions(story_id)


def get_detail(
    stories: StoryRepository, sessions: SessionRepository, session_id: str
) -> SessionDetail:
    session = _require_session(sessions, session_id)
    cases = {c.id: c for c in stories.list_test_cases(session.story_id)}
    executions = sessions.list_executions(session_id)
    defects = {d.execution_id: d for d in sessions.list_defects(session_id)}
    views = [
        ExecutionView(
            execution=e,
            case=cases.get(e.test_case_id),
            evidences=sessions.list_evidence(e.id),
            defect=defects.get(e.id),
        )
        for e in executions
    ]
    severities = {eid: d.fields.severity for eid, d in defects.items()}
    return SessionDetail(
        session=session,
        checklist=sessions.list_checklist(session_id),
        executions=views,
        suggested_recommendation=suggest_recommendation(executions, severities),
    )


def get_execution_view(
    stories: StoryRepository, sessions: SessionRepository, execution_id: str
) -> ExecutionView:
    execution = _require_execution(sessions, execution_id)
    return ExecutionView(
        execution=execution,
        case=stories.get_test_case(execution.test_case_id),
        evidences=sessions.list_evidence(execution_id),
        defect=sessions.get_defect_for_execution(execution_id),
    )


def close_session(
    sessions: SessionRepository,
    session_id: str,
    recommendation: Recommendation,
    summary: str,
) -> QASession:
    session = _require_open(_require_session(sessions, session_id))
    executions = sessions.list_executions(session.id)
    pending = pending_count(executions)
    if pending:
        raise ConflictError(f"Faltan {pending} casos por ejecutar")
    if recommendation == Recommendation.ACCEPT and has_failures(executions):
        raise InvalidSessionDataError(
            "No se puede aceptar la historia con casos fallidos o bloqueados"
        )
    return sessions.close_session(session.id, recommendation, summary.strip())


# --- checklist y ejecución ---
def update_checklist_item(
    sessions: SessionRepository, item_id: str, changes: dict[str, Any]
) -> ChecklistItem:
    item = sessions.get_checklist_item(item_id)
    if item is None:
        raise NotFoundError(f"Ítem {item_id} no encontrado")
    _require_open(_require_session(sessions, item.session_id))
    return sessions.update_checklist_item(
        item_id,
        checked=changes.get("checked", item.checked),
        note=str(changes.get("note", item.note)).strip()[:MAX_NOTE_CHARS],
    )


def update_execution(
    sessions: SessionRepository, execution_id: str, changes: dict[str, Any]
) -> Execution:
    execution = _require_execution(sessions, execution_id)
    _open_session_of(sessions, execution)
    return sessions.update_execution(
        execution_id,
        result=changes.get("result", execution.result),
        actual_result=str(changes.get("actual_result", execution.actual_result)).strip()[
            :MAX_NOTE_CHARS
        ],
        notes=str(changes.get("notes", execution.notes)).strip()[:MAX_NOTE_CHARS],
    )


# --- evidencias ---
def add_note_evidence(sessions: SessionRepository, execution_id: str, text: str) -> Evidence:
    execution = _require_execution(sessions, execution_id)
    _open_session_of(sessions, execution)
    text = text.strip()
    if not text:
        raise InvalidSessionDataError("La nota no puede estar vacía")
    return sessions.add_evidence(execution_id, EvidenceType.NOTE, "", text[:MAX_NOTE_CHARS])


def add_link_evidence(
    sessions: SessionRepository, execution_id: str, url: str, description: str
) -> Evidence:
    execution = _require_execution(sessions, execution_id)
    _open_session_of(sessions, execution)
    if not is_safe_link(url):
        raise InvalidSessionDataError("El enlace debe ser una URL http o https")
    return sessions.add_evidence(
        execution_id, EvidenceType.LINK, url.strip(), description.strip()[:MAX_NOTE_CHARS]
    )


def add_image_evidence(
    sessions: SessionRepository,
    storage: EvidenceStorage,
    execution_id: str,
    content: bytes,
    description: str,
    max_bytes: int,
) -> Evidence:
    execution = _require_execution(sessions, execution_id)
    _open_session_of(sessions, execution)
    if not content:
        raise InvalidSessionDataError("El archivo está vacío")
    if len(content) > max_bytes:
        raise InvalidSessionDataError(f"La imagen supera el máximo de {max_bytes // 1_000_000} MB")
    extension = detect_image_extension(content)
    if extension is None:
        raise InvalidSessionDataError("Solo se aceptan imágenes PNG, JPEG o WebP")
    name = storage.save(content, extension)
    try:
        return sessions.add_evidence(
            execution_id, EvidenceType.IMAGE, name, description.strip()[:MAX_NOTE_CHARS]
        )
    except Exception:
        storage.delete(name)  # no dejar archivos huérfanos si la base de datos falla
        raise


def get_evidence_file(
    sessions: SessionRepository, storage: EvidenceStorage, evidence_id: str
) -> tuple[Path, str]:
    evidence = sessions.get_evidence(evidence_id)
    if evidence is None or evidence.type != EvidenceType.IMAGE:
        raise NotFoundError(f"Evidencia {evidence_id} no encontrada")
    try:
        path = storage.path(evidence.uri)
    except ValueError as error:
        raise NotFoundError(f"Evidencia {evidence_id} no encontrada") from error
    if not path.is_file():
        raise NotFoundError(f"Evidencia {evidence_id} no encontrada")
    media_type = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}[
        path.suffix.lstrip(".")
    ]
    return path, media_type


# --- defectos ---
def draft_defect(
    stories: StoryRepository,
    sessions: SessionRepository,
    llm: LLMPort | None,
    execution_id: str,
    use_ai: bool,
) -> tuple[DefectDraft, AIStatus]:
    """Crea (o reemplaza) el borrador. Siempre hay plantilla; la IA solo mejora la redacción."""
    execution = _require_execution(sessions, execution_id)
    session = _open_session_of(sessions, execution)
    if execution.result != ExecutionResult.FAILED:
        raise ConflictError("Solo se puede redactar un defecto de un caso fallido")
    case = stories.get_test_case(execution.test_case_id)
    stored_story = stories.get_story(session.story_id)
    if case is None or stored_story is None:
        raise NotFoundError("No se encontró el caso o la historia de esta ejecución")

    fields = build_base_defect(case, execution, session)
    status = AIStatus.NOT_REQUESTED
    if use_ai:
        status = AIStatus.UNAVAILABLE
        if llm is not None:
            context = DefectContext(
                story_title=stored_story.story.title,
                case=case,
                actual_result=execution.actual_result,
                notes=execution.notes,
                environment=fields.environment,
                build_version=session.build_version,
            )
            try:
                fields = merge_ai_defect(fields, llm.draft_defect(context).draft)
                status = AIStatus.OK
            except LLMError as error:
                logger.warning("No se pudo redactar el defecto con IA: %s", error)
                status = AIStatus.UNAVAILABLE
    return sessions.save_defect(execution_id, fields), status


def update_defect(
    sessions: SessionRepository, defect_id: str, changes: dict[str, Any]
) -> DefectDraft:
    defect = sessions.get_defect(defect_id)
    if defect is None:
        raise NotFoundError(f"Defecto {defect_id} no encontrado")
    _open_session_of(sessions, _require_execution(sessions, defect.execution_id))

    unknown = set(changes) - DEFECT_EDITABLE
    if unknown:
        raise InvalidSessionDataError(f"Campos no editables: {', '.join(sorted(unknown))}")
    if "steps" in changes:
        changes = {**changes, "steps": tuple(s.strip() for s in changes["steps"] if s.strip())}
    fields = replace(defect.fields, **changes)
    if not fields.title.strip() or not fields.steps:
        raise InvalidSessionDataError("El defecto necesita título y al menos un paso")
    return sessions.save_defect(defect.execution_id, fields)
