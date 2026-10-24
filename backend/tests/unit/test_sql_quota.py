import threading
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Engine
from sqlmodel import create_engine

from app.infrastructure.persistence.database import init_db
from app.infrastructure.persistence.sql_quota import SqlQuota


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs: float) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture
def engine(tmp_path) -> Engine:
    engine = create_engine(f"sqlite:///{(tmp_path / 'quota.db').as_posix()}")
    init_db(engine)
    return engine


def test_blocks_after_per_minute_limit_and_recovers(engine) -> None:
    clock = Clock()
    quota = SqlQuota(engine, per_minute=5, per_day=100, clock=clock)

    assert [quota.try_acquire("m") for _ in range(6)] == [True] * 5 + [False]
    clock.advance(seconds=61)
    assert quota.try_acquire("m") is True


def test_blocks_after_daily_limit(engine) -> None:
    clock = Clock()
    quota = SqlQuota(engine, per_minute=100, per_day=3, clock=clock)

    results = []
    for _ in range(4):
        results.append(quota.try_acquire("m"))
        clock.advance(minutes=5)

    assert results == [True, True, True, False]
    clock.advance(hours=24)
    assert quota.try_acquire("m") is True


def test_quota_survives_a_new_instance(engine) -> None:
    """Un reinicio del servidor no reinicia el contador."""
    clock = Clock()
    first = SqlQuota(engine, per_minute=100, per_day=2, clock=clock)
    assert first.try_acquire("m") and first.try_acquire("m")

    second = SqlQuota(engine, per_minute=100, per_day=2, clock=clock)

    assert second.try_acquire("m") is False
    assert second.remaining_today("m") == 0


def test_each_model_has_its_own_quota(engine) -> None:
    quota = SqlQuota(engine, per_minute=1, per_day=10, clock=Clock())

    assert quota.try_acquire("primary") is True
    assert quota.try_acquire("primary") is False
    assert quota.try_acquire("backup") is True


def test_concurrent_acquires_do_not_exceed_the_limit(engine) -> None:
    """Review Focus 5: peticiones simultáneas en el límite no lo superan."""
    quota = SqlQuota(engine, per_minute=5, per_day=100, clock=Clock())
    results: list[bool] = []
    barrier = threading.Barrier(20)

    def worker() -> None:
        barrier.wait()
        results.append(quota.try_acquire("m"))

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert results.count(True) == 5
    assert results.count(False) == 15


def test_remaining_today_counts_down(engine) -> None:
    quota = SqlQuota(engine, per_minute=100, per_day=10, clock=Clock())
    assert quota.remaining_today("m") == 10

    quota.try_acquire("m")
    quota.try_acquire("m")

    assert quota.remaining_today("m") == 8
