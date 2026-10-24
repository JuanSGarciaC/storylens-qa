from collections.abc import Iterator

import pytest
from sqlalchemy import Engine
from sqlmodel import Session

from app.api.deps import get_evaluation_launcher, get_llm
from app.application.evaluations import ensure_demo_run, execute_run
from app.domain.entities import AIStatus
from app.domain.ports import LLMAnalysis, LLMUnavailableError
from app.infrastructure.evaluation.golden import load_golden
from app.infrastructure.persistence.sql_evaluation_repository import SqlEvaluationRepository
from app.main import app


class FakeLLM:
    """IA falsa: responde sin hallazgos, o falla si `fail` está activo."""

    def __init__(self, fail: bool = False, obey: bool = False) -> None:
        self.fail = fail
        self.obey = obey
        self.calls = 0

    def analyze_story(self, story, rules):
        self.calls += 1
        if self.fail:
            raise LLMUnavailableError("cuota agotada")
        return LLMAnalysis(findings=[], model_name="fake-model", prompt_version="v-test")


@pytest.fixture
def sync_eval(client, engine: Engine) -> Iterator[FakeLLM]:
    llm = FakeLLM()

    def launch(run_id: str) -> None:
        with Session(engine) as session:
            execute_run(SqlEvaluationRepository(session), load_golden(), llm, run_id, pause=0.0)

    app.dependency_overrides[get_evaluation_launcher] = lambda: launch
    app.dependency_overrides[get_llm] = lambda: llm
    yield llm


def start(client, mode):
    return client.post(f"/api/v1/projects/{client.project_id}/evaluations", json={"mode": mode})


def test_rules_run_scores_the_whole_golden_set_without_ai(client, sync_eval):
    response = start(client, "rules")
    assert response.status_code == 202
    run = client.get(f"/api/v1/evaluations/{response.json()['id']}").json()
    assert run["status"] == "succeeded"
    assert run["total"] == run["processed"] == len(load_golden())
    assert run["metrics"]["ai"] is None
    det = run["metrics"]["det"]
    assert 0 <= det["precision"] <= 1 and det["tp"] + det["fn"] > 0
    assert sync_eval.calls == 0  # solo reglas: la IA no se toca


def test_ai_run_measures_ai_rules_and_records_model_and_prompt(client, sync_eval):
    run = client.get(f"/api/v1/evaluations/{start(client, 'rules_ai').json()['id']}").json()
    assert run["status"] == "succeeded"
    assert run["model_name"] == "fake-model" and run["prompt_version"] == "v-test"
    assert run["metrics"]["ai"] is not None
    assert run["details"]["measured_for_ai"] == len(load_golden())
    assert sync_eval.calls == len(load_golden())


def test_ai_that_stops_answering_leaves_an_incomplete_run(client, sync_eval):
    sync_eval.fail = True
    run = client.get(f"/api/v1/evaluations/{start(client, 'rules_ai').json()['id']}").json()
    assert run["status"] == "incomplete"
    assert run["processed"] == 2  # se detuvo tras dos fallos seguidos
    assert "incompleta" in run["note"]
    assert sync_eval.calls == 2


def test_injection_run_passes_when_the_ai_ignores_the_orders(client, sync_eval):
    run = client.get(f"/api/v1/evaluations/{start(client, 'injection').json()['id']}").json()
    assert run["status"] == "succeeded"
    assert run["metrics"]["injection"] == {
        "passed": 3,
        "failed": 0,
        "not_evaluable": 0,
        "total": 3,
    }


def test_injection_run_without_ai_response_is_not_evaluable(client, sync_eval):
    sync_eval.fail = True
    run = client.get(f"/api/v1/evaluations/{start(client, 'injection').json()['id']}").json()
    assert run["status"] == "incomplete"
    assert run["metrics"]["injection"]["not_evaluable"] == 3


def test_ai_modes_are_refused_without_ai_or_without_enough_quota(client):
    app.dependency_overrides[get_llm] = lambda: None
    refused = start(client, "rules_ai")
    assert refused.status_code == 409 and "IA" in refused.json()["detail"]
    assert start(client, "rules").status_code == 202  # reglas siempre disponible


def test_only_one_active_run_per_project(client, sync_eval, engine):
    with Session(engine) as session:
        SqlEvaluationRepository(session).create_run(client.project_id, "rules", "x", 1, "1")
    assert start(client, "rules").status_code == 409


def test_history_info_and_access_rules(client, anon_client, sync_eval):
    start(client, "rules")
    history = client.get(f"/api/v1/projects/{client.project_id}/evaluations").json()
    assert len(history) == 1 and history[0]["mode"] == "rules"
    info = client.get(f"/api/v1/projects/{client.project_id}/evaluations/info").json()
    assert info["golden_stories"] == len(load_golden()) and info["injection_cases"] == 3
    run_id = history[0]["id"]
    assert anon_client.get(f"/api/v1/evaluations/{run_id}").status_code == 404
    assert (
        anon_client.post(
            f"/api/v1/projects/{client.project_id}/evaluations", json={"mode": "rules"}
        ).status_code
        == 401
    )
    assert client.get("/api/v1/evaluations/no-existe").status_code == 404


def test_interrupted_runs_are_marked_on_startup(client, engine):
    with Session(engine) as session:
        repo = SqlEvaluationRepository(session)
        run = repo.create_run(client.project_id, "rules", "x", 1, "1")
        assert repo.mark_interrupted() == 1
    assert client.get(f"/api/v1/evaluations/{run.id}").json()["status"] == "interrupted"


def test_demo_gets_a_rules_only_example_run_once(engine, client):
    with Session(engine) as session:
        repo = SqlEvaluationRepository(session)
        ensure_demo_run(repo, load_golden(), client.project_id)
        ensure_demo_run(repo, load_golden(), client.project_id)  # no duplica
        runs = repo.list_runs(client.project_id)
        assert len(runs) == 1 and runs[0].status == "succeeded"
        assert runs[0].metrics["ai"] is None


def test_deleting_the_project_removes_its_evaluations(client, sync_eval):
    run_id = start(client, "rules").json()["id"]
    assert client.delete(f"/api/v1/projects/{client.project_id}").status_code == 204
    assert client.get(f"/api/v1/evaluations/{run_id}").status_code == 404


def test_ai_status_enum_is_what_the_runner_compares_against():
    assert str(AIStatus.OK) == "ok"
