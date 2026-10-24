from collections.abc import Iterable

from app.domain.entities import Finding, Story
from app.domain.rules.catalog import Catalog, load_catalog
from app.domain.rules.engine.evaluators import EVALUATORS


def evaluate_story(
    story: Story, catalog: Catalog | None = None, disabled_rules: Iterable[str] = ()
) -> list[Finding]:
    """Ejecuta las reglas deterministas del catálogo, salvo las que el proyecto desactivó."""
    catalog = catalog or load_catalog()
    disabled = set(disabled_rules)
    findings: list[Finding] = []
    for rule in catalog.of_type("deterministic"):
        if rule.id not in disabled:
            findings.extend(EVALUATORS[rule.id](story, rule, catalog))
    return findings
