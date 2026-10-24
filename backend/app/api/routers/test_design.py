from fastapi import APIRouter, status

from app.api.deps import LLM, Repository
from app.api.schemas.test_design import (
    CaseIn,
    CaseOut,
    CaseUpdate,
    GenerateCasesRequest,
    GherkinOut,
    ScenarioOut,
    TraceabilityOut,
    TraceRowOut,
)
from app.application import test_design
from app.domain.entities import QATestCase

router = APIRouter(tags=["test-design"])


def case_out(case: QATestCase) -> CaseOut:
    assert case.id and case.story_id  # un caso devuelto por el repositorio siempre los tiene
    return CaseOut(
        id=case.id,
        story_id=case.story_id,
        title=case.title,
        technique=case.technique,
        criterion_index=case.criterion_index,
        preconditions=case.preconditions,
        steps=list(case.steps),
        test_data=case.test_data,
        expected_result=case.expected_result,
        gherkin=case.gherkin,
        priority=case.priority,
        origin=case.origin,
        status=case.status,
    )


@router.post("/stories/{story_id}/test-cases:generate", response_model=list[CaseOut])
def generate_cases(
    story_id: str,
    repo: Repository,
    llm: LLM,
    payload: GenerateCasesRequest | None = None,
) -> list[CaseOut]:
    """Pide casos a la IA. Reemplaza solo los propuestos antes; conserva los revisados."""
    techniques = payload.techniques if payload else []
    return [case_out(c) for c in test_design.generate_cases(repo, llm, story_id, techniques)]


@router.get("/stories/{story_id}/test-cases", response_model=list[CaseOut])
def list_cases(story_id: str, repo: Repository) -> list[CaseOut]:
    return [case_out(c) for c in test_design.list_cases(repo, story_id)]


@router.post(
    "/stories/{story_id}/test-cases",
    response_model=CaseOut,
    status_code=status.HTTP_201_CREATED,
)
def add_case(story_id: str, payload: CaseIn, repo: Repository) -> CaseOut:
    case = QATestCase(
        title=payload.title,
        technique=payload.technique,
        steps=tuple(payload.steps),
        expected_result=payload.expected_result,
        criterion_index=payload.criterion_index,
        preconditions=payload.preconditions,
        test_data=payload.test_data,
        gherkin=payload.gherkin,
        priority=payload.priority,
    )
    return case_out(test_design.add_manual_case(repo, story_id, case))


@router.patch("/test-cases/{case_id}", response_model=CaseOut)
def update_case(case_id: str, payload: CaseUpdate, repo: Repository) -> CaseOut:
    changes = payload.model_dump(exclude_unset=True)
    # Un null explícito solo tiene sentido para estos campos opcionales.
    nullable = {"criterion_index", "gherkin"}
    changes = {k: v for k, v in changes.items() if v is not None or k in nullable}
    return case_out(test_design.update_case(repo, case_id, changes))


@router.get("/stories/{story_id}/traceability", response_model=TraceabilityOut)
def traceability(story_id: str, repo: Repository) -> TraceabilityOut:
    result = test_design.get_traceability(repo, story_id)
    return TraceabilityOut(
        rows=[
            TraceRowOut(
                index=r.index,
                text=r.text,
                accepted_ids=r.accepted_ids,
                proposed_ids=r.proposed_ids,
                covered=r.covered,
            )
            for r in result.rows
        ],
        unlinked_ids=result.unlinked_ids,
        coverage=result.coverage,
    )


@router.post("/stories/{story_id}/gherkin:suggest", response_model=GherkinOut)
def suggest_gherkin(story_id: str, repo: Repository, llm: LLM) -> GherkinOut:
    result = test_design.suggest_gherkin(repo, llm, story_id)
    return GherkinOut(
        scenarios=[
            ScenarioOut(criterion_index=s.criterion_index, text=s.text) for s in result.scenarios
        ],
        model_name=result.model_name,
        prompt_version=result.prompt_version,
    )
