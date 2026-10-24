from app.application.demo_data import (
    DEMO_EPICS,
    DEMO_PROJECT_DESCRIPTION,
    DEMO_PROJECT_NAME,
    DEMO_PROJECT_OBJECTIVE,
    DEMO_STORIES,
    DEMO_VERSIONS,
)
from app.application.stories import run_analysis
from app.domain.entities import StoredProject, Story
from app.domain.ports import StoryRepository
from app.domain.ports.projects import ProjectRepository

DEMO_STORY_COUNT = len(DEMO_STORIES)


def seed_demo(projects: ProjectRepository, repo: StoryRepository) -> StoredProject:
    """Crea el proyecto de demostración con historias analizadas. Si ya existe, no hace nada."""
    existing = projects.get_demo_project()
    if existing is not None:
        return existing

    demo = projects.add_project(
        None,
        DEMO_PROJECT_NAME,
        DEMO_PROJECT_DESCRIPTION,
        DEMO_PROJECT_OBJECTIVE,
        is_demo=True,
    )
    epics = {name: projects.add_epic(demo.id, name).id for name in DEMO_EPICS}
    versions = {name: projects.add_version(demo.id, name).id for name in DEMO_VERSIONS}
    for item in DEMO_STORIES:
        stored = repo.add_story(
            demo.id,
            Story(
                title=item.title,
                description=item.description,
                acceptance_criteria=item.criteria,
                notes=item.notes,
            ),
            epic_id=epics[item.epic],
            version_id=versions[item.version],
        )
        run_analysis(repo, stored.id)  # solo reglas: la demo no gasta cuota de IA
    return demo
