from app.config import get_settings
from app.infrastructure.llm.factory import build_llm


def test_test_suite_never_gets_a_real_llm():
    """Si esto falla, las pruebas podrían gastar la cuota de Gemini con la clave real."""
    assert get_settings().ai_configured is False
    assert build_llm() is None
