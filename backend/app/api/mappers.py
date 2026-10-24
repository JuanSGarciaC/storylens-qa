from dataclasses import asdict

from app.api.schemas.analysis import AnalysisOut, AnalysisSummary, FindingOut, StoryOut
from app.domain.entities import StoredAnalysis, StoredStory
from app.domain.scoring import calculate_score


def analysis_out(analysis: StoredAnalysis) -> AnalysisOut:
    score = calculate_score(analysis.findings)
    return AnalysisOut(
        id=analysis.id,
        story_id=analysis.story_id,
        created_at=analysis.created_at,
        score=score.value,
        verdict=score.verdict,
        used_ai=analysis.used_ai,
        ai_status=analysis.ai_status,
        model_name=analysis.model_name,
        prompt_version=analysis.prompt_version,
        rules_catalog_version=analysis.catalog_version,
        findings=[FindingOut(**asdict(f)) for f in analysis.findings],
    )


def story_out(stored: StoredStory, latest: StoredAnalysis | None) -> StoryOut:
    summary = None
    if latest is not None:
        score = calculate_score(latest.findings)
        summary = AnalysisSummary(
            id=latest.id,
            score=score.value,
            verdict=score.verdict,
            created_at=latest.created_at,
        )
    story = stored.story
    return StoryOut(
        id=stored.id,
        project_id=stored.project_id,
        epic_id=stored.epic_id,
        version_id=stored.version_id,
        title=story.title,
        description=story.description,
        notes=story.notes,
        acceptance_criteria=list(story.acceptance_criteria),
        created_at=stored.created_at,
        latest_analysis=summary,
    )
