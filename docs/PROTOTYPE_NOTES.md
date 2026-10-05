# FoodResQ — Prototype notes

This file tracks the state of the prototype skeleton. The three source-of-truth documents
(`README.md`, `ARCHITECTURE.md`, `WALKTHROUGH.md`) are unchanged and still win over code.

## What is built

| Area | Status |
|---|---|
| Monorepo layout, CI (ruff + pytest on Postgres; eslint + tsc + vitest + build), Render + Vercel config | Done |
| Alembic `0001_initial` — every enum, table, CHECK, index and `app_config` default from ARCHITECTURE §4/§16 | Done, verified on PostgreSQL 16 |
| Alembic `0002_rls` — SELECT-only RLS policies + Realtime publication (auto-skipped on plain Postgres) | Done (runs only on Supabase) |
| Auth: Supabase JWT verify (HS256 secret or JWKS), role from DB, `require_role` / `require_active`, onboarding | Done |
| State machines (§5) as explicit tables in `services/state.py`; every change audited | Done + exhaustive tests |
| Validation, safe deadline, auto-flags, priority (§6) | Done + tests for every storage condition / flag |
| Bridge engine (§7): geo, hard filters, 8 factors, weights, reasons, match runs, offers, cascade, radius widening, no-match alert | Done — **golden test passes (A = 91, B = 52, C excluded, HIGH 0.719, timeout 11)** |
| Concurrency-safe accept (§7.9), split allocation, supersede | Done + threaded test on real Postgres |
| Handover code (5-attempt lock), Admin override, distribution, auto-complete, no-show, Receiver cancel + re-match | Done |
| Jobs: `tick()` (APScheduler 60 s + `POST /internal/tick`), lazy checks, idempotent | Done + test |
| Messaging, notifications, feedback (blind rule), safety reports, disputes, trust scores, auto-suspension | Done |
| FSSAI Schedule-II CSV, impact (user + public), Admin analytics | Done |
| Admin: overview, verifications, flags, manual assign, safety, disputes, live, analytics, audit log, config | Done |
| AI assistant (Phase 6): tool loop, 9 tools, system prompt, help articles, rate limit, graceful fallback | Done (needs API key) |
| Seed script (`--reset`, `--history`, `--demo-donation`) | Done |
| Frontend: every route in §9.3, design system from WALKTHROUGH §5.1 | See `frontend/` |

## Run it locally (no credentials needed)

```bash
# 1. Database: Docker…
docker compose up -d db
# …or any local PostgreSQL 13+; set DATABASE_URL accordingly.

# 2. Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DEV_AUTH_ENABLED=true for local demo logins
alembic upgrade head
python -m scripts.seed --history --demo-donation
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd ../frontend
npm install
cp .env.example .env.local      # leave VITE_SUPABASE_* empty (or VITE_DEV_AUTH=true) to get demo logins
npm run dev                     # http://localhost:5173
```

Demo accounts (WALKTHROUGH §2.1): `admin@foodresq.demo`, `college.a@foodresq.demo`,
`receiver.a|b|c@foodresq.demo`, `receiver.pending@foodresq.demo` — password `Demo@1234` once Supabase is connected.

Tests: `cd backend && pytest` (pure tests). Full suite incl. API flows:
`TEST_DATABASE_URL=postgresql+psycopg://…/foodresq_test pytest` (the schema is dropped and rebuilt).

## Credentials needed from the team (to finish wiring)

| Item | Where it goes |
|---|---|
| Supabase project URL | `backend/.env` `SUPABASE_URL`, `frontend/.env.local` `VITE_SUPABASE_URL` |
| Supabase anon key | `frontend/.env.local` `VITE_SUPABASE_ANON_KEY` |
| Supabase service role key | `backend/.env` `SUPABASE_SERVICE_ROLE_KEY` (server only) |
| Supabase JWT secret (or JWKS URL) | `backend/.env` `SUPABASE_JWT_SECRET` / `SUPABASE_JWKS_URL` |
| Supabase Postgres connection string | `backend/.env` `DATABASE_URL` (`postgresql+psycopg://…`) |
| Storage buckets `donation-photos`, `verification-docs`, `feedback-photos` (all private) | Supabase dashboard |
| Gemini API key + model id (Phase 6), from Google AI Studio | `backend/.env` `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `INTERNAL_TICK_SECRET` + external cron (cron-job.org) | Render env + cron config |
| Render + Vercel accounts | deployment (ARCHITECTURE §18) |

No Google Maps / Google Earth key is required: maps are OpenStreetMap + Leaflet and the
"Open in Google Maps" button is a plain coordinates link (WALKTHROUGH §5.7).

## Prototype-only additions (remove or disable before a pilot)

- `DEV_AUTH_ENABLED` + `POST /api/v1/dev/login`: mints a token for a seeded user without Supabase Auth. Default **off**.
- `docker-compose.yml`: local Postgres for development only.
- `GET /api/v1/admin/receivers`: verified Receiver list for the manual-assign picker (not in §10.5). `TODO(team)`.

## Open questions for the team (`TODO(team)`)

1. **WALKTHROUGH §3.5 lists Receiver C's ETA as 24 min**, but the §7.2 formula gives
   `ceil(15 + 3.1 / 20 × 60) = ceil(24.3) = 25`. C is excluded, so no score changes. The code follows the formula.
2. After a **partial accept** with no other pending offers, matching re-runs. §5.1 lists no dedicated
   `match_runs.trigger` for this, so `declined` is used. Suggest adding `partially_accepted`.
3. Admin manual assignment notifies both parties with `OFFER_ACCEPTED` (no dedicated type in §8.1).
4. `POST /admin/admins` creates the `users` row for an existing Supabase Auth user id; creating the Auth user itself via the Supabase admin API is a follow-up.
