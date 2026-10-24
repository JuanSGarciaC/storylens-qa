from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

BACKEND_DIR = Path(__file__).resolve().parents[3]


class LegacyDatabaseError(Exception):
    """La base se creó con `create_all` y no tiene historial de migraciones."""


def normalize_database_url(url: str) -> str:
    """Los proveedores gratuitos entregan `postgres://`; SQLAlchemy necesita el driver explícito."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def upgrade_to_head(database_url: str) -> None:
    """Lleva la base al último esquema. Es seguro repetirlo."""
    url = normalize_database_url(database_url)
    engine = create_engine(url)
    try:
        tables = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()
    if tables and "alembic_version" not in tables:
        raise LegacyDatabaseError(
            "La base de datos se creó sin migraciones: bórrala para empezar de cero "
            "(el proyecto no conserva datos anteriores)."
        )
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(config, "head")
