from app.application.analyze_story import analyze_story
from app.application.errors import NotFoundError
from app.application.projects import InvalidProjectError, require_project
from app.domain.entities import Decision, ProjectSettings, StoredAnalysis, StoredStory, Story
from app.domain.ports import LLMPort, ProjectRepository, StoryRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository

__all__ = ["NotFoundError"]  # se reexporta para quien ya lo importa desde aquí


class InvalidDecisionError(Exception):
    pass


def create_story(
    repo: StoryRepository,
    projects: ProjectRepository,
    project_id: str,
    story: Story,
    epic_id: str | None = None,
    version_id: str | None = None,
) -> StoredStory:
    """Guarda la historia en el proyecto; la épica y la versión deben ser de ese proyecto."""
    require_project(projects, project_id)
    if epic_id is not None and epic_id not in {e.id for e in projects.list_epics(project_id)}:
        raise InvalidProjectError("La épica no pertenece a este proyecto")
    if version_id is not None and version_id not in {
        v.id for v in projects.list_versions(project_id)
    }:
        raise InvalidProjectError("La versión no pertenece a este proyecto")
    return repo.add_story(project_id, story, epic_id=epic_id, version_id=version_id)


def run_analysis(
    repo: StoryRepository,
    story_id: str,
    llm: LLMPort | None = None,
    use_ai: bool = False,
    settings: ProjectSettings | None = None,
) -> StoredAnalysis:
    """Analiza la historia guardada y persiste el resultado como un análisis nuevo."""
    stored = repo.get_story(story_id)
    if stored is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    result = analyze_story(stored.story, llm=llm, use_ai=use_ai, settings=settings)
    return repo.add_analysis(
        story_id=story_id,
        findings=result.findings,
        ai_status=result.ai_status,
        catalog_version=result.catalog_version,
        model_name=result.model_name,
        prompt_version=result.prompt_version,
        settings=settings,
    )


def decide_finding(
    repo: StoryRepository, finding_id: str, decision: Decision, reason: str | None
) -> StoredAnalysis:
    """Acepta, descarta o restablece un hallazgo. Descartar exige un motivo."""
    reason = (reason or "").strip() or None
    if decision == Decision.DISMISSED and reason is None:
        raise InvalidDecisionError("Descartar un hallazgo requiere un motivo")
    if decision != Decision.DISMISSED:
        reason = None

    analysis_id = repo.update_finding_decision(finding_id, decision, reason)
    if analysis_id is None:
        raise NotFoundError(f"Hallazgo {finding_id} no encontrado")
    analysis = repo.get_analysis(analysis_id)
    if analysis is None:  # no debería ocurrir: el hallazgo existe
        raise NotFoundError(f"Análisis {analysis_id} no encontrado")
    return analysis


def delete_story(
    repo: StoryRepository,
    sessions: SessionRepository,
    storage: EvidenceStorage,
    story_id: str,
) -> None:
    """Borra la historia con sus sesiones y los archivos de evidencia que quedarían huérfanos."""
    if repo.get_story(story_id) is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    files = sessions.delete_for_story(story_id)
    repo.delete_story(story_id)
    for name in files:
        storage.delete(name)
