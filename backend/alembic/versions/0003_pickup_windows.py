"""0003_pickup_windows — pickup windows per storage condition + post-pickup edibility hours.

safe_window_hours now means "hours after preparation within which the food must be picked up";
consumption_buffer_minutes is replaced by post_pickup_consume_hours.

Revision ID: 0003_pickup_windows
Revises: 0002_rls
Create Date: 2026-10-05
"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0003_pickup_windows"
down_revision = "0002_rls"
branch_labels = None
depends_on = None

NEW = {
    "safe_window_hours": {"hot_held": 6, "room_temp": 6, "room_temp_hot_ambient": 6, "refrigerated": 12},
    "packaged_expiry_buffer_hours": 18,
    "post_pickup_consume_hours": 4,
}


def upgrade() -> None:
    conn = op.get_bind()
    for key, value in NEW.items():
        conn.execute(
            sa.text(
                "INSERT INTO app_config (key, value) VALUES (:k, CAST(:v AS jsonb)) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
            ),
            {"k": key, "v": json.dumps(value)},
        )
    conn.execute(sa.text("DELETE FROM app_config WHERE key = 'consumption_buffer_minutes'"))


def downgrade() -> None:
    conn = op.get_bind()
    old = {
        "safe_window_hours": {"hot_held": 4, "room_temp": 2, "room_temp_hot_ambient": 1, "refrigerated": 12},
        "packaged_expiry_buffer_hours": 12,
        "consumption_buffer_minutes": 30,
    }
    for key, value in old.items():
        conn.execute(
            sa.text(
                "INSERT INTO app_config (key, value) VALUES (:k, CAST(:v AS jsonb)) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
            ),
            {"k": key, "v": json.dumps(value)},
        )
    conn.execute(sa.text("DELETE FROM app_config WHERE key = 'post_pickup_consume_hours'"))
