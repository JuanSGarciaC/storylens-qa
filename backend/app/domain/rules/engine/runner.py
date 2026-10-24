from app.domain.entities import Finding, Story
from app.domain.rules.catalog import Catalog, load_catalog
from app.domain.rules.engine.evaluators import EVALUATORS


def evaluate_story(story: Story, catalog: Catalog | None = None) -> list[Finding]:
    """Ejecuta todas las reglas deterministas del catálogo sobre la historia."""
    catalog = catalog or load_catalog()
    findings: list[Finding] = []
    for rule in catalog.of_type("deterministic"):
        findings.extend(EVALUATORS[rule.id](story, rule, catalog))
    return findings
