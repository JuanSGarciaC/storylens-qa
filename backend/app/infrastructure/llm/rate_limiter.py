import threading
import time
from collections import deque
from collections.abc import Callable


class SlidingWindowLimiter:
    """Permite como máximo `max_calls` llamadas en cualquier ventana de `window_seconds`."""

    def __init__(
        self,
        max_calls: int,
        window_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_calls = max_calls
        self._window = window_seconds
        self._clock = clock
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def try_acquire(self) -> bool:
        with self._lock:
            now = self._clock()
            while self._calls and now - self._calls[0] >= self._window:
                self._calls.popleft()
            if len(self._calls) >= self._max_calls:
                return False
            self._calls.append(now)
            return True
