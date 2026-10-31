import uuid

from sqlmodel import Session

from app.infrastructure.persistence.models import EvidenceFileRow

ALLOWED_EXTENSIONS = {"png", "jpg", "webp"}


class SqlEvidenceStorage:
    """Imágenes de evidencia dentro de la base de datos.

    Los hosts gratuitos tienen disco efímero: en la base sobreviven a reinicios y despliegues.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def save(self, content: bytes, extension: str) -> str:
        if extension not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Extensión no permitida: {extension}")
        name = f"{uuid.uuid4()}.{extension}"
        self._session.add(EvidenceFileRow(name=name, content=content))
        self._session.commit()
        return name

    def load(self, name: str) -> bytes | None:
        row = self._session.get(EvidenceFileRow, name)
        return row.content if row else None

    def delete(self, name: str) -> None:
        row = self._session.get(EvidenceFileRow, name)
        if row is not None:
            self._session.delete(row)
            self._session.commit()
