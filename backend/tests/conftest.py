import pytest

from app.config import get_settings
from app.domain.entities import Story
from app.infrastructure.llm.factory import build_llm

BASE_STORY = {
    "title": "Recuperar contraseña",
    "description": (
        "Como usuario registrado quiero restablecer mi contraseña "
        "para recuperar el acceso a mi cuenta"
    ),
    "criteria": [
        "Dado un correo registrado, cuando solicito restablecer, "
        "entonces recibo un enlace que expira en 30 minutos",
        "Dado un enlace expirado, cuando intento usarlo, "
        "entonces veo el mensaje 'El enlace expiró'",
        "Dado una contraseña nueva de 8 a 64 caracteres, cuando la confirmo, "
        "entonces puedo iniciar sesión",
    ],
}


def make_story(**overrides: object) -> Story:
    data = {**BASE_STORY, **overrides}
    return Story(
        title=str(data["title"]),
        description=str(data["description"]),
        acceptance_criteria=tuple(data["criteria"]),  # type: ignore[arg-type]
        notes=str(data.get("notes", "")),
    )


@pytest.fixture
def good_story() -> Story:
    return make_story()


@pytest.fixture(autouse=True)
def _never_call_real_gemini(monkeypatch: pytest.MonkeyPatch):
    """Ninguna prueba puede usar la clave real de backend/.env ni gastar cuota."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_MODEL", "")
    monkeypatch.setenv("OWNER_EMAIL", "owner@test.local")
    monkeypatch.setenv("OWNER_PASSWORD", "test-pass-123")
    monkeypatch.setenv("SESSION_SECRET", "test-secret")
    # scrypt barato: en producción se usa 2**14; aquí solo importa que el flujo funcione.
    monkeypatch.setattr("app.domain.auth._SCRYPT_N", 16)
    get_settings.cache_clear()
    build_llm.cache_clear()
    yield
    get_settings.cache_clear()
    build_llm.cache_clear()
