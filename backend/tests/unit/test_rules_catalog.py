import pytest

from app.domain.rules.catalog import load_catalog
from app.domain.rules.engine import evaluate_story
from app.domain.rules.engine.evaluators import EVALUATORS
from tests.conftest import make_story

DETERMINISTIC = load_catalog().of_type("deterministic")


def test_every_deterministic_rule_has_an_evaluator_and_examples():
    for rule in DETERMINISTIC:
        assert rule.id in EVALUATORS, f"{rule.id} no tiene evaluador"
        assert {"ok", "fail"} <= rule.examples.keys(), f"{rule.id} no tiene ejemplos ok/fail"


def test_evaluators_have_catalog_entries():
    assert set(EVALUATORS) <= {r.id for r in DETERMINISTIC}


def test_good_story_has_no_findings(good_story):
    assert evaluate_story(good_story) == []


@pytest.mark.parametrize("rule", DETERMINISTIC, ids=lambda r: r.id)
def test_rule_ok_example_does_not_trigger(rule):
    findings = evaluate_story(make_story(**rule.examples["ok"]))
    assert rule.id not in {f.rule_id for f in findings}


@pytest.mark.parametrize("rule", DETERMINISTIC, ids=lambda r: r.id)
def test_rule_fail_example_triggers(rule):
    findings = evaluate_story(make_story(**rule.examples["fail"]))
    assert rule.id in {f.rule_id for f in findings}


def test_vague_term_is_matched_as_whole_word():
    story = make_story(description="Como usuario quiero ver mi histórico para auditar. Sin etc.")
    ids = [f.rule_id for f in evaluate_story(story)]
    assert ids.count("US-AMB-001") == 1  # "etc." sí; "histórico" no contiene términos vagos


def test_missing_parts_are_reported():
    story = make_story(description="Quiero restablecer mi contraseña")
    finding = next(f for f in evaluate_story(story) if f.rule_id == "US-FMT-001")
    assert "rol" in finding.message and "beneficio" in finding.message
    assert "acción" not in finding.message


def test_catalog_ids_are_unique_and_have_references():
    catalog = load_catalog()
    assert len({r.id for r in catalog.rules}) == len(catalog.rules)
    assert all(r.reference for r in catalog.rules)
