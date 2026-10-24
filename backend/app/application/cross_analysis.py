import re

from app.application.projects import require_project
from app.domain.cross_analysis import CrossAnalysis, StoryFacts, analyze_project
from app.domain.entities.test_case import CaseStatus
from app.domain.ports import ProjectRepository, StoryRepository
from app.domain.scoring import calculate_score

JIRA_KEY = re.compile(r"Importada de Jira:\s*(\S+)")


def project_cross_analysis(
    stories: StoryRepository, projects: ProjectRepository, project_id: str
) -> CrossAnalysis:
    require_project(projects, project_id)
    facts = []
    for stored in stories.list_stories(project_id):
        latest = stories.latest_analysis(stored.id)
        score = calculate_score(latest.findings, latest.settings) if latest else None
        cases = stories.list_test_cases(stored.id)
        match = JIRA_KEY.search(stored.story.notes)
        facts.append(
            StoryFacts(
                id=stored.id,
                title=stored.story.title,
                description=stored.story.description,
                criteria=tuple(stored.story.acceptance_criteria),
                key=match.group(1) if match else None,
                epic_id=stored.epic_id,
                verdict=str(score.verdict) if score else None,
                score=score.value if score else None,
                case_count=len(cases),
                accepted_cases=sum(1 for c in cases if c.status == CaseStatus.ACCEPTED),
            )
        )
    return analyze_project(facts)
