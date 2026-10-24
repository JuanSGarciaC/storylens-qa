import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect
from sqlmodel import SQLModel

from app.infrastructure.persistence import models  # noqa: F401  (registra las tablas)
from app.infrastructure.persistence.migrations import LegacyDatabaseError, upgrade_to_head


def url(tmp_path) -> str:
    return f"sqlite:///{(tmp_path / 'migrated.db').as_posix()}"


def test_upgrade_creates_all_tables(tmp_path) -> None:
    database = url(tmp_path)

    upgrade_to_head(database)

    tables = set(inspect(create_engine(database)).get_table_names())
    assert tables == set(SQLModel.metadata.tables) | {"alembic_version"}


def test_migration_matches_models(tmp_path) -> None:
    """Si alguien cambia un modelo sin crear su migración, esta prueba falla."""
    database = url(tmp_path)
    upgrade_to_head(database)

    with create_engine(database).connect() as connection:
        context = MigrationContext.configure(connection)
        assert compare_metadata(context, SQLModel.metadata) == []


def test_upgrade_is_idempotent(tmp_path) -> None:
    database = url(tmp_path)

    upgrade_to_head(database)
    upgrade_to_head(database)

    assert "project" in inspect(create_engine(database)).get_table_names()


def test_database_created_without_migrations_is_rejected_with_a_clear_message(tmp_path) -> None:
    database = url(tmp_path)
    SQLModel.metadata.create_all(create_engine(database))

    with pytest.raises(LegacyDatabaseError, match="sin migraciones"):
        upgrade_to_head(database)


def test_postgres_urls_from_hosting_providers_are_normalized() -> None:
    from app.infrastructure.persistence.migrations import normalize_database_url

    assert normalize_database_url("postgres://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_database_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert (
        normalize_database_url("postgresql+psycopg://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    )
    assert normalize_database_url("sqlite:///x.db") == "sqlite:///x.db"
