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
    max_evidence_mb: int = 1

    # Cuenta del dueño y sesión. Sin estos valores no hay dueño: solo se ve la demo.
    owner_email: str | None = None
    owner_password: str | None = Field(default=None, repr=False)
    session_secret: str | None = Field(default=None, repr=False)
    session_ttl_hours: int = 12
    cookie_secure: bool = False
    # Crea el proyecto de demostración (solo lectura) al arrancar si no existe.
    seed_demo: bool = True
    # Aplica las migraciones de Alembic al arrancar (si es False, crea las tablas sin historial).
    run_migrations: bool = True

    # Nunca se registra ni se expone.
    gemini_api_key: str | None = Field(default=None, repr=False)
    gemini_model: str | None = None
    # Los límites de Gemini son por modelo: el de respaldo tiene su propia cuota.
    gemini_fallback_model: str | None = None
    gemini_timeout_seconds: int = 30
    gemini_max_retries: int = 3
    # Topes propios, más estrictos que la capa gratuita: al agotarse la IA se apaga y la app
    # sigue con las reglas determinísticas. Nunca se paga por pasarse del límite.
    ai_requests_per_minute: int = 5
    ai_daily_limit: int = 50

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_configured(self) -> bool:
        return bool(self.gemini_api_key and self.gemini_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
