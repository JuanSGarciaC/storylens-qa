from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Projects, Repository, Sessions
from app.api.schemas.metrics import (
    BreakdownItemOut,
    BreakdownOut,
    ChangedStoryOut,
    MatrixCaseOut,
    MatrixOut,
    MatrixRowOut,
    MetricOut,
    MetricsOut,
    VersionComparisonOut,
    VersionStoryOut,
)
from app.application import metrics

router = APIRouter(tags=["metrics"])


@router.get("/projects/{project_id}/metrics", response_model=MetricsOut)
def project_metrics(
    project_id: str, repo: Repository, sessions: Sessions, projects: Projects
) -> MetricsOut:
    """Métricas con su definición y su denominador; sin datos, el valor es nulo."""
    result = metrics.project_metrics(repo, sessions, projects, project_id)
    return MetricsOut(
        metrics=[MetricOut(**vars(m)) for m in result.metrics],
        breakdowns=[
            BreakdownOut(
                id=b.id,
                label=b.label,
                items=[BreakdownItemOut(key=k, count=n) for k, n in b.items],
            )
            for b in result.breakdowns
        ],
    )


@router.get("/projects/{project_id}/traceability-matrix", response_model=MatrixOut)
def traceability_matrix(
    project_id: str,
    repo: Repository,
    sessions: Sessions,
    projects: Projects,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MatrixOut:
    """Criterio → casos aceptados → última ejecución → defectos, de todo el proyecto."""
    rows = metrics.project_matrix(repo, sessions, projects, project_id)
    return MatrixOut(
        total=len(rows),
        rows=[
            MatrixRowOut(
                story_id=r.story_id,
                story_title=r.story_title,
                criterion_index=r.criterion_index,
                criterion=r.criterion,
                cases=[MatrixCaseOut(id=c.id, title=c.title) for c in r.cases],
                last_result=r.last_result,
                defects=r.defects,
            )
            for r in rows[offset : offset + limit]
        ],
    )


@router.get("/projects/{project_id}/version-comparison", response_model=VersionComparisonOut)
def version_comparison(
    project_id: str,
    repo: Repository,
    projects: Projects,
    from_version: Annotated[str, Query(alias="from")],
    to_version: Annotated[str, Query(alias="to")],
) -> VersionComparisonOut:
    """Qué historias aparecieron, desaparecieron o cambiaron entre dos versiones."""
    result = metrics.project_version_comparison(
        repo, projects, project_id, from_version, to_version
    )
    titles = {s.id: s.story.title for s in repo.list_stories(project_id)}
    return VersionComparisonOut(
        added=[VersionStoryOut(id=i, title=titles.get(i, i)) for i in result.added],
        removed=[VersionStoryOut(id=i, title=titles.get(i, i)) for i in result.removed],
        changed=[ChangedStoryOut(from_id=a, to_id=b, what=w) for a, b, w in result.changed],
        unchanged=result.unchanged,
    )
