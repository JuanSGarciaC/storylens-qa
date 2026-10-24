from app.domain.entities import Severity, Source
from app.domain.ports import AIFindingDraft
from app.domain.rules.ai_findings import MAX_AI_FINDINGS, build_ai_findings
from app.domain.rules.catalog import load_catalog
from tests.conftest import make_story

CATALOG = load_catalog()
STORY = make_story()
VALID_EVIDENCE = "Dado un enlace expirado, cuando intento usarlo"


def draft(**overrides) -> AIFindingDraft:
    base = {
        "rule_id": "US-AC-004",
        "message": "Solo se cubre el camino feliz.",
        "evidence_text": VALID_EVIDENCE,
        "suggestion": "Agregue casos de error.",
        "confidence": 0.9,
    }
    return AIFindingDraft(**{**base, **overrides})


def build(*drafts):
    return build_ai_findings(STORY, drafts, CATALOG)


def test_valid_draft_becomes_an_ai_finding_with_catalog_severity_and_reference():
    result = build(draft())
    assert not result.discarded
    (finding,) = result.findings
    rule = CATALOG.by_id("US-AC-004")
    assert finding.source == Source.AI
    assert finding.severity == rule.severity
    assert finding.reference == rule.reference
    assert finding.confidence == 0.9
    assert finding.message == "Solo se cubre el camino feliz."


def test_unknown_rule_is_discarded():
    result = build(draft(rule_id="QA-VAGUE-001"))  # id inventado por la IA
    assert result.findings == []
    assert result.discarded["unknown_rule"] == 1


def test_deterministic_rules_cannot_be_reported_by_the_ai():
    result = build(draft(rule_id="US-AMB-001"))
    assert result.findings == []
    assert result.discarded["unknown_rule"] == 1


def test_evidence_not_in_story_is_discarded_as_hallucination():
    result = build(draft(evidence_text="El usuario debe poder pagar con criptomonedas"))
    assert result.findings == []
    assert result.discarded["evidence_not_in_story"] == 1


def test_empty_evidence_is_discarded():
    result = build(draft(evidence_text="   "))
    assert result.discarded["no_evidence"] == 1


def test_evidence_match_ignores_case_quotes_and_spacing():
    sloppy = "«DADO  un enlace\nexpirado», cuando intento usarlo"
    assert len(build(draft(evidence_text=sloppy)).findings) == 1


def test_duplicates_are_discarded():
    result = build(draft(), draft(message="Otra redacción"))
    assert len(result.findings) == 1
    assert result.discarded["duplicate"] == 1


def test_same_evidence_under_different_rules_is_kept():
    result = build(draft(rule_id="US-AC-004"), draft(rule_id="US-AC-005"))
    assert len(result.findings) == 2


def test_confidence_is_clamped():
    high, low = build(draft(confidence=7), draft(rule_id="US-AC-005", confidence=-3)).findings
    assert (high.confidence, low.confidence) == (1.0, 0.0)


def test_blank_message_falls_back_to_the_catalog_text():
    (finding,) = build(draft(message="  ", suggestion="")).findings
    rule = CATALOG.by_id("US-AC-004")
    assert finding.message == rule.message
    assert finding.suggestion == rule.suggestion


def test_findings_are_capped():
    ai_rule_ids = [r.id for r in CATALOG.of_type("ai")]
    drafts = [draft(rule_id=rid) for rid in ai_rule_ids]
    drafts += [draft(rule_id=rid, evidence_text="Recuperar contraseña") for rid in ai_rule_ids]
    result = build(*drafts)
    assert len(result.findings) == MAX_AI_FINDINGS
    assert result.discarded["over_limit"] > 0


def test_ai_findings_never_use_blocking_severity_unless_the_catalog_says_so():
    findings = build(*[draft(rule_id=r.id) for r in CATALOG.of_type("ai")]).findings
    assert all(f.severity == CATALOG.by_id(f.rule_id).severity for f in findings)
    assert Severity.BLOCKING not in {f.severity for f in findings}
