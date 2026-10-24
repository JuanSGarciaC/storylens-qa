from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ProjectSettings:
    """Reglas y umbrales de calidad propios de un proyecto.

    `penalties` usa como claves los valores de `Severity` ("blocking", "major", ...).
    """

    disabled_rules: tuple[str, ...] = ()
    penalties: dict[str, int] | None = None
    not_ready_below: int = 60
    ready_from: int = 85


@dataclass(frozen=True)
class StoredProject:
    id: str
    name: str
    description: str
    objective: str
    settings: ProjectSettings
    is_demo: bool
    owner_id: str | None
    created_at: datetime


@dataclass(frozen=True)
class Epic:
    id: str
    project_id: str
    name: str


@dataclass(frozen=True)
class Version:
    id: str
    project_id: str
    name: str
