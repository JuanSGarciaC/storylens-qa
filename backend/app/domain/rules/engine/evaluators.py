import re
from collections.abc import Callable

from app.domain.entities import Finding, Source, Story
from app.domain.rules.catalog import Catalog, RuleDef

Evaluator = Callable[[Story, RuleDef, Catalog], list[Finding]]

_ROLE = re.compile(r"\b(como|as an?)\b", re.IGNORECASE)
_ACTION = re.compile(r"\b(quiero|necesito|deseo|i want|i need)\b", re.IGNORECASE)
_BENEFIT = re.compile(r"\b(para|so that|in order to)\b", re.IGNORECASE)
_GHERKIN = re.compile(r"\b(dado|cuando|entonces|given|when|then)\b", re.IGNORECASE)
_LIMIT_WORDS = re.compile(
    r"\b(longitud|caracteres|monto|m[áa]xim[oa]|m[íi]nim[oa]|l[íi]mite|plazo|"
    r"tiempo|cantidad|length|maximum|minimum|limit)\b",
    re.IGNORECASE,
)
MAX_TITLE_CHARS = 100
MAX_CRITERIA = 8
SNIPPET_RADIUS = 30


def _finding(rule: RuleDef, evidence: str | None = None, **format_args: object) -> Finding:
    return Finding(
        rule_id=rule.id,
        source=Source.RULE,
        severity=rule.severity,
        message=rule.message.format(**format_args),
        suggestion=rule.suggestion,
        reference=rule.reference,
        evidence_text=evidence,
    )


def _snippet(text: str, start: int, end: int) -> str:
    return text[max(0, start - SNIPPET_RADIUS) : end + SNIPPET_RADIUS].strip()


def check_fmt_001(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    parts = {"rol": _ROLE, "acción": _ACTION, "beneficio": _BENEFIT}
    missing = [name for name, pattern in parts.items() if not pattern.search(story.description)]
    if not missing:
        return []
    return [_finding(rule, story.description or None, missing=", ".join(missing))]


def check_fmt_003(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    title = story.title.strip()
    if not title:
        return [_finding(rule, problem="La historia no tiene título.")]
    if len(title) >= MAX_TITLE_CHARS:
        return [_finding(rule, title, problem=f"El título supera {MAX_TITLE_CHARS} caracteres.")]
    return []


def check_ac_001(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    has_criteria = any(c.strip() for c in story.acceptance_criteria)
    return [] if has_criteria else [_finding(rule)]


def check_ac_003(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    criteria = [c for c in story.acceptance_criteria if c.strip()]
    if not criteria or any(_GHERKIN.search(c) for c in criteria):
        return []
    return [_finding(rule)]


def check_ac_006(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    findings = []
    for criterion in story.acceptance_criteria:
        match = _LIMIT_WORDS.search(criterion)
        if match and not re.search(r"\d", criterion):
            findings.append(_finding(rule, criterion.strip(), term=match.group(0).lower()))
    return findings


def check_amb_001(story: Story, rule: RuleDef, catalog: Catalog) -> list[Finding]:
    locations = [story.description, *story.acceptance_criteria]
    findings: list[Finding] = []
    seen: set[tuple[int, str]] = set()
    for index, text in enumerate(locations):
        for term in catalog.vague_terms:
            pattern = re.compile(rf"(?<!\w){re.escape(term)}(?!\w)", re.IGNORECASE)
            match = pattern.search(text)
            if match and (index, term) not in seen:
                seen.add((index, term))
                findings.append(_finding(rule, _snippet(text, *match.span()), term=term))
    return findings


def check_size_001(story: Story, rule: RuleDef, _: Catalog) -> list[Finding]:
    count = len([c for c in story.acceptance_criteria if c.strip()])
    return [_finding(rule, count=count)] if count > MAX_CRITERIA else []


EVALUATORS: dict[str, Evaluator] = {
    "US-FMT-001": check_fmt_001,
    "US-FMT-003": check_fmt_003,
    "US-AC-001": check_ac_001,
    "US-AC-003": check_ac_003,
    "US-AC-006": check_ac_006,
    "US-AMB-001": check_amb_001,
    "US-SIZE-001": check_size_001,
}
