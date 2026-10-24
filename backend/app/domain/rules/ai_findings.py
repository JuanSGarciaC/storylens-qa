"""Convierte las propuestas de la IA en hallazgos confiables.

La IA solo sugiere: nada de lo que diga entra al análisis sin pasar estas comprobaciones.
"""

import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.domain.entities import Finding, Source, Story
from app.domain.ports.llm import AIFindingDraft
from app.domain.rules.catalog import Catalog

MAX_AI_FINDINGS = 10
MAX_TEXT_CHARS = 500

_QUOTES = re.compile(r"[«»\"'“”‘’]")
_SPACES = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _SPACES.sub(" ", _QUOTES.sub("", text)).strip().casefold()


def story_text(story: Story) -> str:
    return "\n".join([story.title, story.description, *story.acceptance_criteria, story.notes])


@dataclass(frozen=True)
class AIFindingsResult:
    findings: list[Finding]
    discarded: Counter[str] = field(default_factory=Counter)


def build_ai_findings(
    story: Story, drafts: Sequence[AIFindingDraft], catalog: Catalog
) -> AIFindingsResult:
    """Descarta lo que no cumple y toma severidad y norma del catálogo, nunca de la IA."""
    ai_rules = {r.id: r for r in catalog.of_type("ai")}
    haystack = _normalize(story_text(story))
    findings: list[Finding] = []
    discarded: Counter[str] = Counter()
    seen: set[tuple[str, str]] = set()

    for draft in drafts:
        rule = ai_rules.get(draft.rule_id)
        if rule is None:
            discarded["unknown_rule"] += 1
            continue
        evidence = _normalize(draft.evidence_text)
        if not evidence:
            discarded["no_evidence"] += 1
            continue
        if evidence not in haystack:
            discarded["evidence_not_in_story"] += 1  # posible alucinación
            continue
        if (rule.id, evidence) in seen:
            discarded["duplicate"] += 1
            continue
        if len(findings) >= MAX_AI_FINDINGS:
            discarded["over_limit"] += 1
            continue
        seen.add((rule.id, evidence))
        findings.append(
            Finding(
                rule_id=rule.id,
                source=Source.AI,
                severity=rule.severity,
                message=draft.message.strip()[:MAX_TEXT_CHARS] or rule.message,
                suggestion=draft.suggestion.strip()[:MAX_TEXT_CHARS] or rule.suggestion,
                reference=rule.reference,
                evidence_text=draft.evidence_text.strip()[:MAX_TEXT_CHARS],
                confidence=min(1.0, max(0.0, draft.confidence)),
            )
        )
    return AIFindingsResult(findings=findings, discarded=discarded)
