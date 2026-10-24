from alembic import context
from sqlalchemy import create_engine
from sqlmodel import SQLModel

from app.infrastructure.persistence import models  # noqa: F401  (registra las tablas)

config = context.config
target_metadata = SQLModel.metadata


def run_migrations_online() -> None:
    engine = create_engine(config.get_main_option("sqlalchemy.url") or "")
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite no soporta todos los ALTER TABLE
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
