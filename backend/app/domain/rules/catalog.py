from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from app.domain.entities import Severity

CATALOG_DIR = Path(__file__).parent / "catalog"


@dataclass(frozen=True)
class RuleDef:
    id: str
    name: str
    reference: str
    type: str  # "deterministic" | "ai"
    severity: Severity
    description: str
    message: str
    suggestion: str
    examples: dict[str, dict[str, Any]] = field(default_factory=dict)


@dataclass(frozen=True)
class Catalog:
    version: str
    rules: tuple[RuleDef, ...]
    vague_terms: tuple[str, ...]

    def by_id(self, rule_id: str) -> RuleDef:
        for rule in self.rules:
            if rule.id == rule_id:
                return rule
        raise KeyError(rule_id)

    def of_type(self, rule_type: str) -> tuple[RuleDef, ...]:
        return tuple(r for r in self.rules if r.type == rule_type)


@lru_cache(maxsize=1)
def load_catalog() -> Catalog:
    raw = yaml.safe_load((CATALOG_DIR / "rules.yaml").read_text(encoding="utf-8"))
    terms = yaml.safe_load((CATALOG_DIR / "vague_terms.yaml").read_text(encoding="utf-8"))
    rules = tuple(
        RuleDef(
            id=r["id"],
            name=r["name"],
            reference=r["reference"],
            type=r["type"],
            severity=Severity(r["severity"]),
            description=r["description"],
            message=r["message"],
            suggestion=r["suggestion"],
            examples=r.get("examples", {}),
        )
        for r in raw["rules"]
    )
    ids = [r.id for r in rules]
    if len(ids) != len(set(ids)):
        raise ValueError("El catálogo tiene IDs de regla duplicados")
    vague = tuple(t for lang in terms["terms"].values() for t in lang)
    return Catalog(version=str(raw["version"]), rules=rules, vague_terms=vague)
