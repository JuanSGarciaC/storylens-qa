"""Validación de lo que propone la IA para el diseño de pruebas, y trazabilidad.

Igual que con los hallazgos: la IA sugiere, y nada entra sin pasar estas comprobaciones.
"""

import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.domain.entities import (
    CaseOrigin,
    CaseStatus,
    Priority,
    QATestCase,
    Story,
    Technique,
)
from app.domain.ports.llm import AIGherkinDraft, AITestCaseDraft

MAX_CASES = 15
MAX_STEPS = 12
MAX_TEXT_CHARS = 500

_GHERKIN_KEYWORDS = re.compile(r"\b(dado|cuando|entonces|given|when|then)\b", re.IGNORECASE)
_SPACES = re.compile(r"\s+")


def _clean(text: str | None, limit: int = MAX_TEXT_CHARS) -> str:
    return (text or "").strip()[:limit]


def _valid_index(index: int | None, story: Story) -> int | None:
    if index is not None and 1 <= index <= len(story.acceptance_criteria):
        return index
    return None


@dataclass(frozen=True)
class BuiltCases:
    cases: list[QATestCase]
    discarded: Counter[str] = field(default_factory=Counter)


def build_test_cases(
    story: Story, drafts: Sequence[AITestCaseDraft], allowed: Sequence[Technique]
) -> BuiltCases:
    cases: list[QATestCase] = []
    discarded: Counter[str] = Counter()
    seen_titles: set[str] = set()

    for draft in drafts:
        try:
            technique = Technique(draft.technique)
        except ValueError:
            discarded["unknown_technique"] += 1
            continue
        if technique not in allowed:
            discarded["technique_not_requested"] += 1
            continue

        steps = tuple(_clean(s) for s in draft.steps if _clean(s))[:MAX_STEPS]
        title = _clean(draft.title, 150)
        expected = _clean(draft.expected_result)
        if not (title and steps and expected):
            discarded["incomplete"] += 1
            continue

        key = _SPACES.sub(" ", title).casefold()
        if key in seen_titles:
            discarded["duplicate"] += 1
            continue
        if len(cases) >= MAX_CASES:
            discarded["over_limit"] += 1
            continue
        seen_titles.add(key)

        try:
            priority = Priority(draft.priority)
        except ValueError:
            priority = Priority.MEDIUM

        cases.append(
            QATestCase(
                title=title,
                technique=technique,
                steps=steps,
                expected_result=expected,
                criterion_index=_valid_index(draft.criterion_index, story),
                preconditions=_clean(draft.preconditions),
                test_data=_clean(draft.test_data),
                gherkin=_clean(draft.gherkin, 1000) or None,
                priority=priority,
                origin=CaseOrigin.AI,
                status=CaseStatus.PROPOSED,
            )
        )
    return BuiltCases(cases=cases, discarded=discarded)


@dataclass(frozen=True)
class GherkinScenario:
    criterion_index: int | None
    text: str


def build_gherkin(story: Story, drafts: Sequence[AIGherkinDraft]) -> list[GherkinScenario]:
    """Conserva solo escenarios que realmente usan Dado/Cuando/Entonces."""
    scenarios = []
    for draft in drafts:
        text = _clean(draft.scenario, 1000)
        keywords = {m.group(0).casefold() for m in _GHERKIN_KEYWORDS.finditer(text)}
        has_structure = bool(keywords & {"cuando", "when"}) and bool(
            keywords & {"entonces", "then"}
        )
        if has_structure:
            scenarios.append(GherkinScenario(_valid_index(draft.criterion_index, story), text))
    return scenarios


@dataclass(frozen=True)
class TraceRow:
    index: int
    text: str
    accepted_ids: list[str]
    proposed_ids: list[str]

    @property
    def covered(self) -> bool:
        return bool(self.accepted_ids)


@dataclass(frozen=True)
class Traceability:
    rows: list[TraceRow]
    unlinked_ids: list[str]  # casos activos sin criterio asociado

    @property
    def coverage(self) -> float:
        """Fracción de criterios con al menos un caso aceptado."""
        if not self.rows:
            return 0.0
        return sum(r.covered for r in self.rows) / len(self.rows)


def build_traceability(story: Story, cases: Sequence[QATestCase]) -> Traceability:
    rows = []
    for index, text in enumerate(story.acceptance_criteria, start=1):
        linked = [c for c in cases if c.criterion_index == index and c.id]
        rows.append(
            TraceRow(
                index=index,
                text=text,
                accepted_ids=[c.id for c in linked if c.status == CaseStatus.ACCEPTED and c.id],
                proposed_ids=[c.id for c in linked if c.status == CaseStatus.PROPOSED and c.id],
            )
        )
    unlinked = [
        c.id
        for c in cases
        if c.criterion_index is None and c.status != CaseStatus.REJECTED and c.id
    ]
    return Traceability(rows=rows, unlinked_ids=unlinked)
