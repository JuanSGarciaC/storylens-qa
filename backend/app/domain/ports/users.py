from typing import Protocol

from app.domain.entities.user import StoredUser


class UserRepository(Protocol):
    def get_by_email(self, email: str) -> StoredUser | None: ...

    def get_by_id(self, user_id: str) -> StoredUser | None: ...

    def count(self) -> int: ...

    def set_owner(self, email: str, password_hash: str) -> StoredUser:
        """Deja una única cuenta: reutiliza la existente (mismo id, así conserva sus proyectos)
        cambiando su correo y clave, y borra las demás."""
        ...
