import re
from collections.abc import Sequence
from functools import lru_cache
from pathlib import Path

from app.domain.entities import Story, Technique
from app.domain.ports.llm import DefectContext
from app.domain.rules.catalog import RuleDef

PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"
ANALYSIS_PROMPT_VERSION = "analysis-v1"
TEST_CASES_PROMPT_VERSION = "test-cases-v2"
GHERKIN_PROMPT_VERSION = "gherkin-v1"
DEFECT_PROMPT_VERSION = "defect-v1"

TECHNIQUE_HELP: dict[Technique, str] = {
    Technique.EQUIVALENCE_PARTITIONING: (
        "Partición de equivalencia: un caso por cada clase válida e inválida de entradas."
    ),
    Technique.BOUNDARY_VALUE: (
        "Análisis de valores límite: valores en el límite, justo por debajo y justo por encima "
        "de cada límite numérico."
    ),
    Technique.DECISION_TABLE: (
        "Tabla de decisión: combinaciones de condiciones de las reglas de negocio y su resultado."
    ),
    Technique.STATE_TRANSITION: ("Transición de estados: cambios de estado válidos e inválidos."),
    Technique.SCENARIO: (
        "Escenario / caso de uso: flujos de punta a punta, camino feliz y alternos."
    ),
    Technique.ERROR_GUESSING: (
        "Predicción de errores: campos vacíos, caracteres especiales, doble envío, sesión expirada."
    ),
}

# Etiquetas que delimitan los datos del usuario: se quitan de su texto para que no pueda cerrarlas.
_DATA_TAG = re.compile(r"</?\s*(historia|defecto)\s*>", re.IGNORECASE)


@lru_cache
def _load(name: str, version: str) -> str:
    return (PROMPTS_DIR / name / f"{version}.md").read_text(encoding="utf-8")


def build_system_prompt(ai_rules: Sequence[RuleDef]) -> str:
    rules = "\n".join(
        f"- {r.id} — {r.name}: {r.description} (norma: {r.reference})" for r in ai_rules
    )
    return _load("analysis", "v1").replace("{{RULES}}", rules)


def build_test_cases_prompt(techniques: Sequence[Technique]) -> str:
    listing = "\n".join(f"- `{t.value}` — {TECHNIQUE_HELP[t]}" for t in techniques)
    return _load("test_cases", "v2").replace("{{TECHNIQUES}}", listing)


def build_gherkin_prompt() -> str:
    return _load("gherkin", "v1")


def build_story_prompt(story: Story) -> str:
    """Arma el contenido a analizar. Quita etiquetas <historia> internas para que el texto
    del usuario no pueda cerrar el bloque de datos y colar instrucciones."""

    def clean(text: str) -> str:
        return _DATA_TAG.sub("", text).strip()

    criteria = "\n".join(f"{i}. {clean(c)}" for i, c in enumerate(story.acceptance_criteria, 1))
    parts = [
        f"Título: {clean(story.title)}",
        f"Descripción: {clean(story.description)}",
        f"Criterios:\n{criteria}" if criteria else "Criterios: (ninguno)",
    ]
    if story.notes.strip():
        parts.append(f"Notas: {clean(story.notes)}")
    return "<historia>\n" + "\n".join(parts) + "\n</historia>"


def build_defect_system_prompt() -> str:
    return _load("defect", "v1")


def build_defect_prompt(context: DefectContext) -> str:
    def clean(text: str) -> str:
        return _DATA_TAG.sub("", text).strip()

    case = context.case
    lines = [
        "<defecto>",
        f"Historia: {clean(context.story_title)}",
        f"Caso de prueba: {clean(case.title)}",
        f"Precondiciones: {clean(case.preconditions)}",
        "Pasos:",
        *(f"{i}. {clean(step)}" for i, step in enumerate(case.steps, 1)),
        f"Resultado esperado: {clean(case.expected_result)}",
        f"Resultado obtenido (según el analista): {clean(context.actual_result)}",
        f"Notas del analista: {clean(context.notes)}",
        f"Ambiente: {clean(context.environment)}",
        f"Build: {clean(context.build_version)}",
        "</defecto>",
    ]
    return "\n".join(lines)
