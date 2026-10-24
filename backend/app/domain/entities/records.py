from dataclasses import dataclass
from datetime import datetime

from app.domain.entities.finding import AIStatus, Finding
from app.domain.entities.story import Story


@dataclass(frozen=True)
class StoredStory:
    id: str
    story: Story
    created_at: datetime
    project_id: str
    epic_id: str | None = None
    version_id: str | None = None


@dataclass(frozen=True)
class StoredAnalysis:
    id: str
    story_id: str
    findings: list[Finding]
    ai_status: AIStatus
    catalog_version: str
    created_at: datetime
    model_name: str | None = None
    prompt_version: str | None = None

    @property
    def used_ai(self) -> bool:
        return self.ai_status == AIStatus.OK
