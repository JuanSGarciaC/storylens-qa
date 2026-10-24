from dataclasses import dataclass

from app.config import get_settings
from app.domain.entities import StoredStory, Story
from app.domain.ports import StoryRepository
from app.domain.story_import import (
    ImportFormatError,
    ImportRow,
    build_rows,
    parse_table,
    suggest_mapping,
    validate_mapping,
)


@dataclass(frozen=True)
class PreviewRow:
    row: ImportRow
    duplicate: bool

    @property
    def importable(self) -> bool:
        return self.row.importable and not self.duplicate


@dataclass(frozen=True)
class ImportPreview:
    format: str
    headers: list[str]
    mapping: dict[str, str | None]
    rows: list[PreviewRow]
    truncated: bool


def _signature(title: str, description: str) -> tuple[str, str]:
    return title.strip().casefold(), description.strip().casefold()


def preview_import(
    repo: StoryRepository,
    project_id: str,
    filename: str,
    data: bytes,
    mapping: dict[str, str | None] | None = None,
) -> ImportPreview:
    """Lee el archivo y muestra cómo quedarían las historias, sin guardar nada."""
    kind, table = parse_table(filename, data)
    chosen = validate_mapping(mapping, table.headers) if mapping else suggest_mapping(table.headers)
    if not chosen.get("description"):
        raise ImportFormatError(
            "No se encontró la columna de descripción: elige cuál usar en el mapeo"
        )
    rows = build_rows(table, chosen, get_settings().max_story_chars)
    known = {_signature(s.story.title, s.story.description) for s in repo.list_stories(project_id)}
    preview = []
    for row in rows:
        signature = _signature(row.title, row.description)
        preview.append(PreviewRow(row=row, duplicate=signature in known))
        known.add(signature)  # también detecta repetidas dentro del mismo archivo
    return ImportPreview(
        format=kind,
        headers=table.headers,
        mapping=chosen,
        rows=preview,
        truncated=table.truncated,
    )


def confirm_import(
    repo: StoryRepository,
    project_id: str,
    filename: str,
    data: bytes,
    mapping: dict[str, str | None] | None,
    selected: list[int] | None,
) -> list[StoredStory]:
    """Crea las historias elegidas. Relee el archivo: no confía en lo que mostró el cliente."""
    preview = preview_import(repo, project_id, filename, data, mapping)
    wanted = set(selected) if selected is not None else None
    created = []
    for item in preview.rows:
        if not item.importable or (wanted is not None and item.row.index not in wanted):
            continue
        row = item.row
        notes = f"Importada de Jira: {row.key}" if row.key else ""
        story = Story(
            title=row.title,
            description=row.description,
            acceptance_criteria=row.acceptance_criteria,
            notes=notes,
        )
        created.append(repo.add_story(project_id, story))
    if not created:
        raise ImportFormatError("No hay historias válidas para importar con esa selección")
    return created
