import logging
from dataclasses import dataclass

from app.domain.entities import AIStatus, Finding, Story
from app.domain.ports import LLMError, LLMInvalidResponseError, LLMPort
from app.domain.rules.ai_findings import build_ai_findings
from app.domain.rules.catalog import load_catalog
from app.domain.rules.engine import evaluate_story
from app.domain.scoring import Score, calculate_score

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AnalysisResult:
    findings: list[Finding]
    score: Score
    catalog_version: str
    ai_status: AIStatus
    model_name: str | None = None
    prompt_version: str | None = None

    @property
    def used_ai(self) -> bool:
        return self.ai_status == AIStatus.OK


def analyze_story(story: Story, llm: LLMPort | None = None, use_ai: bool = False) -> AnalysisResult:
    """Reglas siempre; la IA solo complementa y, si falla, el análisis sigue con las reglas."""
    catalog = load_catalog()
    findings = evaluate_story(story, catalog)
    status = AIStatus.NOT_REQUESTED
    model_name = prompt_version = None

    if use_ai:
        status = AIStatus.UNAVAILABLE
        if llm is not None:
            try:
                analysis = llm.analyze_story(story, catalog.of_type("ai"))
            except LLMInvalidResponseError:
                status = AIStatus.INVALID_RESPONSE
            except LLMError:
                status = AIStatus.UNAVAILABLE
            else:
                built = build_ai_findings(story, analysis.findings, catalog)
                if built.discarded:
                    logger.info("Hallazgos de IA descartados: %s", dict(built.discarded))
                findings = [*findings, *built.findings]
                status = AIStatus.OK
                model_name, prompt_version = analysis.model_name, analysis.prompt_version

    return AnalysisResult(
        findings=findings,
        score=calculate_score(findings),
        catalog_version=catalog.version,
        ai_status=status,
        model_name=model_name,
        prompt_version=prompt_version,
    )
