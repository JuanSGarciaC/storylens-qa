import json
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import Repository
from app.api.mappers import story_out
from app.api.schemas.story_import import ImportPreviewOut, ImportResultOut, ImportRowOut
from app.application import story_import
from app.domain.story_import import ImportFormatError

router = APIRouter(tags=["import"])

MAX_IMPORT_BYTES = 1_000_000


def _read(file: UploadFile) -> bytes:
    data = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(data) > MAX_IMPORT_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "El archivo supera 1 MB")
    return data


def _mapping(raw: str | None) -> dict[str, str | None] | None:
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ImportFormatError("El mapeo no es un JSON válido") from error
    if not isinstance(value, dict) or not all(
        v is None or isinstance(v, str) for v in value.values()
    ):
        raise ImportFormatError("El mapeo debe asociar cada campo con el nombre de una columna")
    return value


def _selected(raw: str | None) -> list[int] | None:
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ImportFormatError("La selección no es un JSON válido") from error
    if not isinstance(value, list) or not all(isinstance(v, int) for v in value):
        raise ImportFormatError("La selección debe ser una lista de números de fila")
    return value


@router.post("/stories/import", response_model=ImportPreviewOut)
def preview_import(
    repo: Repository,
    file: Annotated[UploadFile, File()],
    mapping: Annotated[str | None, Form()] = None,
) -> ImportPreviewOut:
    """Vista previa del archivo de Jira (CSV/JSON) con el mapeo de columnas. No guarda nada."""
    result = story_import.preview_import(repo, file.filename or "", _read(file), _mapping(mapping))
    return ImportPreviewOut(
        format=result.format,
        headers=result.headers,
        mapping=result.mapping,
        truncated=result.truncated,
        rows=[
            ImportRowOut(
                index=item.row.index,
                key=item.row.key,
                title=item.row.title,
                description=item.row.description,
                acceptance_criteria=list(item.row.acceptance_criteria),
                issues=item.row.issues,
                duplicate=item.duplicate,
                importable=item.importable,
            )
            for item in result.rows
        ],
    )


@router.post(
    "/stories/import:confirm",
    response_model=ImportResultOut,
    status_code=status.HTTP_201_CREATED,
)
def confirm_import(
    repo: Repository,
    file: Annotated[UploadFile, File()],
    mapping: Annotated[str | None, Form()] = None,
    selected: Annotated[str | None, Form()] = None,
) -> ImportResultOut:
    """Crea las historias elegidas (por número de fila) a partir del mismo archivo."""
    created = story_import.confirm_import(
        repo, file.filename or "", _read(file), _mapping(mapping), _selected(selected)
    )
    return ImportResultOut(created=[story_out(s, latest=None) for s in created])
