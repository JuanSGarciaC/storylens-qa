"""evidence files stored in the database

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Las imágenes anteriores vivían en disco (EVIDENCE_DIR) y no se migran: en los hosts
    # gratuitos ese disco ya se había perdido; sus evidencias responden 404.
    op.create_table(
        "evidence_file",
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.PrimaryKeyConstraint("name"),
    )


def downgrade() -> None:
    op.drop_table("evidence_file")
