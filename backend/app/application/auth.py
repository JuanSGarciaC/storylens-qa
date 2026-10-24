import time
from collections import defaultdict, deque
from collections.abc import Callable

from app.domain.auth import hash_password, verify_password
from app.domain.entities import StoredUser
from app.domain.ports.users import UserRepository

MAX_FAILURES = 5
LOCK_WINDOW_SECONDS = 15 * 60


class LoginThrottle:
    """Bloquea temporalmente un email tras demasiados intentos fallidos (en memoria)."""

    def __init__(
        self,
        max_failures: int = MAX_FAILURES,
        window_seconds: float = LOCK_WINDOW_SECONDS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max = max_failures
        self._window = window_seconds
        self._clock = clock
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _recent(self, key: str) -> deque[float]:
        failures = self._failures[key]
        now = self._clock()
        while failures and now - failures[0] >= self._window:
            failures.popleft()
        return failures

    def is_locked(self, email: str) -> bool:
        return len(self._recent(email.strip().lower())) >= self._max

    def record_failure(self, email: str) -> None:
        key = email.strip().lower()
        self._recent(key).append(self._clock())

    def reset(self, email: str) -> None:
        self._failures.pop(email.strip().lower(), None)


def ensure_owner(
    users: UserRepository, email: str | None, password: str | None
) -> StoredUser | None:
    """Crea o actualiza la cuenta del dueño. Sin credenciales configuradas no crea nada."""
    if not email or not password:
        return None
    existing = users.get_by_email(email)
    if existing is not None and verify_password(password, existing.password_hash):
        return existing
    return users.upsert(email, hash_password(password))


def authenticate(users: UserRepository, email: str, password: str) -> StoredUser | None:
    user = users.get_by_email(email)
    if user is None:
        # Gasta el mismo tiempo que una clave errónea para no revelar si el email existe.
        verify_password(password, hash_password("relleno"))
        return None
    return user if verify_password(password, user.password_hash) else None
