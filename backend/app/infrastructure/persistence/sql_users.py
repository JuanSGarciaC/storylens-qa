import uuid
from datetime import UTC, datetime

from sqlmodel import Session, col, select

from app.domain.entities import StoredUser
from app.infrastructure.persistence.models import UserRow


def _user(row: UserRow) -> StoredUser:
    return StoredUser(id=row.id, email=row.email, password_hash=row.password_hash)


class SqlUserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_email(self, email: str) -> StoredUser | None:
        row = self._session.exec(
            select(UserRow).where(UserRow.email == email.strip().lower())
        ).first()
        return _user(row) if row else None

    def get_by_id(self, user_id: str) -> StoredUser | None:
        row = self._session.get(UserRow, user_id)
        return _user(row) if row else None

    def count(self) -> int:
        return len(self._session.exec(select(UserRow.id)).all())

    def set_owner(self, email: str, password_hash: str) -> StoredUser:
        key = email.strip().lower()
        rows = list(self._session.exec(select(UserRow).order_by(col(UserRow.created_at))))
        if rows:
            row, extras = rows[0], rows[1:]
            row.email, row.password_hash = key, password_hash
        else:
            row = UserRow(
                id=str(uuid.uuid4()),
                email=key,
                password_hash=password_hash,
                created_at=datetime.now(UTC),
            )
            extras = []
        for extra in extras:
            self._session.delete(extra)
        self._session.add(row)
        self._session.commit()
        return _user(row)
