from typing import Any

from app.domain.entities.project import ProjectSettings


def settings_to_json(settings: ProjectSettings) -> dict[str, Any]:
    return {
        "disabled_rules": list(settings.disabled_rules),
        "penalties": settings.penalties,
        "not_ready_below": settings.not_ready_below,
        "ready_from": settings.ready_from,
    }


def settings_from_json(raw: dict[str, Any] | None) -> ProjectSettings:
    """Lee la configuración guardada; los campos que falten toman el valor por defecto."""
    defaults = ProjectSettings()
    raw = raw or {}
    penalties = raw.get("penalties")
    return ProjectSettings(
        disabled_rules=tuple(raw.get("disabled_rules", ())),
        penalties={str(k): int(v) for k, v in penalties.items()}
        if isinstance(penalties, dict)
        else None,
        not_ready_below=int(raw.get("not_ready_below", defaults.not_ready_below)),
        ready_from=int(raw.get("ready_from", defaults.ready_from)),
    )
