"""0002_rls — Row Level Security for Supabase Realtime (ARCHITECTURE §4.4, §18).

SELECT-only policies so Realtime delivers rows to the right browser. No INSERT/UPDATE/DELETE policies.
All other tables: RLS enabled with no policies. Skipped automatically on plain Postgres (no `auth` schema,
e.g. local docker-compose), where auth.uid() does not exist.

Revision ID: 0002_rls
Revises: 0001_initial
Create Date: 2026-10-04
"""
from alembic import op

revision = "0002_rls"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

ALL_TABLES = ["users", "donor_profiles", "receiver_profiles", "donations", "match_runs", "offers", "allocations",
              "messages", "feedback", "safety_reports", "disputes", "notifications", "audit_log", "app_config",
              "assistant_messages"]

POLICIES = r"""
CREATE POLICY notifications_select_own ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY offers_select_own ON offers FOR SELECT TO authenticated USING (receiver_id = auth.uid());
CREATE POLICY allocations_select_party ON allocations FOR SELECT TO authenticated USING (
  receiver_id = auth.uid()
  OR EXISTS (SELECT 1 FROM donations d WHERE d.id = allocations.donation_id AND d.donor_id = auth.uid())
);
CREATE POLICY messages_select_party ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM allocations a JOIN donations d ON d.id = a.donation_id
          WHERE a.id = messages.allocation_id AND (a.receiver_id = auth.uid() OR d.donor_id = auth.uid()))
);
CREATE POLICY donations_select_own ON donations FOR SELECT TO authenticated USING (donor_id = auth.uid());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications, messages, donations, offers, allocations;
  END IF;
END $$;
"""


def _has_auth_schema() -> bool:
    import sqlalchemy as sa

    return bool(op.get_bind().execute(sa.text(
        "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth'")).scalar())


def upgrade() -> None:
    if not _has_auth_schema():
        return
    for t in ALL_TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
    op.execute(POLICIES)


def downgrade() -> None:
    if not _has_auth_schema():
        return
    for name, table in [("notifications_select_own", "notifications"), ("offers_select_own", "offers"),
                        ("allocations_select_party", "allocations"), ("messages_select_party", "messages"),
                        ("donations_select_own", "donations")]:
        op.execute(f"DROP POLICY IF EXISTS {name} ON {table}")
    for t in ALL_TABLES:
        op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
