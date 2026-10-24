from collections.abc import Sequence

from app.domain.entities import Story, Technique
from app.domain.ports import (
    AIDefectDraft,
    AIFindingDraft,
    AIGherkinDraft,
    AITestCaseDraft,
    DefectContext,
    LLMAnalysis,
    LLMDefect,
    LLMError,
    LLMGherkin,
    LLMMeta,
    LLMTestCases,
)
from app.domain.rules.catalog import RuleDef


class FakeLLM:
    """LLM de mentira para pruebas y modo demo: respuestas fijas, sin red ni cuota."""

    def __init__(
        self,
        drafts: Sequence[AIFindingDraft] = (),
        error: LLMError | None = None,
        model_name: str = "fake-model",
        cases: Sequence[AITestCaseDraft] = (),
        scenarios: Sequence[AIGherkinDraft] = (),
        defect: AIDefectDraft | None = None,
    ) -> None:
        self._drafts = list(drafts)
        self._cases = list(cases)
        self._scenarios = list(scenarios)
        self._defect = defect
        self.last_defect_context: DefectContext | None = None
        self._error = error
        self._model_name = model_name
        self.calls = 0
        self.requested_techniques: list[Technique] = []

    def _meta(self, version: str) -> LLMMeta:
        return LLMMeta(model_name=self._model_name, prompt_version=version)

    def analyze_story(self, story: Story, ai_rules: Sequence[RuleDef]) -> LLMAnalysis:
        self.calls += 1
        if self._error is not None:
            raise self._error
        return LLMAnalysis(
            findings=list(self._drafts),
            model_name=self._model_name,
            prompt_version="analysis-v1",
        )

    def generate_test_cases(self, story: Story, techniques: Sequence[Technique]) -> LLMTestCases:
        self.calls += 1
        self.requested_techniques = list(techniques)
        if self._error is not None:
            raise self._error
        return LLMTestCases(cases=list(self._cases), meta=self._meta("test-cases-v2"))

    def suggest_gherkin(self, story: Story) -> LLMGherkin:
        self.calls += 1
        if self._error is not None:
            raise self._error
        return LLMGherkin(scenarios=list(self._scenarios), meta=self._meta("gherkin-v1"))

    def draft_defect(self, context: DefectContext) -> LLMDefect:
        self.calls += 1
        self.last_defect_context = context
        if self._error is not None:
            raise self._error
        assert self._defect is not None, "FakeLLM sin `defect` configurado"
        return LLMDefect(draft=self._defect, meta=self._meta("defect-v1"))
