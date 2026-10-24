import re
import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {"png", "jpg", "webp"}
# Solo se aceptan nombres que generó este mismo almacenamiento: evita rutas inventadas
# (p. ej. "../../etc/passwd") si algún día un nombre llega desde fuera.
_NAME = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$"
)


class LocalEvidenceStorage:
    def __init__(self, base_dir: str | Path) -> None:
        self._base = Path(base_dir).resolve()

    def save(self, content: bytes, extension: str) -> str:
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Extensión no permitida: {extension}")
        self._base.mkdir(parents=True, exist_ok=True)
        name = f"{uuid.uuid4()}.{extension}"
        (self._base / name).write_bytes(content)
        return name

    def path(self, name: str) -> Path:
        if not _NAME.match(name):
            raise ValueError("Nombre de archivo no válido")
        return self._base / name

    def delete(self, name: str) -> None:
        try:
            self.path(name).unlink(missing_ok=True)
        except ValueError:
            return  # un nombre no válido nunca pudo haberse guardado aquí
