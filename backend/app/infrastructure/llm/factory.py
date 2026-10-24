from functools import lru_cache

from google import genai
from google.genai import types

from app.config import get_settings
from app.domain.ports import LLMPort
from app.infrastructure.llm.gemini import GeminiAdapter

RETRYABLE_STATUS = [429, 500, 503]


@lru_cache
def build_llm() -> LLMPort | None:
    """Un único adaptador por proceso (comparte límites y caché). None si no hay clave/modelo."""
    settings = get_settings()
    if not settings.ai_configured:
        return None
    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(
            timeout=settings.gemini_timeout_seconds * 1000,
            retry_options=types.HttpRetryOptions(
                attempts=settings.gemini_max_retries,
                initial_delay=1.0,
                max_delay=8.0,
                http_status_codes=RETRYABLE_STATUS,
            ),
        ),
    )
    assert settings.gemini_model is not None  # garantizado por ai_configured
    return GeminiAdapter(
        client=client,
        model=settings.gemini_model,
        fallback_model=settings.gemini_fallback_model,
        requests_per_minute=settings.ai_requests_per_minute,
        daily_limit=settings.ai_daily_limit,
    )
