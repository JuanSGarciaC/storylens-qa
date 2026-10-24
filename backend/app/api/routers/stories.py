from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import LLM, Actor, Audit, Projects, Repository, Sessions, Storage
from app.api.mappers import analysis_out, story_out
from app.api.schemas.analysis import AnalysisOut, AnalysisRequest, StoryIn, StoryOut
from app.application import stories
from app.application.projects import require_project
from app.domain.entities import Story

router = APIRouter(tags=["stories"])


@router.post(
    "/projects/{project_id}/stories", response_model=StoryOut, status_code=status.HTTP_201_CREATED
)
def create_story(
    project_id: str,
    payload: StoryIn,
    repo: Repository,
    projects: Projects,
    audit: Audit,
    actor: Actor,
) -> StoryOut:
    story = Story(
        title=payload.title,
        description=payload.description,
        acceptance_criteria=tuple(payload.acceptance_criteria),
        notes=payload.notes,
    )
    stored = stories.create_story(
        repo, projects, project_id, story, epic_id=payload.epic_id, version_id=payload.version_id
    )
    audit.record(actor, "story.created", "story", stored.id, project_id, stored.story.title)
    return story_out(stored, latest=None)


@router.get("/projects/{project_id}/stories", response_model=list[StoryOut])
def list_stories(
    project_id: str,
    repo: Repository,
    projects: Projects,
    epic_id: str | None = None,
    version_id: str | None = None,
) -> list[StoryOut]:
    require_project(projects, project_id)
    found = repo.list_stories(project_id, epic_id=epic_id, version_id=version_id)
    return [story_out(s, repo.latest_analysis(s.id)) for s in found]


@router.get("/stories/{story_id}", response_model=StoryOut)
def get_story(story_id: str, repo: Repository) -> StoryOut:
    stored = repo.get_story(story_id)
    if stored is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Historia no encontrada")
    return story_out(stored, repo.latest_analysis(story_id))


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(
    story_id: str,
    repo: Repository,
    sessions: Sessions,
    storage: Storage,
    audit: Audit,
    actor: Actor,
) -> Response:
    stored = repo.get_story(story_id)
    stories.delete_story(repo, sessions, storage, story_id)
    if stored is not None:
        audit.record(
            actor, "story.deleted", "story", story_id, stored.project_id, stored.story.title
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/stories/{story_id}/analyses",
    response_model=AnalysisOut,
    status_code=status.HTTP_201_CREATED,
)
def create_analysis(
    story_id: str,
    repo: Repository,
    llm: LLM,
    projects: Projects,
    audit: Audit,
    actor: Actor,
    payload: AnalysisRequest | None = None,
) -> AnalysisOut:
    use_ai = payload.use_ai if payload else True
    stored = repo.get_story(story_id)
    project = projects.get_project(stored.project_id) if stored is not None else None
    settings = project.settings if project is not None else None
    analysis = stories.run_analysis(repo, story_id, llm=llm, use_ai=use_ai, settings=settings)
    if stored is not None:
        audit.record(actor, "analysis.run", "analysis", analysis.id, stored.project_id)
    return analysis_out(analysis)
