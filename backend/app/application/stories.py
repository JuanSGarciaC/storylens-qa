from app.application.analyze_story import analyze_story
from app.domain.entities import Decision, StoredAnalysis, StoredStory, Story
from app.domain.ports import LLMPort, StoryRepository
from app.domain.ports.sessions import EvidenceStorage, SessionRepository


class NotFoundError(Exception):
    pass


class InvalidDecisionError(Exception):
    pass


def create_story(repo: StoryRepository, story: Story) -> StoredStory:
    return repo.add_story(story)


def run_analysis(
    repo: StoryRepository, story_id: str, llm: LLMPort | None = None, use_ai: bool = False
) -> StoredAnalysis:
    """Analiza la historia guardada y persiste el resultado como un análisis nuevo."""
    stored = repo.get_story(story_id)
    if stored is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    result = analyze_story(stored.story, llm=llm, use_ai=use_ai)
    return repo.add_analysis(
        story_id=story_id,
        findings=result.findings,
        ai_status=result.ai_status,
        catalog_version=result.catalog_version,
        model_name=result.model_name,
        prompt_version=result.prompt_version,
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
