from app.infrastructure.llm.rate_limiter import SlidingWindowLimiter


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_blocks():
    limiter = SlidingWindowLimiter(2, 60, Clock())
    assert [limiter.try_acquire() for _ in range(3)] == [True, True, False]


def test_slots_free_up_after_the_window():
    clock = Clock()
    limiter = SlidingWindowLimiter(1, 60, clock)
    assert limiter.try_acquire()
    clock.now = 59
    assert not limiter.try_acquire()
    clock.now = 60
    assert limiter.try_acquire()


def test_rejected_calls_do_not_consume_slots():
    clock = Clock()
    limiter = SlidingWindowLimiter(1, 60, clock)
    limiter.try_acquire()
    for _ in range(10):
        limiter.try_acquire()
    clock.now = 60
    assert limiter.try_acquire()
