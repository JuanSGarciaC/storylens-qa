from app.application.projects import require_project
from app.domain.entities import StoredStory
from app.domain.entities.finding import Decision
from app.domain.metrics import (
    AnalysisFacts,
    CaseFacts,
    ExecutionFacts,
    MatrixRow,
    ProjectMetrics,
    StoryMetricsInput,
    VersionComparison,
    VersionStory,
    build_matrix,
    compare_versions,
    compute_metrics,
)
from app.domain.ports import ProjectRepository, StoryRepository
from app.domain.ports.sessions import SessionRepository
from app.domain.scoring import calculate_score


def _facts(
    stories: StoryRepository, sessions: SessionRepository, stored: StoredStory
) -> StoryMetricsInput:
    analyses = []
    for analysis in stories.list_analyses(stored.id):
        score = calculate_score(analysis.findings, analysis.settings)
        by_severity: dict[str, int] = {}
        for finding in analysis.findings:
            by_severity[finding.severity] = by_severity.get(finding.severity, 0) + 1
        analyses.append(
            AnalysisFacts(
                score=score.value,
                verdict=str(score.verdict),
                findings_by_severity=by_severity,
                accepted=sum(1 for f in analysis.findings if f.decision == Decision.ACCEPTED),
                dismissed=sum(1 for f in analysis.findings if f.decision == Decision.DISMISSED),
                pending=sum(1 for f in analysis.findings if f.decision == Decision.PENDING),
            )
        )
    cases = [
        CaseFacts(
            id=c.id or "",
            title=c.title,
            status=str(c.status),
            technique=str(c.technique),
            criterion_index=c.criterion_index,
        )
        for c in stories.list_test_cases(stored.id)
    ]
    executions = []
    for session in sessions.list_sessions(stored.id):
        severity_by_execution = {
            d.execution_id: str(d.fields.severity) for d in sessions.list_defects(session.id)
        }
        for execution in sessions.list_executions(session.id):
            when = execution.executed_at.isoformat() if execution.executed_at else ""
            executions.append(
                ExecutionFacts(
                    case_id=execution.test_case_id,
                    result=str(execution.result),
                    executed_at=when,
                    has_defect=execution.id in severity_by_execution,
                    defect_severity=severity_by_execution.get(execution.id),
                )
            )
    return StoryMetricsInput(
        story_id=stored.id,
        title=stored.story.title,
        epic_id=stored.epic_id,
        criteria=tuple(stored.story.acceptance_criteria),
        analyses=analyses,
        cases=cases,
        executions=executions,
    )


def _inputs(
    stories: StoryRepository,
    sessions: SessionRepository,
    projects: ProjectRepository,
    project_id: str,
) -> list[StoryMetricsInput]:
    require_project(projects, project_id)
    return [_facts(stories, sessions, s) for s in stories.list_stories(project_id)]


def project_metrics(
    stories: StoryRepository,
    sessions: SessionRepository,
    projects: ProjectRepository,
    project_id: str,
) -> ProjectMetrics:
    return compute_metrics(_inputs(stories, sessions, projects, project_id))


def project_matrix(
    stories: StoryRepository,
    sessions: SessionRepository,
    projects: ProjectRepository,
    project_id: str,
) -> list[MatrixRow]:
    return build_matrix(_inputs(stories, sessions, projects, project_id))


def project_version_comparison(
    stories: StoryRepository,
    projects: ProjectRepository,
    project_id: str,
    from_version: str,
    to_version: str,
) -> VersionComparison:
    require_project(projects, project_id)

    def load(version_id: str) -> list[VersionStory]:
        return [
            VersionStory(
                s.id, s.story.title, s.story.description, tuple(s.story.acceptance_criteria)
            )
            for s in stories.list_stories(project_id, version_id=version_id)
        ]

    return compare_versions(load(from_version), load(to_version))
