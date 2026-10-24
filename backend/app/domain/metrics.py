"""Métricas del proyecto, con su definición y su denominador a la vista.

Lógica pura. Regla del producto: ninguna cifra sin su denominador y ninguna cifra inventada;
si no hay datos para calcularla, el valor es `None` (la interfaz muestra «sin datos»).
"""

from collections import Counter
from dataclasses import dataclass, field


@dataclass(frozen=True)
class AnalysisFacts:
    score: int
    verdict: str
    findings_by_severity: dict[str, int]
    accepted: int
    dismissed: int
    pending: int


@dataclass(frozen=True)
class CaseFacts:
    id: str
    title: str
    status: str
    technique: str
    criterion_index: int | None


@dataclass(frozen=True)
class ExecutionFacts:
    case_id: str
    result: str
    executed_at: str  # ISO; vacío si nunca se ejecutó
    has_defect: bool
    defect_severity: str | None


@dataclass(frozen=True)
class StoryMetricsInput:
    story_id: str
    title: str
    epic_id: str | None
    criteria: tuple[str, ...]
    analyses: list[AnalysisFacts]  # de la más antigua a la más reciente
    cases: list[CaseFacts]
    executions: list[ExecutionFacts]


@dataclass(frozen=True)
class Metric:
    id: str
    label: str
    definition: str
    numerator: float | None
    denominator: float | None
    value: float | None  # None = sin datos para calcularla
    unit: str  # "percent" | "score" | "count" | "points"


@dataclass(frozen=True)
class Breakdown:
    id: str
    label: str
    items: list[tuple[str, int]]


@dataclass(frozen=True)
class ProjectMetrics:
    metrics: list[Metric]
    breakdowns: list[Breakdown]


def _ratio(
    id: str, label: str, definition: str, numerator: int, denominator: int, unit: str = "percent"
) -> Metric:
    value = round(100 * numerator / denominator, 1) if denominator else None
    return Metric(id, label, definition, numerator, denominator, value, unit)


def compute_metrics(stories: list[StoryMetricsInput]) -> ProjectMetrics:
    total = len(stories)
    analyzed = [s for s in stories if s.analyses]
    latest = [s.analyses[-1] for s in analyzed]
    ready = sum(1 for a in latest if a.verdict == "ready")
    not_ready = sum(1 for a in latest if a.verdict == "not_ready")
    scores = [a.score for a in latest]
    average = round(sum(scores) / len(scores), 1) if scores else None

    findings_total = sum(sum(a.findings_by_severity.values()) for a in latest)
    resolved = sum(a.accepted + a.dismissed for a in latest)

    criteria_total = sum(len(s.criteria) for s in stories)
    covered = sum(
        len(
            {
                c.criterion_index
                for c in s.cases
                if c.status == "accepted" and c.criterion_index is not None
            }
            & set(range(1, len(s.criteria) + 1))  # los índices de criterio son 1-based
        )
        for s in stories
    )
    cases = [c for s in stories for c in s.cases]
    accepted_cases = sum(1 for c in cases if c.status == "accepted")

    # Solo la última ejecución de cada caso cuenta: lo anterior es historia.
    last_by_case: dict[str, ExecutionFacts] = {}
    for story in stories:
        for ex in sorted(story.executions, key=lambda e: e.executed_at):
            if ex.result != "not_run":
                last_by_case[ex.case_id] = ex
    results = Counter(e.result for e in last_by_case.values())
    executed = sum(results.values())
    defect_rows = [e for s in stories for e in s.executions if e.has_defect]

    improved = [s for s in analyzed if len(s.analyses) >= 2]
    deltas = [s.analyses[-1].score - s.analyses[0].score for s in improved]
    mean_delta = round(sum(deltas) / len(deltas), 1) if deltas else None

    metrics = [
        _ratio(
            "analyzed_stories",
            "Historias analizadas",
            "Historias con al menos un análisis, sobre el total de historias del proyecto.",
            len(analyzed),
            total,
        ),
        _ratio(
            "ready_stories",
            "Historias listas",
            "Historias cuyo último análisis es «lista», sobre las analizadas.",
            ready,
            len(analyzed),
        ),
        _ratio(
            "not_ready_stories",
            "Historias no listas",
            "Historias cuyo último análisis es «no lista» (bloqueante o puntaje bajo), "
            "sobre las analizadas.",
            not_ready,
            len(analyzed),
        ),
        Metric(
            "average_score",
            "Puntaje medio",
            "Promedio del puntaje del último análisis de cada historia analizada. "
            "Un puntaje alto no oculta un bloqueante: mira también «no listas».",
            sum(scores) if scores else None,
            len(scores) or None,
            average,
            "score",
        ),
        _ratio(
            "findings_resolved",
            "Hallazgos resueltos",
            "Hallazgos aceptados o descartados, sobre todos los de los últimos análisis.",
            resolved,
            findings_total,
        ),
        _ratio(
            "criteria_coverage",
            "Cobertura de criterios",
            "Criterios de aceptación con al menos un caso aceptado, sobre todos los criterios.",
            covered,
            criteria_total,
        ),
        _ratio(
            "accepted_cases",
            "Casos aceptados",
            "Casos de prueba aceptados, sobre todos los casos.",
            accepted_cases,
            len(cases),
        ),
        _ratio(
            "pass_rate",
            "Casos que pasan",
            "Casos cuya última ejecución fue «pasó», sobre los casos ejecutados "
            "(los no ejecutados no cuentan).",
            results.get("passed", 0),
            executed,
        ),
        Metric(
            "improvement_effect",
            "Efecto de las mejoras",
            "Cambio medio de puntaje entre el primer y el último análisis, solo en historias "
            "analizadas más de una vez (puntos).",
            sum(deltas) if deltas else None,
            len(deltas) or None,
            mean_delta,
            "points",
        ),
    ]
    severity: Counter[str] = Counter()
    for a in latest:
        severity.update(a.findings_by_severity)
    breakdowns = [
        Breakdown(
            "findings_by_severity",
            "Hallazgos por severidad (últimos análisis)",
            [(k, severity.get(k, 0)) for k in ("blocking", "major", "minor", "info")],
        ),
        Breakdown(
            "cases_by_technique",
            "Casos por técnica",
            sorted(Counter(c.technique for c in cases).items()),
        ),
        Breakdown(
            "executions_by_result",
            "Última ejecución de cada caso",
            [(k, results.get(k, 0)) for k in ("passed", "failed", "blocked")],
        ),
        Breakdown(
            "defects_by_severity",
            "Defectos por severidad",
            sorted(Counter(e.defect_severity for e in defect_rows if e.defect_severity).items()),
        ),
    ]
    return ProjectMetrics(metrics=metrics, breakdowns=breakdowns)


@dataclass(frozen=True)
class MatrixRow:
    story_id: str
    story_title: str
    criterion_index: int  # 1-based, igual que en los casos de prueba
    criterion: str
    cases: list[CaseFacts] = field(default_factory=list)
    last_result: str | None = None  # None = ningún caso ejecutado
    defects: int = 0


def build_matrix(stories: list[StoryMetricsInput]) -> list[MatrixRow]:
    """Requisito → criterio → casos aceptados → última ejecución → defectos."""
    rows = []
    for story in stories:
        by_case: dict[str, list[ExecutionFacts]] = {}
        for ex in story.executions:
            by_case.setdefault(ex.case_id, []).append(ex)
        for index, criterion in enumerate(story.criteria):
            cases = [
                c for c in story.cases if c.criterion_index == index + 1 and c.status == "accepted"
            ]
            executions = sorted(
                (e for c in cases for e in by_case.get(c.id, []) if e.result != "not_run"),
                key=lambda e: e.executed_at,
            )
            rows.append(
                MatrixRow(
                    story_id=story.story_id,
                    story_title=story.title,
                    criterion_index=index + 1,
                    criterion=criterion,
                    cases=cases,
                    last_result=executions[-1].result if executions else None,
                    defects=sum(1 for c in cases for e in by_case.get(c.id, []) if e.has_defect),
                )
            )
    return rows


@dataclass(frozen=True)
class VersionComparison:
    added: list[str]  # ids de historias nuevas en `to`
    removed: list[str]  # ids de historias que estaban en `from` y ya no
    changed: list[tuple[str, str, list[str]]]  # (id en from, id en to, qué cambió)
    unchanged: int


@dataclass(frozen=True)
class VersionStory:
    id: str
    title: str
    description: str
    criteria: tuple[str, ...]


def _key(title: str) -> str:
    return " ".join(title.casefold().split())


def compare_versions(old: list[VersionStory], new: list[VersionStory]) -> VersionComparison:
    """Empareja por título (sin importar mayúsculas ni espacios) y dice qué cambió."""
    old_by = {_key(s.title): s for s in old}
    new_by = {_key(s.title): s for s in new}
    changed = []
    unchanged = 0
    for key, before in old_by.items():
        after = new_by.get(key)
        if after is None:
            continue
        what = []
        if before.description.strip() != after.description.strip():
            what.append("descripción")
        if before.criteria != after.criteria:
            what.append("criterios de aceptación")
        if what:
            changed.append((before.id, after.id, what))
        else:
            unchanged += 1
    return VersionComparison(
        added=[s.id for k, s in new_by.items() if k not in old_by],
        removed=[s.id for k, s in old_by.items() if k not in new_by],
        changed=changed,
        unchanged=unchanged,
    )
