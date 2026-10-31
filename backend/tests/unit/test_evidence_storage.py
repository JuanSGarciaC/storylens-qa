import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.infrastructure.persistence.database import init_db
from app.infrastructure.persistence.sql_evidence_storage import SqlEvidenceStorage


@pytest.fixture
def storage() -> SqlEvidenceStorage:
    engine = create_engine("sqlite://", poolclass=StaticPool)
    init_db(engine)
    return SqlEvidenceStorage(Session(engine))


def test_saved_images_are_loaded_and_deleted(storage: SqlEvidenceStorage) -> None:
    name = storage.save(b"datos", "png")
    assert name.endswith(".png") and storage.load(name) == b"datos"
    storage.delete(name)
    assert storage.load(name) is None
    storage.delete(name)  # borrar dos veces no falla


def test_each_image_gets_its_own_name(storage: SqlEvidenceStorage) -> None:
    assert storage.save(b"a", "jpg") != storage.save(b"a", "jpg")


@pytest.mark.parametrize("extension", ["gif", "svg", "html", "../png"])
def test_only_known_image_extensions_are_saved(storage: SqlEvidenceStorage, extension: str) -> None:
    with pytest.raises(ValueError):
        storage.save(b"x", extension)


def test_unknown_names_load_nothing(storage: SqlEvidenceStorage) -> None:
    assert storage.load("../../etc/passwd") is None
