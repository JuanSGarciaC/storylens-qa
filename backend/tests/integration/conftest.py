from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.api.deps import get_llm, get_storage
from app.application.auth import LoginThrottle, ensure_owner
from app.infrastructure.persistence.database import get_session, init_db
from app.infrastructure.persistence.sql_users import SqlUserRepository
from app.infrastructure.storage.local import LocalEvidenceStorage
from app.main import app


@pytest.fixture
def storage_dir(tmp_path: Path) -> Path:
    return tmp_path / "evidence"


@pytest.fixture
def engine() -> Engine:
    """Base SQLite en memoria compartida por el cliente y las pruebas que la inspeccionan."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    init_db(engine)
    return engine


@pytest.fixture
def anon_client(client: TestClient) -> TestClient:
    """Mismo servidor y base que `client`, pero sin sesión iniciada."""
    return TestClient(app)


@pytest.fixture
def client(storage_dir: Path, engine: Engine) -> Iterator[TestClient]:
    """Cliente con base SQLite en memoria, evidencias en una carpeta temporal y sin IA.

    Trae un proyecto de prueba creado (`client.project_id`) donde viven las historias de las
    pruebas. Cada prueba sustituye la IA si la necesita (`app.dependency_overrides[get_llm]`).
    """

    def override_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_llm] = lambda: None
    app.dependency_overrides[get_storage] = lambda: LocalEvidenceStorage(storage_dir)
    app.state.login_throttle = LoginThrottle()
    with Session(engine) as db:
        ensure_owner(SqlUserRepository(db), "owner@test.local", "test-pass-123")
    test_client = TestClient(app)
    logged = test_client.post(
        "/api/v1/auth/login", json={"email": "owner@test.local", "password": "test-pass-123"}
    )
    assert logged.status_code == 200, logged.text
    created = test_client.post("/api/v1/projects", json={"name": "Proyecto de prueba"})
    test_client.project_id = created.json()["id"]  # type: ignore[attr-defined]
    yield test_client
    app.dependency_overrides.clear()
