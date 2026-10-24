from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"
    max_story_chars: int = 10_000
    database_url: str = "sqlite:///./storylens.db"
    evidence_dir: str = "./storage/evidence"
    max_evidence_mb: int = 5

    # Nunca se registra ni se expone.
    gemini_api_key: str | None = Field(default=None, repr=False)
    gemini_model: str | None = None
    # Los límites de Gemini son por modelo: el de respaldo tiene su propia cuota.
    gemini_fallback_model: str | None = None
    gemini_timeout_seconds: int = 30
    gemini_max_retries: int = 3
    # Tope local para no agotar la cuota gratuita (el modelo elegido admite 15/min).
    ai_requests_per_minute: int = 12
    ai_daily_limit: int = 150

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
