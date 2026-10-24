from fastapi import APIRouter

from app.api.schemas.analysis import AnalysisOut, FindingOut, RuleOut, StoryIn
from app.application.analyze_story import analyze_story
from app.domain.entities import Story
from app.domain.rules.catalog import load_catalog

router = APIRouter()


@router.post("/analyze", response_model=AnalysisOut)
def analyze(payload: StoryIn) -> AnalysisOut:
    story = Story(
        title=payload.title,
        description=payload.description,
        acceptance_criteria=tuple(payload.acceptance_criteria),
        notes=payload.notes,
    )
    result = analyze_story(story)
    return AnalysisOut(
        score=result.score.value,
        verdict=result.score.verdict,
        used_ai=result.used_ai,
        ai_status=result.ai_status,
        rules_catalog_version=result.catalog_version,
        findings=[FindingOut(**vars(f)) for f in result.findings],
    )


@router.get("/rules", response_model=list[RuleOut])
def list_rules() -> list[RuleOut]:
    return [
        RuleOut(
            id=r.id,
            name=r.name,
            reference=r.reference,
            type=r.type,
            severity=r.severity,
            description=r.description,
        )
        for r in load_catalog().rules
    ]
