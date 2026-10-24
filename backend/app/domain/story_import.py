"""Lectura de exportaciones de Jira (CSV o JSON) y mapeo de sus columnas a historias.

Es lógica pura: recibe texto, devuelve filas candidatas con los problemas que tendría cada una.
Nada se guarda aquí; la persona confirma la vista previa antes de crear historias.
"""

import csv
import io
import json
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

MAX_ROWS = 200
MAX_TITLE_CHARS = 300
MAX_CRITERIA = 50
MAX_KEY_CHARS = 50

FIELDS = ("title", "description", "acceptance_criteria", "key")

# Nombres habituales de cada campo (ya normalizados: minúsculas y sin tildes).
SYNONYMS: dict[str, tuple[str, ...]] = {
    "title": ("summary", "resumen", "title", "titulo", "nombre"),
    "description": ("description", "descripcion", "detalle"),
    "acceptance_criteria": (
        "acceptance criteria",
        "criterios de aceptacion",
        "criterios",
        "acceptance",
    ),
    "key": ("issue key", "key", "clave", "issue id", "id"),
}

_CRITERIA_HEADING = re.compile(
    r"^\W*(?:h\d\.\s*)?(?:criterios de aceptaci[oó]n|acceptance criteria)\W*$",
    re.IGNORECASE,
)
_BULLET = re.compile(r"^\s*(?:[-*•#]+|\d+[.)])\s+")
_BLOCK_TYPES = {"paragraph", "heading", "listItem", "bulletList", "orderedList", "codeBlock"}


class ImportFormatError(Exception):
    """El archivo no se puede leer como una exportación válida."""


@dataclass(frozen=True)
class Table:
    headers: list[str]
    rows: list[dict[str, str]]
    truncated: bool = False


@dataclass(frozen=True)
class ImportRow:
    index: int  # posición en el archivo, empezando en 1
    key: str
    title: str
    description: str
    acceptance_criteria: tuple[str, ...]
    issues: list[str] = field(default_factory=list)

    @property
    def importable(self) -> bool:
        return not self.issues


def _normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.strip().casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


# --- lectura de archivos ---
def decode(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def detect_format(filename: str, text: str) -> str:
    name = filename.lower()
    if name.endswith(".csv"):
        return "csv"
    if name.endswith(".json"):
        return "json"
    return "json" if text.lstrip()[:1] in ("{", "[") else "csv"


def _unique_headers(raw: list[str]) -> list[str]:
    seen: dict[str, int] = {}
    headers = []
    for index, name in enumerate(raw, start=1):
        name = name.strip() or f"Columna {index}"
        seen[name] = seen.get(name, 0) + 1
        headers.append(name if seen[name] == 1 else f"{name} ({seen[name]})")
    return headers


def parse_csv(text: str) -> Table:
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    try:
        records = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    except csv.Error as error:
        raise ImportFormatError(f"El CSV no es válido: {error}") from error
    records = [r for r in records if any(cell.strip() for cell in r)]
    if len(records) < 2:
        raise ImportFormatError("El CSV necesita una fila de encabezados y al menos una historia")
    headers = _unique_headers(records[0])
    rows = [
        {h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(headers)}
        for r in records[1 : MAX_ROWS + 1]
    ]
    return Table(headers=headers, rows=rows, truncated=len(records) - 1 > MAX_ROWS)


def _adf_text(node: Any) -> str:
    """Texto plano de un documento Atlassian (ADF) como el que devuelve la API de Jira."""
    if isinstance(node, list):
        return "".join(_adf_text(n) for n in node)
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return str(node.get("text", ""))
    inner = _adf_text(node.get("content", []))
    return inner + "\n" if node.get("type") in _BLOCK_TYPES else inner


def _flatten(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool | int | float):
        return str(value)
    if isinstance(value, dict):
        if value.get("type") == "doc":
            return _adf_text(value).strip()
        for key in ("name", "displayName", "value", "key"):
            if isinstance(value.get(key), str):
                return str(value[key]).strip()
        return ""
    if isinstance(value, list):
        return ", ".join(part for part in (_flatten(v) for v in value) if part)
    return ""


def _issue_to_row(issue: Any) -> dict[str, str]:
    if not isinstance(issue, dict):
        raise ImportFormatError("Cada elemento del JSON debe ser un objeto")
    row: dict[str, str] = {}
    fields = issue.get("fields")
    merged: dict[str, Any] = {k: v for k, v in issue.items() if k != "fields"}
    if isinstance(fields, dict):
        merged.update(fields)
    for name, value in merged.items():
        row[str(name)] = _flatten(value)
    return row


def parse_json(text: str) -> Table:
    try:
        document = json.loads(text)
    except json.JSONDecodeError as error:
        raise ImportFormatError(f"El JSON no es válido: {error.msg}") from error
    issues = document.get("issues") if isinstance(document, dict) else document
    if not isinstance(issues, list) or not issues:
        raise ImportFormatError("El JSON debe ser una lista de historias o tener la clave «issues»")
    rows = [_issue_to_row(i) for i in issues[:MAX_ROWS]]
    headers: list[str] = []
    for row in rows:
        headers.extend(h for h in row if h not in headers)
    return Table(
        headers=headers,
        rows=[{h: r.get(h, "") for h in headers} for r in rows],
        truncated=len(issues) > MAX_ROWS,
    )


def parse_table(filename: str, data: bytes) -> tuple[str, Table]:
    text = decode(data)
    kind = detect_format(filename, text)
    return kind, (parse_json(text) if kind == "json" else parse_csv(text))


# --- mapeo de columnas ---
def suggest_mapping(headers: list[str]) -> dict[str, str | None]:
    """Propone qué columna alimenta cada campo; la persona puede corregirlo."""
    mapping: dict[str, str | None] = {name: None for name in FIELDS}
    normalized = {h: _normalize(h) for h in headers}
    for name in FIELDS:
        for header, norm in normalized.items():
            if header in mapping.values():
                continue
            base = re.sub(r"\s*\(\d+\)$", "", norm)  # «Description (2)» se trata como «Description»
            exact = base in SYNONYMS[name]
            custom = name == "acceptance_criteria" and any(s in base for s in SYNONYMS[name][:2])
            if exact or custom:
                mapping[name] = header
                break
    return mapping


def validate_mapping(mapping: dict[str, str | None], headers: list[str]) -> dict[str, str | None]:
    clean: dict[str, str | None] = {}
    for name in FIELDS:
        column = mapping.get(name)
        if column is not None and column not in headers:
            raise ImportFormatError(f"La columna «{column}» no existe en el archivo")
        clean[name] = column or None
    return clean


# --- filas ---
def split_criteria(text: str) -> tuple[str, ...]:
    lines = (_BULLET.sub("", line).strip() for line in text.splitlines())
    return tuple(line for line in lines if line)


def _split_description(description: str) -> tuple[str, str]:
    """Si la descripción trae su propio apartado de criterios, lo separa."""
    lines = description.splitlines()
    for position, line in enumerate(lines):
        if _CRITERIA_HEADING.match(line):
            return "\n".join(lines[:position]).strip(), "\n".join(lines[position + 1 :])
    return description, ""


def build_rows(table: Table, mapping: dict[str, str | None], max_chars: int) -> list[ImportRow]:
    def cell(row: dict[str, str], name: str) -> str:
        column = mapping.get(name)
        return row.get(column, "").strip() if column else ""

    result = []
    for position, row in enumerate(table.rows, start=1):
        description = cell(row, "description")
        criteria_text = cell(row, "acceptance_criteria")
        if not criteria_text:
            description, criteria_text = _split_description(description)
        title = cell(row, "title")
        criteria = split_criteria(criteria_text)
        issues = []
        if not description:
            issues.append("Sin descripción")
        if len(title) > MAX_TITLE_CHARS:
            issues.append(f"El título supera {MAX_TITLE_CHARS} caracteres")
        if len(criteria) > MAX_CRITERIA:
            issues.append(f"Tiene más de {MAX_CRITERIA} criterios")
        if len(title) + len(description) + sum(len(c) for c in criteria) > max_chars:
            issues.append(f"Supera el máximo de {max_chars} caracteres")
        result.append(
            ImportRow(
                index=position,
                key=cell(row, "key")[:MAX_KEY_CHARS],
                title=title,
                description=description,
                acceptance_criteria=criteria,
                issues=issues,
            )
        )
    return result
