from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.api.deps import get_llm, get_storage
from app.infrastructure.persistence.database import get_session, init_db
from app.infrastructure.storage.local import LocalEvidenceStorage
from app.main import app


@pytest.fixture
def storage_dir(tmp_path: Path) -> Path:
    return tmp_path / "evidence"


@pytest.fixture
def client(storage_dir: Path) -> Iterator[TestClient]:
    """Cliente con base SQLite en memoria, evidencias en una carpeta temporal y sin IA.

    Cada prueba sustituye la IA si la necesita (`app.dependency_overrides[get_llm]`).
    """
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    init_db(engine)

    def override_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_llm] = lambda: None
    app.dependency_overrides[get_storage] = lambda: LocalEvidenceStorage(storage_dir)
    yield TestClient(app)
    app.dependency_overrides.clear()
