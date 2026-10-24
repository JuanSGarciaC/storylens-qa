from fastapi import APIRouter, HTTPException, Response, status

from app.api.deps import LLM, Repository, Sessions, Storage
from app.api.mappers import analysis_out, story_out
from app.api.schemas.analysis import AnalysisOut, AnalysisRequest, StoryIn, StoryOut
from app.application import stories
from app.domain.entities import Story

router = APIRouter(tags=["stories"])


@router.post("/stories", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
def create_story(payload: StoryIn, repo: Repository) -> StoryOut:
    story = Story(
        title=payload.title,
        description=payload.description,
        acceptance_criteria=tuple(payload.acceptance_criteria),
        notes=payload.notes,
    )
    return story_out(stories.create_story(repo, story), latest=None)


@router.get("/stories", response_model=list[StoryOut])
def list_stories(repo: Repository) -> list[StoryOut]:
    return [story_out(s, repo.latest_analysis(s.id)) for s in repo.list_stories()]


@router.get("/stories/{story_id}", response_model=StoryOut)
def get_story(story_id: str, repo: Repository) -> StoryOut:
    stored = repo.get_story(story_id)
    if stored is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Historia no encontrada")
    return story_out(stored, repo.latest_analysis(story_id))


@router.delete("/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(story_id: str, repo: Repository, sessions: Sessions, storage: Storage) -> Response:
    stories.delete_story(repo, sessions, storage, story_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/stories/{story_id}/analyses",
    response_model=AnalysisOut,
    status_code=status.HTTP_201_CREATED,
)
def create_analysis(
    story_id: str, repo: Repository, llm: LLM, payload: AnalysisRequest | None = None
) -> AnalysisOut:
    use_ai = payload.use_ai if payload else True
    return analysis_out(stories.run_analysis(repo, story_id, llm=llm, use_ai=use_ai))
