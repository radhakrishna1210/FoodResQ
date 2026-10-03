"""0001_initial — exactly the schema in ARCHITECTURE §4 plus app_config defaults (§16).

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-04
"""
import json

from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA_SQL = r"""

CREATE TYPE user_role        AS ENUM ('donor','receiver','admin');
CREATE TYPE account_status   AS ENUM ('active','pending_verification','rejected','suspended');
CREATE TYPE donor_type       AS ENUM ('restaurant','hotel','college_hostel','caterer_event','other_business');
CREATE TYPE receiver_type    AS ENUM ('ngo','shelter','community_org','food_distributor');
CREATE TYPE food_category    AS ENUM ('cooked_meal','bakery','sweets','dairy','raw_produce','packaged');
CREATE TYPE diet_type        AS ENUM ('veg','egg','non_veg');
CREATE TYPE diet_acceptance  AS ENUM ('veg_only','veg_egg','all');
CREATE TYPE storage_condition AS ENUM ('hot_held','room_temp','refrigerated','packaged_sealed');
CREATE TYPE donation_status  AS ENUM ('POSTED','MATCHED','ACCEPTED','COLLECTED','COMPLETED','EXPIRED','CANCELLED','FLAGGED');
CREATE TYPE priority_level   AS ENUM ('HIGH','MEDIUM','LOW');
CREATE TYPE offer_status     AS ENUM ('PENDING','ACCEPTED','DECLINED','TIMED_OUT','SUPERSEDED','WITHDRAWN');
CREATE TYPE allocation_status AS ENUM ('ACCEPTED','COLLECTED','COMPLETED','NO_SHOW','CANCELLED');
CREATE TYPE feedback_direction AS ENUM ('donor_to_receiver','receiver_to_donor');
CREATE TYPE report_status    AS ENUM ('open','resolved_valid','resolved_invalid');
CREATE TYPE dispute_reason   AS ENUM ('no_show','quantity_mismatch','quality_issue','behaviour','other');
CREATE TYPE dispute_status   AS ENUM ('open','resolved');

CREATE TABLE users (
  id              uuid PRIMARY KEY,
  role            user_role NOT NULL,
  full_name       text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email           text NOT NULL UNIQUE,
  phone           text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  account_status  account_status NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donor_profiles (
  user_id          uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_name         text NOT NULL CHECK (char_length(org_name) BETWEEN 2 AND 120),
  donor_type       donor_type NOT NULL,
  fssai_license_no text NULL CHECK (fssai_license_no IS NULL OR fssai_license_no ~ '^[0-9]{14}$'),
  address          text NOT NULL,
  lat              double precision NOT NULL CHECK (lat BETWEEN 6 AND 38),
  lng              double precision NOT NULL CHECK (lng BETWEEN 68 AND 98),
  is_verified      boolean NOT NULL DEFAULT false,
  quality_score    numeric(4,3) NOT NULL DEFAULT 0.700,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE receiver_profiles (
  user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  org_name              text NOT NULL CHECK (char_length(org_name) BETWEEN 2 AND 120),
  receiver_type         receiver_type NOT NULL,
  fssai_registration_no text NOT NULL CHECK (fssai_registration_no ~ '^[0-9]{14}$'),
  ngo_darpan_id         text NULL,
  address               text NOT NULL,
  lat                   double precision NOT NULL CHECK (lat BETWEEN 6 AND 38),
  lng                   double precision NOT NULL CHECK (lng BETWEEN 68 AND 98),
  service_radius_km     numeric(4,1) NOT NULL DEFAULT 10 CHECK (service_radius_km BETWEEN 1 AND 20),
  max_capacity_servings integer NOT NULL CHECK (max_capacity_servings BETWEEN 1 AND 2000),
  diet_accepted         diet_acceptance NOT NULL,
  accepted_categories   food_category[] NOT NULL CHECK (cardinality(accepted_categories) >= 1),
  has_vehicle           boolean NOT NULL DEFAULT false,
  has_storage           boolean NOT NULL DEFAULT false,
  has_reheating         boolean NOT NULL DEFAULT false,
  operating_hours       jsonb NOT NULL,
  is_available_now      boolean NOT NULL DEFAULT true,
  meals_needed_today    integer NULL CHECK (meals_needed_today IS NULL OR meals_needed_today >= 0),
  meals_needed_set_on   date NULL,
  reliability_score     numeric(4,3) NOT NULL DEFAULT 0.700,
  verification_doc_path text NULL,
  verified_at           timestamptz NULL,
  verified_by           uuid NULL REFERENCES users(id),
  rejection_reason      text NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id               uuid NOT NULL REFERENCES users(id),
  title                  text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  description            text NULL CHECK (description IS NULL OR char_length(description) <= 500),
  food_category          food_category NOT NULL,
  diet_type              diet_type NOT NULL,
  quantity_servings      integer NOT NULL CHECK (quantity_servings BETWEEN 1 AND 1000),
  remaining_servings     integer NOT NULL CHECK (remaining_servings >= 0),
  expired_servings       integer NOT NULL DEFAULT 0,
  quantity_kg            numeric(7,2) NULL,
  allergens              text NULL,
  storage_condition      storage_condition NOT NULL,
  ambient_above_32c      boolean NOT NULL DEFAULT true,
  prepared_at            timestamptz NOT NULL,
  packaged_expiry_date   date NULL,
  donor_pickup_by        timestamptz NOT NULL,
  safe_pickup_deadline   timestamptz NOT NULL,
  effective_deadline     timestamptz NOT NULL,
  pickup_address         text NOT NULL,
  pickup_lat             double precision NOT NULL,
  pickup_lng             double precision NOT NULL,
  pickup_instructions    text NULL CHECK (pickup_instructions IS NULL OR char_length(pickup_instructions) <= 300),
  contact_phone          text NOT NULL CHECK (contact_phone ~ '^[6-9][0-9]{9}$'),
  batch_no               text NULL,
  temperature_c          numeric(4,1) NULL,
  checklist              jsonb NOT NULL,
  declaration_accepted   boolean NOT NULL CHECK (declaration_accepted = true),
  declaration_at         timestamptz NOT NULL,
  photo_paths            text[] NOT NULL DEFAULT '{}',
  status                 donation_status NOT NULL,
  priority_score         numeric(4,3) NOT NULL,
  priority_level         priority_level NOT NULL,
  search_radius_km       numeric(4,1) NOT NULL DEFAULT 10,
  flag_reasons           text[] NOT NULL DEFAULT '{}',
  cancel_reason          text NULL,
  no_match_alerted_at    timestamptz NULL,
  posted_at              timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_donations_status ON donations(status);
CREATE INDEX ix_donations_donor ON donations(donor_id, posted_at DESC);
CREATE INDEX ix_donations_deadline ON donations(effective_deadline) WHERE status IN ('POSTED','MATCHED','FLAGGED','ACCEPTED');

CREATE TABLE match_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id      uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  run_at           timestamptz NOT NULL DEFAULT now(),
  trigger          text NOT NULL,
  search_radius_km numeric(4,1) NOT NULL,
  remaining_servings integer NOT NULL,
  weights          jsonb NOT NULL,
  candidates       jsonb NOT NULL
);

CREATE TABLE offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id      uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  receiver_id      uuid NOT NULL REFERENCES users(id),
  match_run_id     uuid NOT NULL REFERENCES match_runs(id),
  rank             integer NOT NULL,
  match_score      integer NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  factor_scores    jsonb NOT NULL,
  reasons          text[] NOT NULL,
  distance_km      numeric(5,1) NOT NULL,
  eta_minutes      integer NOT NULL,
  offered_servings integer NOT NULL CHECK (offered_servings >= 1),
  status           offer_status NOT NULL DEFAULT 'PENDING',
  offered_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  responded_at     timestamptz NULL,
  decline_reason   text NULL,
  UNIQUE (donation_id, receiver_id)
);
CREATE INDEX ix_offers_receiver_pending ON offers(receiver_id) WHERE status = 'PENDING';
CREATE INDEX ix_offers_expiry ON offers(expires_at) WHERE status = 'PENDING';

CREATE TABLE allocations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id            uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  receiver_id            uuid NOT NULL REFERENCES users(id),
  offer_id               uuid NULL UNIQUE REFERENCES offers(id),
  servings               integer NOT NULL CHECK (servings >= 1),
  status                 allocation_status NOT NULL DEFAULT 'ACCEPTED',
  handover_code          char(4) NOT NULL,
  handover_attempts      integer NOT NULL DEFAULT 0,
  accepted_at            timestamptz NOT NULL DEFAULT now(),
  eta_at                 timestamptz NOT NULL,
  collected_at           timestamptz NULL,
  servings_distributed   integer NULL,
  distribution_area      text NULL,
  distributed_at         timestamptz NULL,
  completed_at           timestamptz NULL,
  completion_unconfirmed boolean NOT NULL DEFAULT false,
  cancelled_at           timestamptz NULL,
  cancelled_by           uuid NULL REFERENCES users(id),
  cancel_reason          text NULL
);
CREATE INDEX ix_alloc_receiver ON allocations(receiver_id, accepted_at DESC);
CREATE INDEX ix_alloc_donation ON allocations(donation_id);

CREATE TABLE messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id  uuid NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  sender_id      uuid NOT NULL REFERENCES users(id),
  body           text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_messages_alloc ON messages(allocation_id, created_at);

CREATE TABLE feedback (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id      uuid NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  from_user_id       uuid NOT NULL REFERENCES users(id),
  to_user_id         uuid NOT NULL REFERENCES users(id),
  direction          feedback_direction NOT NULL,
  overall_rating     smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  on_time            boolean NULL,
  professional       boolean NULL,
  proper_containers  boolean NULL,
  quantity_matched   boolean NULL,
  fresh_on_arrival   boolean NULL,
  properly_packed    boolean NULL,
  safety_issue       boolean NOT NULL DEFAULT false,
  comment            text NULL CHECK (comment IS NULL OR char_length(comment) <= 500),
  photo_path         text NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, direction)
);

CREATE TABLE safety_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id  uuid NOT NULL REFERENCES allocations(id),
  donation_id    uuid NOT NULL REFERENCES donations(id),
  donor_id       uuid NOT NULL REFERENCES users(id),
  reported_by    uuid NOT NULL REFERENCES users(id),
  description    text NOT NULL,
  photo_path     text NULL,
  status         report_status NOT NULL DEFAULT 'open',
  admin_notes    text NULL,
  resolved_by    uuid NULL REFERENCES users(id),
  resolved_at    timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id  uuid NOT NULL REFERENCES allocations(id),
  raised_by      uuid NOT NULL REFERENCES users(id),
  reason         dispute_reason NOT NULL,
  description    text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  status         dispute_status NOT NULL DEFAULT 'open',
  resolution     text NULL,
  resolved_by    uuid NULL REFERENCES users(id),
  resolved_at    timestamptz NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL,
  link        text NULL,
  read_at     timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid NULL REFERENCES users(id),
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  before       jsonb NULL,
  after        jsonb NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_config (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid NULL REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assistant_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
"""

TABLES = ["assistant_messages", "app_config", "audit_log", "notifications", "disputes", "safety_reports",
          "feedback", "messages", "allocations", "offers", "match_runs", "donations", "receiver_profiles",
          "donor_profiles", "users"]
TYPES = ["dispute_status", "dispute_reason", "report_status", "feedback_direction", "allocation_status",
         "offer_status", "priority_level", "donation_status", "storage_condition", "diet_acceptance", "diet_type",
         "food_category", "receiver_type", "donor_type", "account_status", "user_role"]


def upgrade() -> None:
    op.execute(SCHEMA_SQL)
    from app.services.app_config import DEFAULT_CONFIG

    conn = op.get_bind()
    import sqlalchemy as sa

    for key, value in DEFAULT_CONFIG.items():
        conn.execute(sa.text("INSERT INTO app_config (key, value) VALUES (:k, CAST(:v AS jsonb))"),
                     {"k": key, "v": json.dumps(value)})


def downgrade() -> None:
    for t in TABLES:
        op.execute(f"DROP TABLE IF EXISTS {t} CASCADE")
    for t in TYPES:
        op.execute(f"DROP TYPE IF EXISTS {t}")
