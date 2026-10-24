import logging
from collections.abc import Sequence
from dataclasses import dataclass, replace
from typing import Any

from app.application.stories import NotFoundError
from app.domain.entities import CaseOrigin, CaseStatus, QATestCase, StoredStory, Technique
from app.domain.ports import LLMError, LLMInvalidResponseError, LLMPort, StoryRepository
from app.domain.test_design import (
    GherkinScenario,
    Traceability,
    build_gherkin,
    build_test_cases,
    build_traceability,
)

logger = logging.getLogger(__name__)

EDITABLE_FIELDS = {
    "title",
    "technique",
    "steps",
    "expected_result",
    "criterion_index",
    "preconditions",
    "test_data",
    "gherkin",
    "priority",
    "status",
}


class AIUnavailableError(Exception):
    pass


class AIInvalidResponseError(Exception):
    pass


class InvalidCaseError(Exception):
    pass


@dataclass(frozen=True)
class GherkinResult:
    scenarios: list[GherkinScenario]
    model_name: str | None = None
    prompt_version: str | None = None


def _require_story(repo: StoryRepository, story_id: str) -> StoredStory:
    stored = repo.get_story(story_id)
    if stored is None:
        raise NotFoundError(f"Historia {story_id} no encontrada")
    return stored


def _validate(case: QATestCase, criteria_count: int) -> QATestCase:
    steps = tuple(s.strip() for s in case.steps if s.strip())
    title, expected = case.title.strip(), case.expected_result.strip()
    if not (title and expected and steps):
        raise InvalidCaseError("El caso necesita título, al menos un paso y resultado esperado")
    index = case.criterion_index
    if index is not None and not 1 <= index <= criteria_count:
        raise InvalidCaseError(f"El criterio {index} no existe en esta historia")
    return replace(case, title=title, expected_result=expected, steps=steps)


def generate_cases(
    repo: StoryRepository, llm: LLMPort | None, story_id: str, techniques: Sequence[Technique]
) -> list[QATestCase]:
    """Pide casos a la IA y reemplaza solo los propuestos antes; conserva lo ya revisado."""
    stored = _require_story(repo, story_id)
    if llm is None:
        raise AIUnavailableError("La IA no está configurada en el servidor")
    chosen = list(dict.fromkeys(techniques)) or list(Technique)

    try:
        result = llm.generate_test_cases(stored.story, chosen)
    except LLMInvalidResponseError as error:
        raise AIInvalidResponseError("La IA devolvió una respuesta inválida") from error
    except LLMError as error:
        raise AIUnavailableError("La IA no está disponible en este momento") from error

    built = build_test_cases(stored.story, result.cases, chosen)
    if built.discarded:
        logger.info("Casos de IA descartados: %s", dict(built.discarded))
    if not built.cases:
        # No se borra nada: es mejor conservar lo anterior que dejar al usuario sin casos.
        raise AIInvalidResponseError("La IA no produjo ningún caso de prueba válido")

    repo.delete_proposed_ai_test_cases(story_id)
    repo.add_test_cases(story_id, built.cases)
    return repo.list_test_cases(story_id)


def list_cases(repo: StoryRepository, story_id: str) -> list[QATestCase]:
    _require_story(repo, story_id)
    return repo.list_test_cases(story_id)


def add_manual_case(repo: StoryRepository, story_id: str, case: QATestCase) -> QATestCase:
    stored = _require_story(repo, story_id)
    case = replace(
        _validate(case, len(stored.story.acceptance_criteria)),
        origin=CaseOrigin.USER,
        status=CaseStatus.ACCEPTED,  # lo escribió el usuario: no necesita revisión
    )
    return repo.add_test_cases(story_id, [case])[0]


def update_case(repo: StoryRepository, case_id: str, changes: dict[str, Any]) -> QATestCase:
    case = repo.get_test_case(case_id)
    if case is None or case.story_id is None:
        raise NotFoundError(f"Caso {case_id} no encontrado")
    stored = _require_story(repo, case.story_id)

    unknown = set(changes) - EDITABLE_FIELDS
    if unknown:
        raise InvalidCaseError(f"Campos no editables: {', '.join(sorted(unknown))}")
    if "steps" in changes:
        changes = {**changes, "steps": tuple(changes["steps"])}
    updated = _validate(replace(case, **changes), len(stored.story.acceptance_criteria))
    return repo.save_test_case(updated)


def get_traceability(repo: StoryRepository, story_id: str) -> Traceability:
    stored = _require_story(repo, story_id)
    return build_traceability(stored.story, repo.list_test_cases(story_id))


def suggest_gherkin(repo: StoryRepository, llm: LLMPort | None, story_id: str) -> GherkinResult:
    """Reescribe los criterios como Gherkin. No se guarda: es una sugerencia para copiar."""
    stored = _require_story(repo, story_id)
    if not stored.story.acceptance_criteria:
        return GherkinResult(scenarios=[])
    if llm is None:
        raise AIUnavailableError("La IA no está configurada en el servidor")
    try:
        result = llm.suggest_gherkin(stored.story)
    except LLMInvalidResponseError as error:
        raise AIInvalidResponseError("La IA devolvió una respuesta inválida") from error
    except LLMError as error:
        raise AIUnavailableError("La IA no está disponible en este momento") from error
    return GherkinResult(
        scenarios=build_gherkin(stored.story, result.scenarios),
        model_name=result.meta.model_name,
        prompt_version=result.meta.prompt_version,
    )
