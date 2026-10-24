from typing import Protocol

from app.domain.entities import (
    AIStatus,
    Decision,
    Finding,
    QATestCase,
    StoredAnalysis,
    StoredStory,
    Story,
)


class StoryRepository(Protocol):
    def add_story(
        self,
        project_id: str,
        story: Story,
        epic_id: str | None = None,
        version_id: str | None = None,
    ) -> StoredStory: ...

    def get_story(self, story_id: str) -> StoredStory | None: ...

    def list_stories(
        self, project_id: str, epic_id: str | None = None, version_id: str | None = None
    ) -> list[StoredStory]: ...

    def list_story_ids(self, project_id: str) -> list[str]: ...

    def delete_story(self, story_id: str) -> bool:
        """Borra la historia con sus análisis, hallazgos y casos. False si no existe."""
        ...

    def add_analysis(
        self,
        story_id: str,
        findings: list[Finding],
        ai_status: AIStatus,
        catalog_version: str,
        model_name: str | None = None,
        prompt_version: str | None = None,
    ) -> StoredAnalysis: ...

    def get_analysis(self, analysis_id: str) -> StoredAnalysis | None: ...

    def latest_analysis(self, story_id: str) -> StoredAnalysis | None: ...

    def update_finding_decision(
        self, finding_id: str, decision: Decision, reason: str | None
    ) -> str | None:
        """Devuelve el id del análisis al que pertenece el hallazgo, o None si no existe."""
        ...

    # --- casos de prueba ---
    def add_test_cases(self, story_id: str, cases: list[QATestCase]) -> list[QATestCase]: ...

    def list_test_cases(self, story_id: str) -> list[QATestCase]: ...

    def get_test_case(self, case_id: str) -> QATestCase | None: ...

    def save_test_case(self, case: QATestCase) -> QATestCase:
        """Reemplaza los campos de un caso ya guardado (identificado por `case.id`)."""
        ...

    def delete_proposed_ai_test_cases(self, story_id: str) -> int:
        """Borra los casos de IA aún no revisados; conserva aceptados, rechazados y propios."""
        ...
