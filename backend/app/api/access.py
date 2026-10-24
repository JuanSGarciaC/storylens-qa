import time
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from app.api.deps import Users
from app.config import get_settings
from app.domain.auth import read_session

SESSION_COOKIE = "storylens_session"


@dataclass(frozen=True)
class Principal:
    user_id: str | None = None
    email: str | None = None

    @property
    def is_owner(self) -> bool:
        return self.user_id is not None


def get_principal(request: Request, users: Users) -> Principal:
    """Quién hace la petición. Cualquier cookie inválida cuenta como anónimo."""
    secret = get_settings().session_secret
    token = request.cookies.get(SESSION_COOKIE)
    if not secret or not token:
        return Principal()
    user_id = read_session(token, secret, time.time())
    user = users.get_by_id(user_id) if user_id else None
    return Principal(user.id, user.email) if user else Principal()


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]
