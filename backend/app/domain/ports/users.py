from typing import Protocol

from app.domain.entities.user import StoredUser


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> StoredUser | None: ...

    def get_by_id(self, user_id: str) -> StoredUser | None: ...

    def upsert(self, email: str, password_hash: str) -> StoredUser:
        """Crea el usuario o cambia su hash si el email ya existe."""
        ...
