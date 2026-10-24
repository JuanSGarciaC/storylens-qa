import time
from collections.abc import Callable

from app.infrastructure.llm.rate_limiter import SlidingWindowLimiter

ONE_DAY_SECONDS = 24 * 60 * 60


class InMemoryQuota:
    """Cuota en memoria por clave (modelo). Se pierde al reiniciar: solo para pruebas."""

    def __init__(
        self,
        per_minute: int,
        per_day: int,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._per_minute = per_minute
        self._per_day = per_day
        self._clock = clock
        self._limits: dict[str, tuple[SlidingWindowLimiter, SlidingWindowLimiter]] = {}

    def try_acquire(self, key: str) -> bool:
        if key not in self._limits:
            self._limits[key] = (
                SlidingWindowLimiter(self._per_minute, 60, self._clock),
                SlidingWindowLimiter(self._per_day, ONE_DAY_SECONDS, self._clock),
            )
        per_minute, per_day = self._limits[key]
        return per_minute.try_acquire() and per_day.try_acquire()
