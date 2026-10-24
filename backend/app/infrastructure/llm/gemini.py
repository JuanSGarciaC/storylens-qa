import hashlib
import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Sequence
from typing import Any, TypeVar, cast

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

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
    LLMInvalidResponseError,
    LLMMeta,
    LLMTestCases,
    LLMUnavailableError,
)
from app.domain.rules.catalog import RuleDef
from app.infrastructure.llm.prompts import (
    ANALYSIS_PROMPT_VERSION,
    DEFECT_PROMPT_VERSION,
    GHERKIN_PROMPT_VERSION,
    TEST_CASES_PROMPT_VERSION,
    build_defect_prompt,
    build_defect_system_prompt,
    build_gherkin_prompt,
    build_story_prompt,
    build_system_prompt,
    build_test_cases_prompt,
)
from app.infrastructure.llm.rate_limiter import SlidingWindowLimiter

logger = logging.getLogger(__name__)

ONE_DAY_SECONDS = 24 * 60 * 60
ANALYSIS_TEMPERATURE = 0.2  # análisis: lo más reproducible posible
GHERKIN_TEMPERATURE = 0.3
DEFECT_TEMPERATURE = 0.2  # redactar hechos, no inventar
TEST_CASES_TEMPERATURE = 0.5  # diseño de casos: algo más de variedad

# Los esquemas que se envían a Gemini no llevan valores por defecto: la API puede rechazarlos.


class _FindingDTO(BaseModel):
    rule_id: str
    message: str
    evidence_text: str
    suggestion: str
    confidence: float


class _AnalysisDTO(BaseModel):
    """Esquema que Gemini debe cumplir; se vuelve a validar aquí antes de usarlo."""

    findings: list[_FindingDTO]


class _CaseDTO(BaseModel):
    title: str
    technique: str
    criterion_index: int | None
    preconditions: str
    steps: list[str]
    test_data: str
    expected_result: str
    gherkin: str | None
    priority: str


class _CasesDTO(BaseModel):
    cases: list[_CaseDTO]


class _ScenarioDTO(BaseModel):
    criterion_index: int | None
    scenario: str


class _GherkinDTO(BaseModel):
    scenarios: list[_ScenarioDTO]


class _DefectDTO(BaseModel):
    title: str
    preconditions: str
    steps: list[str]
    expected_result: str
    actual_result: str
    severity: str
    priority: str


T = TypeVar("T", bound=BaseModel)


class GeminiAdapter:
    def __init__(
        self,
        client: genai.Client,
        model: str,
        fallback_model: str | None = None,
        requests_per_minute: int = 12,
        daily_limit: int = 150,
        temperature: float = ANALYSIS_TEMPERATURE,
        cache_size: int = 128,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._models = [model, *([fallback_model] if fallback_model else [])]
        self._analysis_temperature = temperature
        # La cuota de Gemini es por modelo, así que cada modelo tiene sus propios topes.
        self._limits = {
            m: (
                SlidingWindowLimiter(requests_per_minute, 60, clock),
                SlidingWindowLimiter(daily_limit, ONE_DAY_SECONDS, clock),
            )
            for m in self._models
        }
        self._cache: OrderedDict[str, tuple[Any, LLMMeta]] = OrderedDict()
        self._cache_size = cache_size
        self._cache_lock = threading.Lock()

    # --- operaciones del puerto ---
    def analyze_story(self, story: Story, ai_rules: Sequence[RuleDef]) -> LLMAnalysis:
        dto, meta = self._generate(
            version=ANALYSIS_PROMPT_VERSION,
            schema=_AnalysisDTO,
            system=build_system_prompt(ai_rules),
            contents=build_story_prompt(story),
            temperature=self._analysis_temperature,
        )
        return LLMAnalysis(
            findings=[AIFindingDraft(**f.model_dump()) for f in dto.findings],
            model_name=meta.model_name,
            prompt_version=meta.prompt_version,
            prompt_tokens=meta.prompt_tokens,
            output_tokens=meta.output_tokens,
            latency_ms=meta.latency_ms,
        )

    def generate_test_cases(self, story: Story, techniques: Sequence[Technique]) -> LLMTestCases:
        dto, meta = self._generate(
            version=TEST_CASES_PROMPT_VERSION,
            schema=_CasesDTO,
            system=build_test_cases_prompt(techniques),
            contents=build_story_prompt(story),
            temperature=TEST_CASES_TEMPERATURE,
        )
        return LLMTestCases(cases=[AITestCaseDraft(**c.model_dump()) for c in dto.cases], meta=meta)

    def suggest_gherkin(self, story: Story) -> LLMGherkin:
        dto, meta = self._generate(
            version=GHERKIN_PROMPT_VERSION,
            schema=_GherkinDTO,
            system=build_gherkin_prompt(),
            contents=build_story_prompt(story),
            temperature=GHERKIN_TEMPERATURE,
        )
        return LLMGherkin(
            scenarios=[AIGherkinDraft(s.criterion_index, s.scenario) for s in dto.scenarios],
            meta=meta,
        )

    def draft_defect(self, context: DefectContext) -> LLMDefect:
        dto, meta = self._generate(
            version=DEFECT_PROMPT_VERSION,
            schema=_DefectDTO,
            system=build_defect_system_prompt(),
            contents=build_defect_prompt(context),
            temperature=DEFECT_TEMPERATURE,
        )
        return LLMDefect(draft=AIDefectDraft(**dto.model_dump()), meta=meta)

    # --- lógica común: caché, modelo de respaldo, límites y validación del esquema ---
    def _generate(
        self, *, version: str, schema: type[T], system: str, contents: str, temperature: float
    ) -> tuple[T, LLMMeta]:
        key = hashlib.sha256("\x00".join([version, system, contents]).encode()).hexdigest()
        if (cached := self._cache_get(key)) is not None:
            logger.info("gemini.cache_hit prompt=%s", version)
            return cast(tuple[T, LLMMeta], cached)

        last_error: LLMError | None = None
        for model in self._models:
            try:
                result = self._call(model, version, schema, system, contents, temperature)
            except LLMError as error:
                logger.warning("gemini.failed model=%s prompt=%s error=%s", model, version, error)
                last_error = error
                continue
            self._cache_put(key, result)
            return result
        raise last_error or LLMUnavailableError("No hay modelos de IA configurados")

    def _call(
        self,
        model: str,
        version: str,
        schema: type[T],
        system: str,
        contents: str,
        temperature: float,
    ) -> tuple[T, LLMMeta]:
        config = types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=temperature,
        )
        for _attempt in range(2):  # un reintento si la respuesta no cumple el esquema
            if not self._acquire(model):
                raise LLMUnavailableError(f"Límite local de peticiones alcanzado ({model})")
            started = time.perf_counter()
            try:
                response = self._client.models.generate_content(
                    model=model, contents=contents, config=config
                )
            except errors.APIError as error:
                raise LLMUnavailableError(f"Gemini respondió {error.code} ({model})") from error
            except Exception as error:  # red, timeout, etc.
                raise LLMUnavailableError(
                    f"Fallo de conexión con Gemini ({type(error).__name__})"
                ) from error

            parsed = response.parsed
            if isinstance(parsed, schema):
                usage = response.usage_metadata
                meta = LLMMeta(
                    model_name=model,
                    prompt_version=version,
                    prompt_tokens=usage.prompt_token_count if usage else None,
                    output_tokens=usage.candidates_token_count if usage else None,
                    latency_ms=round((time.perf_counter() - started) * 1000),
                )
                logger.info(
                    "gemini.call model=%s prompt=%s prompt_tokens=%s output_tokens=%s "
                    "latency_ms=%d",
                    model,
                    version,
                    meta.prompt_tokens,
                    meta.output_tokens,
                    meta.latency_ms,
                )
                return parsed, meta
            logger.warning("gemini.invalid_response model=%s prompt=%s", model, version)
        raise LLMInvalidResponseError(f"Respuesta de {model} fuera del esquema")

    def _acquire(self, model: str) -> bool:
        per_minute, per_day = self._limits[model]
        return per_minute.try_acquire() and per_day.try_acquire()

    def _cache_get(self, key: str) -> tuple[Any, LLMMeta] | None:
        with self._cache_lock:
            result = self._cache.get(key)
            if result is not None:
                self._cache.move_to_end(key)
            return result

    def _cache_put(self, key: str, result: tuple[Any, LLMMeta]) -> None:
        with self._cache_lock:
            self._cache[key] = result
            while len(self._cache) > self._cache_size:
                self._cache.popitem(last=False)
