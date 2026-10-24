from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from app.domain.entities import QATestCase, Story, Technique
from app.domain.rules.catalog import RuleDef


class LLMError(Exception):
    pass


class LLMUnavailableError(LLMError):
    """No hubo respuesta: sin configurar, límite alcanzado, red o servicio caído."""


class LLMInvalidResponseError(LLMError):
    """La IA respondió algo que no cumple el esquema esperado."""


@dataclass(frozen=True)
class AIFindingDraft:
    """Hallazgo tal como lo propone la IA: aún sin validar contra el catálogo ni la historia."""

    rule_id: str
    message: str
    evidence_text: str
    suggestion: str
    confidence: float


@dataclass(frozen=True)
class AITestCaseDraft:
    """Caso de prueba tal como lo propone la IA, sin validar."""

    title: str
    technique: str
    criterion_index: int | None
    preconditions: str
    steps: list[str]
    test_data: str
    expected_result: str
    gherkin: str | None
    priority: str


@dataclass(frozen=True)
class AIGherkinDraft:
    criterion_index: int | None
    scenario: str


@dataclass(frozen=True)
class DefectContext:
    """Hechos reales de la sesión que la IA debe respetar al redactar el defecto."""

    story_title: str
    case: QATestCase
    actual_result: str
    notes: str
    environment: str
    build_version: str


@dataclass(frozen=True)
class AIDefectDraft:
    title: str
    preconditions: str
    steps: list[str]
    expected_result: str
    actual_result: str
    severity: str
    priority: str


@dataclass(frozen=True)
class LLMMeta:
    model_name: str
    prompt_version: str
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int = 0


@dataclass(frozen=True)
class LLMAnalysis:
    findings: list[AIFindingDraft]
    model_name: str
    prompt_version: str
    prompt_tokens: int | None = None
    output_tokens: int | None = None
    latency_ms: int = 0


@dataclass(frozen=True)
class LLMTestCases:
    cases: list[AITestCaseDraft]
    meta: LLMMeta


@dataclass(frozen=True)
class LLMGherkin:
    scenarios: list[AIGherkinDraft]
    meta: LLMMeta


@dataclass(frozen=True)
class LLMDefect:
    draft: AIDefectDraft
    meta: LLMMeta


class LLMPort(Protocol):
    def analyze_story(self, story: Story, ai_rules: Sequence[RuleDef]) -> LLMAnalysis:
        """Analiza la historia solo contra `ai_rules`. Lanza LLMError si no puede."""
        ...

    def generate_test_cases(self, story: Story, techniques: Sequence[Technique]) -> LLMTestCases:
        """Propone casos de prueba usando solo las técnicas pedidas."""
        ...

    def suggest_gherkin(self, story: Story) -> LLMGherkin:
        """Reescribe los criterios de aceptación como escenarios Dado/Cuando/Entonces."""
        ...

    def draft_defect(self, context: DefectContext) -> LLMDefect:
        """Redacta mejor un defecto a partir de hechos reales; no debe inventar datos."""
        ...
