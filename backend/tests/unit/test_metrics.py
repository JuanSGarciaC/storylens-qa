from app.domain.metrics import (
    AnalysisFacts,
    CaseFacts,
    ExecutionFacts,
    StoryMetricsInput,
    VersionStory,
    build_matrix,
    compare_versions,
    compute_metrics,
)


def analysis(score, verdict, accepted=0, dismissed=0, pending=0, **severities):
    return AnalysisFacts(
        score=score,
        verdict=verdict,
        findings_by_severity=severities,
        accepted=accepted,
        dismissed=dismissed,
        pending=pending,
    )


def case(id, status="accepted", index=1, technique="boundary_value"):
    return CaseFacts(id, f"Caso {id}", status, technique, index)


def execution(case_id, result, when="2026-10-24T10:00:00", defect=None):
    return ExecutionFacts(case_id, result, when, defect is not None, defect)


def story(id, criteria=("c1", "c2"), analyses=(), cases=(), executions=()):
    return StoryMetricsInput(
        id, f"Historia {id}", None, criteria, list(analyses), list(cases), list(executions)
    )


def by_id(result):
    return {m.id: m for m in result.metrics}


def test_no_data_means_no_value_not_zero():
    metrics = by_id(compute_metrics([]))
    assert all(m.value is None for m in metrics.values())
    assert metrics["analyzed_stories"].denominator == 0


def test_every_metric_carries_numerator_and_denominator():
    stories = [
        story("a", analyses=[analysis(90, "ready", accepted=1, major=1)]),
        story("b", analyses=[analysis(40, "not_ready", pending=2, blocking=2)]),
        story("c"),
    ]
    metrics = by_id(compute_metrics(stories))
    assert (metrics["analyzed_stories"].numerator, metrics["analyzed_stories"].denominator) == (
        2,
        3,
    )
    assert metrics["ready_stories"].value == 50.0
    assert metrics["not_ready_stories"].value == 50.0
    assert metrics["average_score"].value == 65.0
    assert metrics["findings_resolved"].numerator == 1
    assert metrics["findings_resolved"].denominator == 3


def test_coverage_counts_only_accepted_cases_on_real_criteria():
    stories = [
        story(
            "a",
            criteria=("c1", "c2", "c3"),
            cases=[case("1", index=1), case("2", "proposed", index=2), case("3", index=9)],
        )
    ]
    metrics = by_id(compute_metrics(stories))
    assert metrics["criteria_coverage"].numerator == 1  # el criterio 9 no existe
    assert metrics["criteria_coverage"].denominator == 3
    assert metrics["accepted_cases"].value == round(100 * 2 / 3, 1)


def test_pass_rate_uses_only_the_latest_execution_of_each_case():
    stories = [
        story(
            "a",
            cases=[case("1"), case("2"), case("3")],
            executions=[
                execution("1", "failed", "2026-10-24T09:00:00"),
                execution("1", "passed", "2026-10-24T11:00:00"),
                execution("2", "failed"),
                execution("3", "not_run", ""),
            ],
        )
    ]
    metrics = by_id(compute_metrics(stories))
    assert metrics["pass_rate"].numerator == 1
    assert metrics["pass_rate"].denominator == 2  # el caso no ejecutado no cuenta


def test_improvement_effect_only_with_two_or_more_analyses():
    stories = [
        story("a", analyses=[analysis(50, "not_ready"), analysis(80, "ready")]),
        story("b", analyses=[analysis(70, "ready")]),
    ]
    effect = by_id(compute_metrics(stories))["improvement_effect"]
    assert effect.value == 30.0 and effect.denominator == 1
    assert by_id(compute_metrics([stories[1]]))["improvement_effect"].value is None


def test_breakdowns_include_defects_by_severity():
    stories = [
        story(
            "a",
            cases=[case("1")],
            executions=[execution("1", "failed", defect="major")],
        )
    ]
    result = compute_metrics(stories)
    defects = next(b for b in result.breakdowns if b.id == "defects_by_severity")
    assert defects.items == [("major", 1)]


def test_matrix_links_criterion_to_case_execution_and_defects():
    stories = [
        story(
            "a",
            criteria=("c1", "c2"),
            cases=[case("1", index=1), case("2", "proposed", index=2)],
            executions=[execution("1", "failed", defect="minor")],
        )
    ]
    rows = build_matrix(stories)
    assert [r.criterion_index for r in rows] == [0, 1]
    assert [c.id for c in rows[0].cases] == ["1"]
    assert rows[0].last_result == "failed" and rows[0].defects == 1
    assert rows[1].cases == [] and rows[1].last_result is None  # el caso propuesto no cubre


def test_version_comparison_matches_by_title():
    old = [
        VersionStory("1", "Login", "Entrar", ("a",)),
        VersionStory("2", "Pagos", "Cobrar", ("a",)),
        VersionStory("3", "Informe", "Ver", ()),
    ]
    new = [
        VersionStory("4", " login ", "Entrar", ("a",)),
        VersionStory("5", "Pagos", "Cobrar con tarjeta", ("a", "b")),
        VersionStory("6", "Perfil", "Editar", ()),
    ]
    result = compare_versions(old, new)
    assert result.unchanged == 1
    assert result.added == ["6"] and result.removed == ["3"]
    assert result.changed == [("2", "5", ["descripción", "criterios de aceptación"])]
