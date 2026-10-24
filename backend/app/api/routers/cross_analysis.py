from fastapi import APIRouter

from app.api.deps import Projects, Repository
from app.api.schemas.cross_analysis import (
    ContradictionOut,
    CrossAnalysisOut,
    DependencyOut,
    DuplicateOut,
    EpicRiskOut,
    StoryRefOut,
)
from app.application.cross_analysis import project_cross_analysis

router = APIRouter(tags=["cross-analysis"])

NO_EPIC = "Sin épica"


@router.get("/projects/{project_id}/cross-analysis", response_model=CrossAnalysisOut)
def cross_analysis(project_id: str, repo: Repository, projects: Projects) -> CrossAnalysisOut:
    """Duplicados, dependencias, posibles contradicciones y riesgo por épica del proyecto."""
    result = project_cross_analysis(repo, projects, project_id)
    names = {e.id: e.name for e in projects.list_epics(project_id)}
    return CrossAnalysisOut(
        total_stories=result.total_stories,
        stories=[StoryRefOut(id=s.id, title=s.story.title) for s in repo.list_stories(project_id)],
        duplicates=[DuplicateOut(**vars(d)) for d in result.duplicates],
        dependencies=[DependencyOut(**vars(d)) for d in result.dependencies],
        contradictions=[ContradictionOut(**vars(c)) for c in result.contradictions],
        epic_risks=[
            EpicRiskOut(
                **vars(r), epic_name=names.get(r.epic_id, NO_EPIC) if r.epic_id else NO_EPIC
            )
            for r in result.epic_risks
        ],
        without_cases=result.without_cases,
    )
