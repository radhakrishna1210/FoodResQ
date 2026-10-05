# FoodResQ — Architecture

This document is the technical source of truth. Names in this file (tables, columns, enums, statuses, endpoints, routes, config keys) are **exact** and must be used character for character. Read `README.md` first for scope and rules, and `WALKTHROUGH.md` for the expected behaviour and demo numbers.

Contents
1. System overview
2. Tech stack and versions
3. Authentication and authorization
4. Database schema
5. State machines
6. Validation, safe deadline, auto-flags, priority
7. Bridge matching engine
8. Notifications and realtime
9. Backend and frontend structure
10. API reference
11. AI assistant (Phase 6)
12. Background jobs
13. Trust scores (reliability and quality)
14. Records, impact and analytics
15. Security checklist
16. Configuration (`app_config`)
17. Error format and conventions
18. Deployment
19. Testing strategy

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend: React + TypeScript + Tailwind (Vercel)             │
│ Role-based dashboards: Donor · Receiver · Admin              │
│ Uses Supabase JS ONLY for: auth, signed-URL uploads,         │
│ realtime subscriptions (notifications, messages, donations)  │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS + Bearer <Supabase access token>
┌───────────────▼──────────────────────────────────────────────┐
│ Backend: FastAPI (Render)                                    │
│  routers → services → repositories → PostgreSQL              │
│  Services: auth/RBAC · donations · validation · priority ·   │
│  Bridge matching · offers · allocations · messaging ·           │
│  feedback · trust scores · notifications · records ·         │
│  admin · assistant (Phase 6)                                 │
│  Jobs: APScheduler (60 s) + POST /internal/tick (cron ping)  │
└───────┬───────────────────┬───────────────────┬──────────────┘
        │                   │                   │
┌───────▼───────┐  ┌────────▼────────┐  ┌───────▼─────────────┐
│ Supabase      │  │ Supabase        │  │ Gemini API          │
│ PostgreSQL    │  │ Storage         │  │ (assistant only,    │
│ Auth, Realtime│  │ photos & docs   │  │  server-side)       │
└───────────────┘  └─────────────────┘  └─────────────────────┘
Map tiles: OpenStreetMap via Leaflet (frontend only)
```

**Principles**
- Monolith backend with a clean layered structure. No microservices, queues or Redis.
- **All business writes go through FastAPI** using the database connection (service role). The browser never writes business tables directly.
- Server computes everything that matters: deadlines, priority, scores, statuses, ownership.
- Every state change is recorded in `audit_log` and triggers notifications.

---

## 2. Tech stack and versions

| Area | Package | Notes |
|---|---|---|
| Frontend build | Vite 5, TypeScript 5 (strict mode) | |
| UI | React 18, Tailwind CSS 3, `lucide-react` icons | No other UI kit required |
| Routing | `react-router-dom` 6 | |
| Server state | `@tanstack/react-query` 5 | All API calls through a typed client in `src/lib/api.ts` |
| Forms | `react-hook-form` + `zod` | Zod schemas mirror backend Pydantic rules |
| Maps | `leaflet`, `react-leaflet` 4 | OpenStreetMap tiles; attribution required |
| Supabase | `@supabase/supabase-js` 2 | Auth, storage upload with signed URL, realtime |
| Dates | `date-fns`, `date-fns-tz` | Display in `Asia/Kolkata` |
| Backend | Python 3.11+, `fastapi`, `uvicorn[standard]`, `pydantic` 2, `pydantic-settings` | |
| DB | `sqlalchemy` 2.0, `alembic`, `psycopg[binary]` 3 | Alembic owns the schema |
| Auth verify | `pyjwt[crypto]` | Verify Supabase JWT |
| Jobs | `apscheduler` 3 | |
| Supabase admin | `supabase` (python) | Storage signed URLs only |
| AI | `google-genai` | Phase 6 only |
| Tests | `pytest`, `pytest-asyncio`, `httpx`; frontend `vitest`, `@testing-library/react` | |
| Lint | `ruff` (Python), `eslint` + `prettier` (TS) | |

---

## 3. Authentication and authorization

### 3.1 Flow
1. User signs in with Google on the frontend (`GET /api/v1/auth/google/login` → Google consent screen → `GET /api/v1/auth/google/callback`). The backend verifies Google's ID token itself (JWKS), resolves the account by email (`uuid5(NAMESPACE_URL, "foodresq-demo:{email}")` for a new email — the same scheme `scripts/seed.py` and the prototype dev-login use, so any login method for the same address lands on one account), and mints its own session JWT (`iss=foodresq-google`, signed with `APP_JWT_SECRET`). No Supabase Auth, no password login (README D6).
2. Frontend sends `Authorization: Bearer <access_token>` on every API call.
3. FastAPI dependency `get_current_user` verifies the JWT (signature, expiry, audience `authenticated`). `decode_token` checks, in order: the dev-login issuer (`DEV_AUTH_ENABLED` only), the Google-login issuer (`APP_JWT_SECRET`, always available), then falls back to `SUPABASE_JWKS_URL` / `SUPABASE_JWT_SECRET` for a Supabase-issued token if one is ever presented. It reads `sub` (the account id) and loads the row from `users`.
4. If no `users` row exists, only `POST /api/v1/onboarding` and `GET /api/v1/me` are allowed (`GET /me` returns `{ "onboarded": false }`).
5. **The role is read from our `users` table, never from the token or the request body.**

### 3.2 Onboarding
`POST /api/v1/onboarding` creates the `users` row and the matching profile in one transaction.
- `role` must be `donor` or `receiver`. `admin` is rejected with 403.
- Donor → `account_status = 'active'`.
- Receiver → `account_status = 'pending_verification'`.

### 3.3 RBAC dependencies
- `require_role("donor")`, `require_role("receiver")`, `require_role("admin")`.
- `require_active()` blocks `pending_verification`, `rejected`, `suspended` from everything except `GET /me`, profile editing, notifications and logout.
- Ownership checks inside services: a Donor can only read and modify their own donations; a Receiver only their own offers and allocations; chat, feedback and dispute endpoints require the user to be the Donor or Receiver of that allocation.

### 3.4 Admin accounts
Created by `scripts/seed.py` or by an Admin via `POST /api/v1/admin/admins`. Never through public signup.

---

## 4. Database schema

Alembic migration `0001_initial` must create exactly this. PostgreSQL. All ids are `uuid` with `gen_random_uuid()`. All times are `timestamptz` in UTC.

### 4.1 Enums

```sql
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
```

Note: the pitch deck shows `REJECTED` as an alternate state. In this design rejection belongs to an **offer** (`offer_status = 'DECLINED'`), not to a donation. The UI label for a declined offer is "Rejected".

### 4.2 Tables

```sql
-- One row per person; id equals Supabase auth.users.id
CREATE TABLE users (
  id              uuid PRIMARY KEY,
  role            user_role NOT NULL,
  full_name       text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  email           text NOT NULL UNIQUE,
  phone           text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),   -- Indian mobile, 10 digits
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
  lat              double precision NOT NULL CHECK (lat BETWEEN 6 AND 38),     -- India bounding box
  lng              double precision NOT NULL CHECK (lng BETWEEN 68 AND 98),
  is_verified      boolean NOT NULL DEFAULT false,   -- Admin badge, optional
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
  operating_hours       jsonb NOT NULL,   -- see §4.3
  is_available_now      boolean NOT NULL DEFAULT true,
  meals_needed_today    integer NULL CHECK (meals_needed_today IS NULL OR meals_needed_today >= 0),
  meals_needed_set_on   date NULL,        -- IST date; value ignored if not today
  reliability_score     numeric(4,3) NOT NULL DEFAULT 0.700,
  verification_doc_path text NULL,        -- storage path in verification-docs
  verified_at           timestamptz NULL,
  verified_by           uuid NULL REFERENCES users(id),
  rejection_reason      text NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE donations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id               uuid NOT NULL REFERENCES users(id),
  title                  text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),  -- "name of food"
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
  safe_pickup_deadline   timestamptz NOT NULL,   -- computed, §6.2
  effective_deadline     timestamptz NOT NULL,   -- min(donor_pickup_by, safe_pickup_deadline)
  pickup_address         text NOT NULL,
  pickup_lat             double precision NOT NULL,
  pickup_lng             double precision NOT NULL,
  pickup_instructions    text NULL CHECK (pickup_instructions IS NULL OR char_length(pickup_instructions) <= 300),
  contact_phone          text NOT NULL CHECK (contact_phone ~ '^[6-9][0-9]{9}$'),
  batch_no               text NULL,
  temperature_c          numeric(4,1) NULL,
  checklist              jsonb NOT NULL,         -- §6.1, all five keys must be true
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

-- One row per matching run; stores every evaluated Receiver for explainability
CREATE TABLE match_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id      uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  run_at           timestamptz NOT NULL DEFAULT now(),
  trigger          text NOT NULL,   -- 'posted'|'approved'|'declined'|'timed_out'|'allocation_cancelled'|'scheduler'|'radius_widened'
  search_radius_km numeric(4,1) NOT NULL,
  remaining_servings integer NOT NULL,
  weights          jsonb NOT NULL,
  candidates       jsonb NOT NULL   -- array, see §7.6
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
  UNIQUE (donation_id, receiver_id)   -- a Receiver is offered a given donation at most once
);
CREATE INDEX ix_offers_receiver_pending ON offers(receiver_id) WHERE status = 'PENDING';
CREATE INDEX ix_offers_expiry ON offers(expires_at) WHERE status = 'PENDING';

CREATE TABLE allocations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id            uuid NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  receiver_id            uuid NOT NULL REFERENCES users(id),
  offer_id               uuid NULL UNIQUE REFERENCES offers(id),   -- NULL when Admin assigned manually
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
  -- donor_to_receiver fields
  on_time            boolean NULL,
  professional       boolean NULL,
  proper_containers  boolean NULL,
  -- receiver_to_donor fields
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
  type        text NOT NULL,     -- see §8.1
  title       text NOT NULL,
  body        text NOT NULL,
  link        text NULL,         -- frontend route
  read_at     timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid NULL REFERENCES users(id),   -- NULL = system/job
  action       text NOT NULL,                    -- e.g. 'donation.status_changed'
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

-- Phase 6 only
CREATE TABLE assistant_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  role         text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 JSON shapes

`receiver_profiles.operating_hours` — keys `mon`..`sun`, each either `null` (closed) or `{"open":"HH:MM","close":"HH:MM"}` in IST. `close` may be `"24:00"`. Overnight windows (close < open) are allowed and mean "until the next day".
```json
{"mon":{"open":"00:00","close":"24:00"}, "tue":{"open":"09:00","close":"23:00"}, "sun":null}
```

`donations.checklist` — all five keys required and must be `true`:
```json
{"hygienic_handling":true,"not_served_from_plates":true,"covered_containers":true,"segregated_from_waste":true,"no_spoilage_signs":true}
```

### 4.4 Row Level Security (Supabase)

The backend connects with full privileges. RLS exists only so that **Supabase Realtime from the browser** delivers rows to the right people. Enable RLS on `notifications`, `messages`, `donations`, `offers`, `allocations` with **SELECT-only** policies:
- `notifications`: `user_id = auth.uid()`.
- `offers`: `receiver_id = auth.uid()`.
- `allocations`: `receiver_id = auth.uid()` OR the donation's `donor_id = auth.uid()`.
- `messages`: the user is the receiver of the allocation or the donor of its donation.
- `donations`: `donor_id = auth.uid()`.
No INSERT/UPDATE/DELETE policies for `anon` or `authenticated`. All other tables: RLS enabled with no policies (browser cannot read them).

### 4.5 Storage buckets
| Bucket | Access | Path pattern |
|---|---|---|
| `donation-photos` | private; read via signed URL (1 h) | `{donor_id}/{uuid}.jpg` |
| `verification-docs` | private; Admin only via signed URL | `{receiver_id}/{uuid}.pdf\|jpg` |
| `feedback-photos` | private; Admin and the two parties | `{allocation_id}/{uuid}.jpg` |

Upload flow: frontend calls `POST /api/v1/uploads/sign` with `{bucket, content_type}` → backend checks role and returns a signed upload URL and path → frontend uploads → frontend sends the path in the business request. Allowed types: `image/jpeg`, `image/png`, `image/webp`, and `application/pdf` (verification docs only). Max 5 MB.

---

## 5. State machines

All transitions live in `backend/app/services/state.py` as explicit tables. Any transition not listed raises `InvalidTransition` (HTTP 409).

### 5.1 Donation status

```
            create (validation passes)
                 │
      ┌──────────┴──────────┐
  auto-flag?              no flag
      │                     │
   FLAGGED ──approve──▶  POSTED ◀──────────────┐
      │                     │ offers sent      │ all pending offers declined/timed out,
   reject                   ▼                  │ remaining > 0
      │                  MATCHED ──────────────┘
      ▼                     │ remaining_servings reaches 0
  CANCELLED                 ▼
                         ACCEPTED
                            │ all active allocations COLLECTED
                            ▼
                         COLLECTED
                            │ all allocations COMPLETED or NO_SHOW (≥1 COMPLETED)
                            ▼
                         COMPLETED
```

| From | To | Trigger | Actor |
|---|---|---|---|
| (new) | POSTED | Create, no auto-flag | Donor |
| (new) | FLAGGED | Create, ≥1 auto-flag reason | Donor |
| FLAGGED | POSTED | Admin approves | Admin |
| FLAGGED | CANCELLED | Admin rejects (reason required) | Admin |
| FLAGGED | EXPIRED | `effective_deadline` passes while flagged | System |
| POSTED | MATCHED | ≥1 offer created | System |
| MATCHED | POSTED | No PENDING offers left and `remaining_servings > 0` | System |
| POSTED / MATCHED | ACCEPTED | `remaining_servings` becomes 0 | System (on accept) |
| POSTED / MATCHED | ACCEPTED | Deadline passes with ≥1 ACCEPTED allocation; leftover moved to `expired_servings` | System |
| POSTED / MATCHED | EXPIRED | Deadline passes with zero allocations | System |
| ACCEPTED | POSTED | An allocation is cancelled before collection, deadline not passed (servings return to `remaining_servings`) | System |
| ACCEPTED | COLLECTED | Every non-cancelled allocation is COLLECTED (or later) and no more servings are being matched | System |
| ACCEPTED | EXPIRED | Every allocation became NO_SHOW or CANCELLED after deadline | System |
| COLLECTED | COMPLETED | Every allocation is COMPLETED or NO_SHOW and ≥1 is COMPLETED | System |
| POSTED / MATCHED / ACCEPTED / FLAGGED | CANCELLED | Donor cancels (reason required), only if no allocation is COLLECTED | Donor |

Rules
- While some servings are allocated and some are still being matched, status stays POSTED or MATCHED. The UI shows "Partially accepted: X of Y servings".
- On CANCELLED: all PENDING offers → WITHDRAWN; all ACCEPTED allocations → CANCELLED (`cancelled_by = donor`); notify affected Receivers.
- On EXPIRED: all PENDING offers → WITHDRAWN.

### 5.2 Offer status

| From | To | Trigger |
|---|---|---|
| PENDING | ACCEPTED | Receiver accepts before `expires_at` (creates an allocation) |
| PENDING | DECLINED | Receiver declines (UI label "Rejected"); optional reason |
| PENDING | TIMED_OUT | `now() > expires_at` (job or lazy check) |
| PENDING | SUPERSEDED | Another acceptance made `remaining_servings = 0` |
| PENDING | WITHDRAWN | Donation cancelled, expired, or flagged by Admin action |

### 5.3 Allocation status

| From | To | Trigger | Actor |
|---|---|---|---|
| (new) | ACCEPTED | Offer accepted, or Admin manual assign | Receiver / Admin |
| ACCEPTED | COLLECTED | Donor enters the correct handover code | Donor |
| ACCEPTED | COLLECTED | Admin override (reason required) | Admin |
| ACCEPTED | CANCELLED | Receiver cancels before collection (reason required), or Donor cancels donation | Receiver / Donor |
| ACCEPTED | NO_SHOW | `effective_deadline + no_show_grace_minutes` passes, still not collected | System |
| COLLECTED | COMPLETED | Receiver confirms distribution | Receiver |
| COLLECTED | COMPLETED | 24 h after `collected_at` with no confirmation; set `completion_unconfirmed = true` | System |

Handover code: 4 random digits from `secrets.randbelow(10000)`, zero-padded, generated at acceptance, visible only to the Receiver. Donor has **5 attempts**; after that, entry is locked and Admin is notified (Admin can override).

---

## 6. Validation, safe deadline, auto-flags, priority

All in `backend/app/services/validation.py` and `priority.py`. Constants come from `app_config` (§16).

### 6.1 Hard validation (reject with 422, nothing saved)
| Field | Rule |
|---|---|
| `title` | 3–80 chars |
| `quantity_servings` | 1–1000 |
| `prepared_at` | not in the future (2 min tolerance); for non-packaged food not older than 24 h |
| `storage_condition = packaged_sealed` | `packaged_expiry_date` required and ≥ today (IST) |
| `donor_pickup_by` | ≥ now + 30 min and ≤ now + 48 h |
| `checklist` | all five keys present and `true` |
| `declaration_accepted` | must be `true` |
| `pickup_lat/lng` | inside India bounding box |
| `contact_phone` | 10-digit Indian mobile |
| Computed `effective_deadline` | must be ≥ now + `min_rescue_window_minutes` (30). Otherwise error: "This food is too close to its safe limit to be rescued safely." |
| Donor | `account_status = 'active'` |

### 6.2 Safe pickup deadline

```
window = PICKUP_WINDOW_HOURS[storage_condition]   (config key: safe_window_hours)
  hot_held:      6 h  from prepared_at
  room_temp:     6 h  from prepared_at   (also 6 h if ambient_above_32c = true)
  refrigerated: 12 h  from prepared_at
  packaged_sealed: (packaged_expiry_date at 23:59 IST) − 18 h   ← not based on prepared_at

safe_pickup_deadline = prepared_at + window
                       (for packaged_sealed: the expiry-based time above)
last_consumption_at  = safe_pickup_deadline + post_pickup_consume_hours (4)
                       (for packaged_sealed: expiry at 23:59 IST)
effective_deadline   = min(donor_pickup_by, safe_pickup_deadline)
```
Every item must stay edible for `post_pickup_consume_hours` after its pickup deadline. The UI shows `effective_deadline` as **"Pickup by"** and `last_consumption_at` as **"Last time of consumption"** (FSSAI label field). Admins edit all of these in Settings. These are conservative product defaults, not food-safety certification.

### 6.3 Auto-flag rules (saved as FLAGGED with `flag_reasons`)
| Code | Condition |
|---|---|
| `missing_photo` | `photo_paths` is empty |
| `large_quantity` | `quantity_servings` between 501 and 1000 |
| `unverified_large_donor` | Donor `is_verified = false` and `quantity_servings > 200` |
| `open_safety_report` | Donor has a `safety_reports` row with `status = 'open'` |
| `low_quality_donor` | Donor `quality_score < 0.4` |

A FLAGGED donation is not matched. Admin approves (→ POSTED, matching starts immediately with trigger `approved`) or rejects (→ CANCELLED). Admin is notified at creation. The Donor sees "Under review by FoodResQ team".

### 6.4 Priority

```
time_left_h  = (effective_deadline − now) in hours
urgency      = 1 − min(time_left_h / 6, 1)
quantity     = min(remaining_servings / 200, 1)
perishability: cooked_meal 1.0 · dairy 0.9 · sweets 0.7 · bakery 0.6 · raw_produce 0.5 · packaged 0.2

priority_score = 0.5·urgency + 0.3·quantity + 0.2·perishability
priority_level = HIGH if score ≥ 0.70, MEDIUM if ≥ 0.40, else LOW
```
Recomputed at every match run and stored on the donation.

---

## 7. Bridge matching engine

"Bridge" is the name of the FoodResQ decision engine. **v1 is deterministic and rule-based.** Code lives in `backend/app/services/matching/` as pure functions (no DB access inside scoring) so it can be unit-tested with fixtures.

§7.3 (hard filters) and §7.4 (factor measurements) are never delegated to anything external. Only the
final 0-100 score in §7.5 is switchable via `MATCHING_ENGINE` (README D14) to TypeSafe AI's Jev API
instead of Bridge's own weighted formula — experimental, untested against a live Jev account, and
falls back to Bridge per-candidate on any Jev error. Default and test-suite-assumed engine: `bridge`.

### 7.1 When matching runs
- Donation becomes POSTED (trigger `posted` or `approved`).
- An offer is DECLINED or TIMED_OUT and the donation has no other PENDING offers.
- An allocation is CANCELLED before collection.
- Scheduler tick: any POSTED donation with `remaining_servings > 0`, no PENDING offers, and deadline not passed (trigger `scheduler`).

Matching for one donation must hold a row lock (`SELECT ... FOR UPDATE` on the donation) so two runs never overlap.

### 7.2 Distance and ETA
```
haversine_km = great-circle distance(pickup, receiver)
distance_km  = round(haversine_km × road_factor(1.3), 1)
eta_minutes  = ceil(prep_buffer_minutes(15) + distance_km / avg_speed_kmph(20) × 60)
arrival_at   = now + eta_minutes
```

### 7.3 Stage 1 — hard filters (any failure excludes the Receiver; record the first failing code)
| Code | Receiver passes only if |
|---|---|
| `not_verified` | `users.account_status = 'active'` and `role = 'receiver'` and `verified_at IS NOT NULL` |
| `unavailable` | `is_available_now = true` |
| `closed_at_arrival` | operating hours (IST) include `arrival_at` |
| `diet_mismatch` | veg → any; egg → `veg_egg` or `all`; non_veg → `all` |
| `category_not_accepted` | `food_category ∈ accepted_categories` |
| `out_of_radius` | `distance_km ≤ min(service_radius_km, donation.search_radius_km)` |
| `cannot_arrive_in_time` | `arrival_at ≤ effective_deadline` |
| `no_capacity` | `capacity_available ≥ 1` where `capacity_available = max_capacity_servings − Σ servings of this Receiver's ACCEPTED (not yet collected) allocations` |
| `already_offered` | no existing offer for this donation and this Receiver |

### 7.4 Stage 2 — eight factors (each 0..1)

`remaining = donation.remaining_servings`

| Factor | Formula |
|---|---|
| **distance** | `max(0, 1 − distance_km / min(service_radius_km, search_radius_km))` |
| **capacity** | `min(capacity_available, remaining) / remaining` |
| **diet** | `1.0` if `diet_accepted` is the narrowest acceptance that fits (veg→`veg_only`, egg→`veg_egg`, non_veg→`all`), else `0.8` |
| **demand** | if `meals_needed_set_on` is today (IST): `min(meals_needed_remaining, remaining) / remaining` where `meals_needed_remaining = max(0, meals_needed_today − servings allocated to this Receiver today)`; otherwise `0.5` |
| **availability** | `1.0` if the Receiver stays open ≥ 60 min after `arrival_at`, else `0.5` |
| **feasibility** | `clamp((effective_deadline − arrival_at) / (effective_deadline − now), 0, 1)` |
| **reliability** | `receiver_profiles.reliability_score` (§13) |
| **urgency** | Donation-level. It does not score Receivers directly; it **switches the weight set** (below), giving more weight to distance and feasibility when food is about to expire |

### 7.5 Weights and final score

| Factor | Default weights (MEDIUM / LOW) | HIGH-priority weights |
|---|---|---|
| distance | 0.20 | 0.25 |
| capacity | 0.20 | 0.20 |
| feasibility | 0.15 | 0.20 |
| demand | 0.15 | 0.10 |
| reliability | 0.10 | 0.10 |
| diet | 0.10 | 0.05 |
| availability | 0.10 | 0.10 |
| **Sum** | **1.00** | **1.00** |

`match_score = round(100 × Σ weight × factor)` (integer 0–100). Ties broken by: higher feasibility, then shorter distance, then earlier `receiver_profiles.created_at`.

Weights live in `app_config` (`jev_weights_default`, `jev_weights_high`); Admin can edit them in Settings. The server rejects weight sets that do not sum to 1.00 (±0.001).

### 7.6 Explainability

Each match run stores every evaluated Receiver in `match_runs.candidates`:
```json
{"receiver_id":"…","org_name":"Receiver A","included":true,"exclusion_code":null,
 "distance_km":1.9,"eta_minutes":21,"capacity_available":150,
 "factors":{"distance":0.81,"capacity":1.0,"feasibility":0.82,"demand":1.0,"reliability":0.9,"diet":1.0,"availability":1.0},
 "match_score":91,"rank":1,"reasons":["Very close: 1.9 km (about 21 min)","Can take all 120 servings","Arrives well before the deadline"]}
```

**Reason generation** (max 3 positive reasons, plus warnings):
| Condition | Reason text |
|---|---|
| distance ≥ 0.7 | `Very close: {d} km (about {eta} min)` |
| 0.4 ≤ distance < 0.7 | `Nearby: {d} km (about {eta} min)` |
| capacity = 1.0 | `Can take all {remaining} servings` |
| capacity < 1.0 | **warning** `Partial fit: can take {n} of {remaining} servings` |
| demand ≥ 0.8 | `Needs {diet label} meals today` |
| reliability ≥ 0.85 | `Reliable: strong pickup record` |
| feasibility ≥ 0.7 | `Arrives well before the deadline` |
| feasibility < 0.3 | **warning** `Tight timing: arrives close to the deadline` |
Choose positives in the order of the factor's weighted contribution (`weight × factor`, largest first), maximum 3. Warnings are always added. If no positive reason qualifies, add exactly one: `Best available option nearby`.

Exclusion labels shown to Admin: `diet_mismatch` → "Different food requirement", `category_not_accepted` → "Does not accept this food type", `cannot_arrive_in_time` → "Cannot arrive before deadline", etc.

### 7.7 Offers and cascade

```
batch_size  = 2 if priority_level = HIGH else 1
take the top `batch_size` included candidates (not already offered)
offered_servings = min(capacity_available, remaining)
timeout_minutes  = clamp(floor(time_left_minutes × 0.10), 5, 15)
expires_at       = min(now + timeout_minutes, effective_deadline)
```
- Donation → MATCHED. Notify each Receiver (`OFFER_RECEIVED`).
- No included candidates → widen radius (§7.8).

### 7.8 Radius widening and no-match alert
- `search_radius_km` steps: **10 → 15 → 20** (max). When a run finds zero included candidates, set the next step and re-run immediately (trigger `radius_widened`).
- If still zero at 20 km: donation stays POSTED; the scheduler re-runs every tick (new Receivers may become available).
- Send `NO_MATCH_ALERT` to all Admins and the Donor **once** (set `no_match_alerted_at`) when either: zero candidates at 20 km, or `time_left < 30 min` with `remaining_servings > 0`.
- Admin can manually assign any verified, active Receiver via `POST /admin/donations/{id}/assign` (bypasses filters except `not_verified`; requires a note).

### 7.9 Accepting an offer (concurrency-safe)

One transaction in `offers_service.accept(offer_id, receiver_id)`:
```
BEGIN;
SELECT * FROM donations WHERE id = :d FOR UPDATE;
SELECT * FROM offers WHERE id = :o FOR UPDATE;
assert offer.receiver_id = current user
assert offer.status = 'PENDING' and now() <= offer.expires_at      else 409 OFFER_NOT_AVAILABLE
assert donation.status IN ('POSTED','MATCHED') and remaining > 0     else 409 DONATION_NOT_AVAILABLE
servings = min(offer.offered_servings, donation.remaining_servings, capacity_available(receiver))
assert servings ≥ 1                                                  else 409 NO_CAPACITY
INSERT allocation (status ACCEPTED, handover_code, eta_at = now + eta_minutes)
UPDATE offer → ACCEPTED, responded_at = now
donation.remaining_servings -= servings
IF remaining = 0:
    other PENDING offers of this donation → SUPERSEDED (notify OFFER_SUPERSEDED)
    donation → ACCEPTED
ELSE:
    other PENDING offers: offered_servings = min(their capacity, remaining)
    IF no PENDING offers left: donation → POSTED and run matching after commit
audit_log rows; notifications (OFFER_ACCEPTED to Donor)
COMMIT;
```
This implements the pitch rule **"Double acceptance → first confirm locks it."** The second Receiver receives 409 with message "Another Receiver has already taken this food."

### 7.10 Declining / timeout
- Decline: offer → DECLINED with optional `decline_reason` ∈ {`no_capacity`, `too_far`, `no_vehicle_now`, `food_type`, `other`} + optional text. If no PENDING offers remain → donation → POSTED → re-run matching (trigger `declined`).
- Timeout: same, with offer → TIMED_OUT and trigger `timed_out`; notify the Receiver `OFFER_TIMED_OUT`.

---

## 8. Notifications and realtime

### 8.1 Notification types (`notifications.type`)
| Type | Recipient | When |
|---|---|---|
| `VERIFICATION_RESULT` | Receiver | Admin verifies or rejects |
| `DONATION_FLAGGED` | Donor + all Admins | Donation created as FLAGGED |
| `DONATION_APPROVED` | Donor | Admin approves flagged donation |
| `DONATION_REJECTED` | Donor | Admin rejects flagged donation |
| `OFFER_RECEIVED` | Receiver | Offer created |
| `OFFER_SUPERSEDED` | Receiver | Offer superseded |
| `OFFER_TIMED_OUT` | Receiver | Offer timed out |
| `OFFER_ACCEPTED` | Donor | Receiver accepted (includes servings and ETA) |
| `OFFER_DECLINED` | Donor | Receiver declined (no reason shown to Donor) |
| `NO_MATCH_ALERT` | Donor + all Admins | §7.8 |
| `PICKUP_REMINDER` | Receiver | 30 min before `effective_deadline` if still ACCEPTED |
| `HANDOVER_LOCKED` | Admins | 5 wrong handover attempts |
| `COLLECTED` | Donor + Receiver | Allocation collected |
| `COMPLETED` | Donor | Receiver confirmed distribution |
| `FEEDBACK_REQUEST` | Donor + Receiver | Allocation completed |
| `ALLOCATION_CANCELLED` | the other party | Allocation cancelled |
| `DONATION_CANCELLED` | Receivers with pending offers/allocations | Donor cancelled |
| `DONATION_EXPIRED` | Donor | Donation expired |
| `NO_SHOW` | Donor + Receiver + Admins | Allocation marked NO_SHOW |
| `NEW_MESSAGE` | the other party | Chat message (max one notification per 2 min per allocation) |
| `SAFETY_REPORT` | Admins | Safety issue reported |
| `DISPUTE_OPENED` / `DISPUTE_RESOLVED` | Admins / both parties | Dispute lifecycle |

`link` points to the relevant frontend route (§9.3).

### 8.2 Realtime
Implemented via Supabase Realtime **Broadcast**, not `postgres_changes`/RLS: since there is no
Supabase Auth session in the browser (D6 — Google Sign-In, backend-verified, is the only login
method), the browser's Supabase client connects as the `anon` role, which the RLS policies in §4.4
don't apply to — `postgres_changes` would silently deliver nothing to it (and could falsely report
"connected" while turning off the polling fallback). Instead:
- `services/realtime.py` (service-role key, server-only) POSTs to
  `{SUPABASE_URL}/realtime/v1/api/broadcast` on a per-user channel (`user:{user_id}`) whenever
  `services/notifications.py.notify()` runs — which already covers every event in §8.1 — plus on
  every chat message (`services/messaging.py.send_message()`), so chat doesn't wait on the
  `NEW_MESSAGE` 2-minute throttle.
- The frontend (`lib/realtime.ts`) subscribes to its own `user:{myUserId}` channel. The payload
  carries nothing — on any event it just **invalidates every React Query cache and re-fetches from
  the API**; it never trusts the broadcast as the source of truth, so a missed or duplicate ping is
  harmless. Channel names are unguessable per-user UUIDs; no RLS/auth is applied to broadcast
  channels, so nothing sensitive is ever put in the payload itself.
- Fallback: poll every 15 s if the channel is disconnected.

---

## 9. Backend and frontend structure

### 9.1 Layering rules
`routers` (HTTP only, Pydantic in/out) → `services` (business rules, transactions, state transitions, notifications, audit) → `repositories` (SQLAlchemy queries). Routers never touch models directly for writes.

### 9.2 Backend tree
```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, routers, scheduler startup
│   ├── config.py                # pydantic-settings
│   ├── db.py                    # engine, session dependency
│   ├── auth.py                  # JWT verify, get_current_user, require_role, require_active
│   ├── models/                  # SQLAlchemy models (one file per table group)
│   ├── schemas/                 # Pydantic request/response models
│   ├── repositories/
│   ├── services/
│   │   ├── state.py             # transition tables + apply_transition()
│   │   ├── validation.py
│   │   ├── priority.py
│   │   ├── matching/
│   │   │   ├── geo.py           # haversine, eta
│   │   │   ├── filters.py       # stage 1
│   │   │   ├── scoring.py       # stage 2, weights
│   │   │   ├── reasons.py
│   │   │   └── engine.py        # run_matching(donation_id, trigger)
│   │   ├── offers.py
│   │   ├── allocations.py
│   │   ├── donations.py
│   │   ├── messaging.py
│   │   ├── feedback.py
│   │   ├── trust.py             # reliability + quality scores
│   │   ├── notifications.py
│   │   ├── records.py           # FSSAI record CSV
│   │   ├── impact.py
│   │   ├── admin.py
│   │   ├── uploads.py
│   │   ├── jobs.py              # tick()
│   │   └── assistant/           # Phase 6
│   ├── routers/                 # auth, donor, receiver, shared, admin, internal, assistant
│   └── utils/time.py            # now_utc(), to_ist()
├── alembic/
├── scripts/seed.py
├── tests/
├── requirements.txt
└── .env.example
```

### 9.3 Frontend tree and routes
```
frontend/src/
├── main.tsx, App.tsx, router.tsx
├── lib/ api.ts · supabase.ts · queryClient.ts · format.ts (IST, countdown)
├── types/ (generated or hand-written from backend schemas)
├── components/ ui/ (Button, Card, Badge, StatusBadge, Countdown, Modal, Toast, EmptyState)
│              map/ (PickupMap) · donation/ · offer/ · allocation/ · chat/ · feedback/ · assistant/
├── layouts/ PublicLayout · DonorLayout · ReceiverLayout · AdminLayout
└── pages/ (one folder per route below)
```

| Route | Page | Access |
|---|---|---|
| `/` | Landing + public impact counter | public |
| `/login`, `/signup` | Auth | public |
| `/onboarding` | Choose role + profile form | authenticated, not onboarded |
| `/pending` | "Verification pending / rejected" | receiver not active |
| `/donor` | Donor dashboard | donor |
| `/donor/donations/new` | Post donation | donor |
| `/donor/donations/:id` | Donation detail (timeline, allocations, handover entry) | donor (owner) |
| `/donor/history` | Past donations | donor |
| `/donor/impact` | Impact stats + record downloads | donor |
| `/receiver` | Incoming offers + active pickups | receiver (active) |
| `/receiver/offers/:id` | Offer detail | receiver (owner) |
| `/receiver/pickups/:allocationId` | Pickup page (map, code, chat, complete) | receiver (owner) |
| `/receiver/history` | Past allocations | receiver |
| `/receiver/profile` | Profile, capacity, hours, availability, needs today | receiver |
| `/allocations/:id/feedback` | Feedback form | donor or receiver of allocation |
| `/admin` | Overview | admin |
| `/admin/verifications` | Receiver verification queue | admin |
| `/admin/flags` | Flagged donations | admin |
| `/admin/safety` | Safety reports | admin |
| `/admin/disputes` | Disputes | admin |
| `/admin/live` | Live map of active rescues | admin |
| `/admin/analytics` | Metrics | admin |
| `/admin/settings` | Bridge weights + timing constants | admin |
| `/admin/donations/:id` | Donation detail with match runs | admin |
| `/notifications` | Notification centre | authenticated |
| `/settings` | Account settings | authenticated |

---

## 10. API reference

Base path `/api/v1`. JSON only. Auth header required unless marked public. Errors per §17.

### 10.1 Auth / account
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/me` | any authenticated | User, role, status, profile, `onboarded` flag |
| POST | `/onboarding` | authenticated, not onboarded | Create user + profile |
| PATCH | `/me` | any | Update name, phone |

### 10.2 Donor
| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | `/donor/profile` | Read / edit donor profile |
| POST | `/donations` | Create donation (validation, flags, priority, matching) |
| GET | `/donations?status=&page=` | My donations |
| GET | `/donations/{id}` | Detail incl. allocations, offers summary (no other Receivers' identities until accepted), timeline |
| POST | `/donations/{id}/cancel` | Body `{reason}` |
| POST | `/allocations/{id}/handover` | Body `{code}` → COLLECTED |
| GET | `/donations/{id}/record.csv` | FSSAI record for this donation |
| GET | `/impact/me` | Donor or Receiver stats |

### 10.3 Receiver
| Method | Path | Purpose |
|---|---|---|
| GET / PATCH | `/receiver/profile` | Read / edit (editing FSSAI no. or address resets verification to pending) |
| PATCH | `/receiver/availability` | `{is_available_now}` |
| PATCH | `/receiver/needs` | `{meals_needed_today}` (sets `meals_needed_set_on` = today IST) |
| GET | `/offers?status=PENDING` | My offers |
| GET | `/offers/{id}` | Offer detail (donation summary, score, reasons, map) |
| POST | `/offers/{id}/accept` | §7.9 |
| POST | `/offers/{id}/decline` | `{reason_code, note?}` |
| GET | `/allocations?status=` | My allocations |
| POST | `/allocations/{id}/cancel` | `{reason}` (before collection) |
| POST | `/allocations/{id}/complete` | `{servings_distributed, distribution_area}` |

### 10.4 Shared (Donor or Receiver of the allocation)
| Method | Path | Purpose |
|---|---|---|
| GET | `/allocations/{id}` | Detail; `handover_code` included **only for the Receiver** |
| GET / POST | `/allocations/{id}/messages` | Chat (POST allowed only while allocation ACCEPTED/COLLECTED, or COMPLETED < 24 h) |
| POST | `/allocations/{id}/feedback` | §13.3 |
| GET | `/allocations/{id}/feedback` | Visible feedback (blind rule) |
| POST | `/allocations/{id}/dispute` | `{reason, description}` |
| GET | `/notifications?unread=` | List |
| POST | `/notifications/read` | `{ids:[…]}` or `{all:true}` |
| POST | `/uploads/sign` | Signed upload URL |
| GET | `/impact/public` | **public**: total meals rescued, rescues completed, active Receivers |

### 10.5 Admin
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/overview` | Counters for dashboard |
| GET | `/admin/verifications` | Pending Receivers with doc signed URL |
| POST | `/admin/users/{id}/verify` | Receiver → active, set `verified_at/by` |
| POST | `/admin/users/{id}/reject` | `{reason}` → rejected |
| POST | `/admin/users/{id}/suspend` / `/reinstate` | `{reason}` |
| POST | `/admin/donors/{id}/badge` | Toggle `is_verified` |
| GET | `/admin/flags` | FLAGGED donations |
| POST | `/admin/donations/{id}/approve` | FLAGGED → POSTED |
| POST | `/admin/donations/{id}/reject` | `{reason}` FLAGGED → CANCELLED |
| POST | `/admin/donations/{id}/assign` | `{receiver_id, servings, note}` manual allocation |
| GET | `/admin/donations/{id}` | Full detail incl. all `match_runs` |
| POST | `/admin/allocations/{id}/override-collect` | `{reason}` |
| GET | `/admin/safety-reports` · POST `/admin/safety-reports/{id}/resolve` | `{status: resolved_valid|resolved_invalid, admin_notes}` |
| GET | `/admin/disputes` · POST `/admin/disputes/{id}/resolve` | `{resolution}` |
| GET | `/admin/live` | Active donations and allocations with coordinates |
| GET | `/admin/analytics?from=&to=` | §14.3 |
| GET | `/admin/audit-log?entity_id=` | Audit rows |
| GET / PUT | `/admin/config` | `app_config` keys in §16 |
| POST | `/admin/admins` | Create another Admin |

### 10.6 Internal and assistant
| Method | Path | Purpose |
|---|---|---|
| POST | `/internal/tick` | Header `X-Tick-Secret`; runs `jobs.tick()`; idempotent |
| GET | `/health` | public; `{status:"ok"}` (outside `/api/v1` also acceptable) |
| POST | `/assistant/chat` | Phase 6 — §11 |

---

## 11. AI assistant (Phase 6)

**Build only after Phases 1–5 pass.** Available to Donors and active Receivers. Not to Admins in the MVP.

### 11.1 Flow
Frontend chat panel → `POST /assistant/chat {conversation_id?, message}` → backend loads the last 20 messages of that conversation, calls the Google Gemini API with the system prompt and tools below, executes any tool calls **as the current user** (same services and permission checks), loops until a final text answer (max 4 tool rounds), stores messages, returns `{conversation_id, reply, draft?}`.

- Model id from `GEMINI_MODEL` env var. Never hard-code a model name.
- Rate limit: 20 user messages per user per hour; message length ≤ 1000 chars.
- If the API key is missing or the call fails, return a friendly fallback message; the rest of the app must keep working.

### 11.2 Tools (all read-only except `draft_donation`, which saves nothing)
| Tool | Role | Returns |
|---|---|---|
| `get_my_profile` | both | Profile summary |
| `list_my_donations(status?)` | donor | Recent donations with status, servings, deadline |
| `get_donation_status(donation_id)` | donor (owner) | Status, timeline, allocations, ETA |
| `get_match_explanation(donation_id)` | donor (owner) | Latest match run: top candidates' scores and reasons (Receiver names only for accepted ones) |
| `list_my_offers()` | receiver | Pending offers with score, reasons, deadline |
| `explain_offer(offer_id)` | receiver (owner) | Factor breakdown in plain language |
| `list_my_allocations(status?)` | receiver | Active and recent pickups |
| `get_help_article(topic)` | both | Text from `backend/app/services/assistant/help/*.md` (topics: posting, safety_checklist, flags, matching, handover, feedback, verification) |
| `draft_donation(text)` | donor | Parses free text into a **draft** of the donation form fields; returns `draft` JSON to the frontend, which opens `/donor/donations/new` prefilled. **Checklist and declaration are always returned unchecked.** |

### 11.3 System prompt (store in `assistant/prompt.py`)
```
You are the FoodResQ assistant for {role} "{org_name}". Today is {date_ist}, time {time_ist} IST.
You help users use the FoodResQ food-rescue app. Answer briefly and clearly. Reply in the user's language
(English, Hindi or Marathi).
You may only use the provided tools to read this user's own data, explain matches, explain how the app works,
and prepare a donation draft for the user to review.
You must never: submit or cancel a donation, accept or decline an offer, confirm a handover, mark the safety
checklist or declaration, or say whether any food is safe to eat. For safety questions, point to the
safety checklist help article and say the donor is responsible for following food-safety rules.
If you don't know something or a tool returns nothing, say so. Never invent statuses, numbers or names.
```

---

## 12. Background jobs

`jobs.tick()` runs every 60 s via APScheduler (if `SCHEDULER_ENABLED`) **and** whenever `POST /internal/tick` is called by an external cron (configure cron-job.org or similar to ping every minute; Render free instances sleep). Each step is idempotent and uses row locks. Order:

1. **Offer timeouts**: PENDING offers with `expires_at < now` → TIMED_OUT; re-run matching where needed.
2. **Pickup reminders**: ACCEPTED allocations with `effective_deadline − now ≤ 30 min` and no reminder sent (check notifications) → `PICKUP_REMINDER`.
3. **Expiry**: donations in POSTED/MATCHED/FLAGGED with `effective_deadline < now` → apply §5.1 rules (EXPIRED or ACCEPTED with leftover).
4. **No-shows**: ACCEPTED allocations with `effective_deadline + no_show_grace_minutes (15) < now` → NO_SHOW; recompute Receiver reliability; re-evaluate donation status.
5. **Re-match**: POSTED donations with remaining servings and no PENDING offers → run matching (trigger `scheduler`).
6. **No-match alerts**: §7.8.
7. **Auto-complete**: COLLECTED allocations with `collected_at < now − 24 h` → COMPLETED (`completion_unconfirmed = true`).
8. **Daily reset (first tick after 00:00 IST)**: nothing to delete; `meals_needed_today` is ignored automatically when `meals_needed_set_on` ≠ today.

**Lazy checks:** any API read of an offer, allocation or donation first applies steps 1, 3 and 4 to that single record, so state is correct even if the job is delayed.

---

## 13. Trust scores

### 13.1 Receiver reliability (0..1), recomputed on every offer response, collection, no-show, cancellation and donor feedback
```
offers_total     = offers with status in (ACCEPTED, DECLINED, TIMED_OUT)
acceptance_rate  = ACCEPTED / offers_total                    (0.7 if offers_total = 0)
allocs_total     = allocations with status in (COLLECTED, COMPLETED, NO_SHOW, CANCELLED by receiver)
on_time_rate     = collected with collected_at ≤ effective_deadline / allocs_total   (0.7 if 0)
rating_norm      = (avg donor_to_receiver overall_rating − 1) / 4                    (0.7 if none)
raw              = 0.35·acceptance_rate + 0.35·on_time_rate + 0.30·rating_norm
n                = allocs_total
reliability      = (raw·n + 0.7·5) / (n + 5)                  # Bayesian smoothing, prior 0.7
reliability      = max(0, reliability − 0.05 × no_shows_in_last_30_days)
```

### 13.2 Donor quality (0..1), recomputed on every receiver_to_donor feedback and safety report resolution
```
rating_norm  = (avg receiver_to_donor overall_rating − 1) / 4   (0.7 if none)
fresh_rate   = share of feedback with fresh_on_arrival = true    (0.7 if none)
raw          = 0.5·rating_norm + 0.5·fresh_rate
quality      = (raw·n + 0.7·5) / (n + 5)          n = number of receiver_to_donor feedbacks
quality      = max(0, quality − 0.2 × safety_reports resolved_valid in last 90 days)
```
**Auto-suspension:** 2 safety reports resolved as `resolved_valid` within 30 days → Donor `account_status = 'suspended'` and Admins notified.

### 13.3 Feedback rules
- Allowed only when the allocation is COMPLETED, by its Donor (`donor_to_receiver`) or Receiver (`receiver_to_donor`), within **24 h** of `completed_at`. One per direction.
- Donor form: `overall_rating` (1–5, required), `on_time`, `professional`, `proper_containers`, `comment`.
- Receiver form: `overall_rating`, `quantity_matched`, `fresh_on_arrival`, `properly_packed`, `safety_issue`, `comment`, `photo_path`.
- `safety_issue = true` requires a comment (≥ 10 chars) and creates a `safety_reports` row + `SAFETY_REPORT` notification. The donation status does **not** change.
- **Blind rule:** a party can see the other party's feedback only after submitting their own or after the 24 h window closes.
- Feedback is not editable after submission.

---

## 14. Records, impact and analytics

### 14.1 FSSAI Schedule-II record (CSV), one row per COMPLETED allocation
| Column | Source |
|---|---|
| donor_name_address | donor org_name + pickup_address |
| receiver_name_address | receiver org_name + address |
| donation_date | posted_at (IST date) |
| food_item | title |
| batch_no | batch_no or "N/A" |
| manufacturing_date | prepared_at (IST) |
| best_before_or_expiry | prepared_at + window, or packaged_expiry_date |
| quantity_donated | allocation.servings (servings) |
| temperature_c | temperature_c or "Not recorded" |
| quantity_distributed | servings_distributed or "Unconfirmed" |
| distribution_area | distribution_area or "Unconfirmed" |
| distribution_date | distributed_at (IST date) or "Unconfirmed" |

### 14.2 Impact (per user and public)
- **Meals rescued** = Σ `servings` of allocations with status COLLECTED or COMPLETED.
- **Successful rescues** = count of COMPLETED allocations.
- **Average time to acceptance** = mean(`allocation.accepted_at − donation.posted_at`) for offer-based allocations.
- Receivers additionally: pickups on time %, current reliability score.

### 14.3 Admin analytics (date range)
Meals rescued · successful rescues · donations posted · % fully matched (`remaining_servings = 0` before deadline) · expiry rate (EXPIRED / total) · average time to acceptance · offer acceptance rate · no-show count · good-condition rate (`fresh_on_arrival` true share) · active Donors / Receivers (activity in last 30 days) · meals rescued per day (line chart) · donations by food category (bar chart).

---

## 15. Security checklist
- Verify JWT on every request; load role from DB.
- Ownership enforced in services for every resource.
- Rate limits (simple in-memory per process is acceptable for MVP): auth-related endpoints 10/min/IP, donation create 10/hour/donor, handover 5 attempts per allocation, assistant 20/hour/user, messages 30/min/user.
- Pydantic validation on all input; DB CHECK constraints as second layer.
- Storage via signed URLs only; validate content type and size.
- No secrets in frontend; `.env` files git-ignored.
- CORS restricted to `CORS_ORIGINS`.
- Show phone numbers only to the two parties of an active allocation (and Admins).
- Escape all user text in the UI (React default); never use `dangerouslySetInnerHTML`.
- Audit log for all status changes and all Admin actions.

---

## 16. Configuration (`app_config`, seeded by migration)

| Key | Default |
|---|---|
| `jev_weights_default` | `{"distance":0.20,"capacity":0.20,"feasibility":0.15,"demand":0.15,"reliability":0.10,"diet":0.10,"availability":0.10}` |
| `jev_weights_high` | `{"distance":0.25,"capacity":0.20,"feasibility":0.20,"demand":0.10,"reliability":0.10,"diet":0.05,"availability":0.10}` |
| `road_factor` | `1.3` |
| `avg_speed_kmph` | `20` |
| `prep_buffer_minutes` | `15` |
| `search_radius_steps_km` | `[10, 15, 20]` |
| `safe_window_hours` | `{"hot_held":6,"room_temp":6,"room_temp_hot_ambient":6,"refrigerated":12}` |
| `packaged_expiry_buffer_hours` | `18` |
| `post_pickup_consume_hours` | `4` |
| `min_rescue_window_minutes` | `30` |
| `offer_timeout_min_max` | `[5, 15]` |
| `offer_timeout_fraction` | `0.10` |
| `high_priority_batch_size` | `2` |
| `no_show_grace_minutes` | `15` |
| `feedback_window_hours` | `24` |
| `auto_complete_hours` | `24` |
| `priority_thresholds` | `{"high":0.70,"medium":0.40}` |

Services read config through a cached accessor (refresh every 60 s or on Admin update).

---

## 17. Error format and conventions

```json
{"error": {"code": "OFFER_NOT_AVAILABLE", "message": "Another Receiver has already taken this food.", "details": {}}}
```
| HTTP | Use |
|---|---|
| 400 | Malformed request |
| 401 | Missing/invalid token |
| 403 | Wrong role, not active, not owner |
| 404 | Not found (also for resources the user may not see) |
| 409 | Invalid state transition / concurrency conflict (`INVALID_TRANSITION`, `OFFER_NOT_AVAILABLE`, `DONATION_NOT_AVAILABLE`, `NO_CAPACITY`, `HANDOVER_LOCKED`) |
| 422 | Validation failure (field-level `details`) |
| 429 | Rate limited |

Conventions: snake_case JSON; ISO 8601 UTC timestamps with `Z`; list endpoints return `{items, page, page_size, total}` (page_size default 20, max 100).

---

## 18. Deployment
- **Supabase:** create project; run Alembic against its connection string; create the three buckets; enable Realtime on `notifications`, `messages`, `donations`, `offers`, `allocations`; apply RLS policies (§4.4) in a migration.
- **Render:** Web Service, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; set env vars; health check `/health`.
- **External cron:** ping `POST {backend}/api/v1/internal/tick` every minute with `X-Tick-Secret`.
- **Vercel:** frontend root `frontend/`, build `npm run build`, output `dist`, SPA rewrite to `index.html`; set `VITE_*` vars.
- **CI (GitHub Actions):** ruff + pytest for backend; eslint + tsc + vitest for frontend on every push.

---

## 19. Testing strategy
- **Unit (pure):** geo/ETA, safe deadline per storage condition, priority, each hard filter, each factor, weights sum, reasons, timeout formula, reliability and quality formulas.
- **Golden demo test:** the seed scenario in WALKTHROUGH.md §3 must give Receiver A = **91**, Receiver B = **52**, Receiver C excluded with `category_not_accepted`, priority HIGH (0.719), timeout 11 min.
- **State machine:** every allowed transition succeeds, every other transition raises 409.
- **Concurrency:** two simultaneous accepts on offers for the same donation (threads + real Postgres) → exactly one allocation when capacity covers all servings.
- **API:** role and ownership checks for every endpoint (403/404).
- **Jobs:** tick idempotency (running twice changes nothing more).
- **Frontend:** form validation, status badge mapping, countdown, offer accept flow with mocked API.
