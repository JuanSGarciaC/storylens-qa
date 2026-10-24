from app.domain.cross_analysis import (
    StoryFacts,
    analyze_project,
    epic_risks,
    find_contradictions,
    find_dependencies,
    find_duplicates,
)


def story(id, title, description="", key=None, epic=None, verdict=None, score=None, accepted=0):
    return StoryFacts(
        id=id,
        title=title,
        description=description,
        criteria=(),
        key=key,
        epic_id=epic,
        verdict=verdict,
        score=score,
        case_count=accepted,
        accepted_cases=accepted,
    )


def test_duplicates_are_found_by_similar_text_and_ignore_accents_and_case():
    stories = [
        story(
            "a", "Recuperar contraseña", "Como usuario quiero recuperar mi contraseña por correo"
        ),
        story("b", "RECUPERAR CONTRASEÑA", "Quiero recuperar la contraseña por correo electrónico"),
        story("c", "Exportar informe", "El administrador exporta el informe mensual en PDF"),
    ]
    pairs = find_duplicates(stories)
    assert [(p.a_id, p.b_id) for p in pairs] == [("a", "b")]
    assert pairs[0].similarity == 1.0  # mismo título normalizado


def test_unrelated_stories_are_not_duplicates():
    assert (
        find_duplicates([story("a", "Login", "Entrar al sistema"), story("b", "Pagos", "Cobrar")])
        == []
    )


def test_dependencies_by_key_and_by_title_mention():
    stories = [
        story(
            "a",
            "Retirar efectivo del cajero",
            "Depende de BANK-1 para validar el saldo",
            key="BANK-2",
        ),
        story("b", "Validar saldo", "Consulta el saldo del cliente", key="BANK-1"),
        story("c", "Informe diario", "Se genera después de Retirar efectivo del cajero cada noche"),
    ]
    links = {(k.from_id, k.to_id) for k in find_dependencies(stories)}
    assert links == {("a", "b"), ("c", "a")}


def test_a_story_never_depends_on_itself_and_short_titles_do_not_match():
    stories = [
        story("a", "Login", "Login de usuarios", key="K-1"),
        story("b", "Pagos", "Usa Login"),
    ]
    assert find_dependencies(stories) == []


def test_contradictions_are_hypotheses_about_numbers_and_opposites():
    stories = [
        story("a", "Sesión de usuario", "La sesión expira a los 30 minutos de inactividad"),
        story("b", "Sesión de usuario web", "La sesión expira a los 60 minutos de inactividad"),
        story("c", "Cuenta de usuario", "El usuario debe confirmar su cuenta de usuario siempre"),
        story("d", "Cuenta de usuario", "El usuario no debe confirmar su cuenta de usuario nunca"),
    ]
    hints = find_contradictions(stories, [])
    by_pair = {(h.a_id, h.b_id): h.reason for h in hints}
    assert "cifras distintas" in by_pair[("a", "b")]
    assert "exige lo que la otra prohíbe" in by_pair[("c", "d")]
    assert all(r.startswith("Hipótesis, revisar a mano") for r in by_pair.values())


def test_epic_risk_levels_use_real_counts_and_say_when_unknown():
    stories = [
        story("1", "a", epic="E1", verdict="not_ready", score=40),
        story("2", "b", epic="E1", verdict="ready", score=90, accepted=2),
        story("3", "c", epic="E2", verdict="ready", score=95, accepted=1),
        story("4", "d", epic="E3"),
    ]
    risks = {r.epic_id: r for r in epic_risks(stories)}
    assert risks["E1"].level == "high" and risks["E1"].not_ready == 1
    assert risks["E1"].average_score == 65.0
    assert risks["E2"].level == "low"
    assert risks["E3"].level == "unknown" and risks["E3"].average_score is None


def test_stories_without_accepted_cases_are_listed():
    result = analyze_project([story("a", "x", accepted=0), story("b", "y", accepted=2)])
    assert result.without_cases == ["a"]
    assert result.total_stories == 2


def test_empty_project():
    result = analyze_project([])
    assert result.total_stories == 0 and result.epic_risks == [] and result.duplicates == []
