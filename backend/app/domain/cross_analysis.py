"""Análisis transversal del conjunto de historias de un proyecto.

Lógica pura y determinística (sin IA): compara historias entre sí y resume el riesgo por épica.
Lo que son sospechas (contradicciones) se marca como hipótesis: nunca se afirma.
"""

import re
import unicodedata
from dataclasses import dataclass

DUPLICATE_THRESHOLD = 0.6
CONTRADICTION_SUBJECT_OVERLAP = 0.35
MIN_TITLE_TOKENS_FOR_MENTION = 3

STOPWORDS = frozenset(
    "el la los las un una unos unas de del al y o u en a con por para que se su sus lo "
    "como quiero quiere puede pueden debe deben ser es son este esta estos estas mi mis "
    "the and for with from that this".split()
)
NEGATION = re.compile(r"\b(no debe|no deben|no puede|no pueden|nunca|prohib\w+|sin permitir)\b")
AFFIRMATION = re.compile(r"\b(debe|deben|puede|pueden|siempre|permit\w+)\b")
NUMBER = re.compile(r"\b(\d+)\s*([a-z]{3,})")


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def tokens(text: str) -> frozenset[str]:
    words = re.findall(r"[a-z0-9]+", _fold(text))
    return frozenset(w for w in words if len(w) > 2 and w not in STOPWORDS)


@dataclass(frozen=True)
class StoryFacts:
    id: str
    title: str
    description: str
    criteria: tuple[str, ...]
    key: str | None
    epic_id: str | None
    verdict: str | None  # None = sin analizar
    score: int | None
    case_count: int
    accepted_cases: int

    @property
    def text(self) -> str:
        return " ".join([self.title, self.description, *self.criteria])


@dataclass(frozen=True)
class DuplicatePair:
    a_id: str
    b_id: str
    similarity: float


@dataclass(frozen=True)
class DependencyLink:
    from_id: str  # la historia que menciona
    to_id: str  # la historia mencionada
    evidence: str


@dataclass(frozen=True)
class ContradictionHint:
    a_id: str
    b_id: str
    reason: str  # siempre una hipótesis a revisar a mano


@dataclass(frozen=True)
class EpicRisk:
    epic_id: str | None
    stories: int
    analyzed: int
    not_ready: int
    without_cases: int
    average_score: float | None
    level: str  # "high" | "medium" | "low" | "unknown"
    reason: str


@dataclass(frozen=True)
class CrossAnalysis:
    total_stories: int
    duplicates: list[DuplicatePair]
    dependencies: list[DependencyLink]
    contradictions: list[ContradictionHint]
    epic_risks: list[EpicRisk]
    without_cases: list[str]


def _jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    union = a | b
    return len(a & b) / len(union) if union else 0.0


def find_duplicates(stories: list[StoryFacts]) -> list[DuplicatePair]:
    sets = [tokens(s.title) | tokens(s.description) for s in stories]
    titles = [_fold(s.title).strip() for s in stories]
    pairs = []
    for i in range(len(stories)):
        for j in range(i + 1, len(stories)):
            same_title = bool(titles[i]) and titles[i] == titles[j]
            similarity = 1.0 if same_title else _jaccard(sets[i], sets[j])
            if similarity >= DUPLICATE_THRESHOLD:
                pairs.append(DuplicatePair(stories[i].id, stories[j].id, round(similarity, 2)))
    return sorted(pairs, key=lambda p: -p.similarity)


def find_dependencies(stories: list[StoryFacts]) -> list[DependencyLink]:
    links: dict[tuple[str, str], DependencyLink] = {}
    for source in stories:
        folded = _fold(source.text)
        for target in stories:
            if target.id == source.id:
                continue
            evidence = None
            if target.key and re.search(rf"\b{re.escape(target.key.casefold())}\b", folded):
                evidence = f"menciona la clave {target.key}"
            else:
                title_tokens = tokens(target.title)
                title = _fold(target.title).strip()
                if len(title_tokens) >= MIN_TITLE_TOKENS_FOR_MENTION and title in folded:
                    evidence = f"menciona el título «{target.title}»"
            if evidence:
                links[(source.id, target.id)] = DependencyLink(source.id, target.id, evidence)
    return list(links.values())


def _numbers(text: str) -> dict[str, set[str]]:
    found: dict[str, set[str]] = {}
    for amount, unit in NUMBER.findall(_fold(text)):
        found.setdefault(unit, set()).add(amount)
    return found


def find_contradictions(
    stories: list[StoryFacts], duplicates: list[DuplicatePair]
) -> list[ContradictionHint]:
    """Hipótesis: mismo tema con cifras distintas o con obligación y prohibición opuestas."""
    skip = {(d.a_id, d.b_id) for d in duplicates}
    hints = []
    subjects = [tokens(s.title) | tokens(s.description) for s in stories]
    for i in range(len(stories)):
        for j in range(i + 1, len(stories)):
            a, b = stories[i], stories[j]
            if (a.id, b.id) in skip or _jaccard(
                subjects[i], subjects[j]
            ) < CONTRADICTION_SUBJECT_OVERLAP:
                continue
            reasons = []
            na, nb = _numbers(a.text), _numbers(b.text)
            for unit in sorted(set(na) & set(nb)):
                if na[unit] != nb[unit]:
                    mine, theirs = sorted(na[unit]), sorted(nb[unit])
                    reasons.append(f"cifras distintas para «{unit}»: {mine} frente a {theirs}")
            fa, fb = _fold(a.text), _fold(b.text)
            if (NEGATION.search(fa) and AFFIRMATION.search(fb)) or (
                NEGATION.search(fb) and AFFIRMATION.search(fa)
            ):
                reasons.append("una exige lo que la otra prohíbe")
            if reasons:
                hints.append(
                    ContradictionHint(
                        a.id, b.id, "Hipótesis, revisar a mano: " + "; ".join(reasons)
                    )
                )
    return hints


def epic_risks(stories: list[StoryFacts]) -> list[EpicRisk]:
    groups: dict[str | None, list[StoryFacts]] = {}
    for story in stories:
        groups.setdefault(story.epic_id, []).append(story)
    risks = []
    for epic_id, items in groups.items():
        analyzed = [s for s in items if s.verdict is not None]
        not_ready = sum(1 for s in analyzed if s.verdict == "not_ready")
        without_cases = sum(1 for s in items if s.accepted_cases == 0)
        scores = [s.score for s in analyzed if s.score is not None]
        average = round(sum(scores) / len(scores), 1) if scores else None
        if not analyzed:
            level, reason = "unknown", "Ninguna historia de este grupo está analizada."
        else:
            share = not_ready / len(analyzed)
            if share >= 0.4 or (average is not None and average < 60):
                level = "high"
                reason = f"{not_ready} de {len(analyzed)} historias analizadas no están listas"
            elif (
                share >= 0.2
                or (average is not None and average < 75)
                or without_cases / len(items) >= 0.5
            ):
                level = "medium"
                reason = (
                    f"{not_ready} no listas y {without_cases} sin casos aceptados de {len(items)}"
                )
            else:
                level = "low"
                reason = f"{not_ready} no listas de {len(analyzed)} analizadas"
        risks.append(
            EpicRisk(
                epic_id=epic_id,
                stories=len(items),
                analyzed=len(analyzed),
                not_ready=not_ready,
                without_cases=without_cases,
                average_score=average,
                level=level,
                reason=reason,
            )
        )
    order = {"high": 0, "medium": 1, "unknown": 2, "low": 3}
    return sorted(risks, key=lambda r: (order[r.level], -r.stories))


def analyze_project(stories: list[StoryFacts]) -> CrossAnalysis:
    duplicates = find_duplicates(stories)
    return CrossAnalysis(
        total_stories=len(stories),
        duplicates=duplicates,
        dependencies=find_dependencies(stories),
        contradictions=find_contradictions(stories, duplicates),
        epic_risks=epic_risks(stories),
        without_cases=[s.id for s in stories if s.accepted_cases == 0],
    )
