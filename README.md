# FoodResQ

> **Surplus food → the right Receiver → rescued in time.**
> Team **Bitebridge** · CURIOUSPARC 2026 · State Innovation Challenge
> Domain: Food Waste Reduction · Social Impact · AI Decision Support

FoodResQ is an end-to-end food-rescue platform. A **Donor** posts surplus edible food. The **JEV decision engine** ranks the best-fit verified **Receiver** (not just the nearest). The Receiver collects the food **directly from the Donor**. Every rescue is confirmed by both sides with a handover code, so impact is **measured, not estimated**.

This repository has three source-of-truth documents. Read all three before writing any code:

| File | What it answers |
|---|---|
| `README.md` (this file) | What we are building, scope, decisions, non-negotiable rules, setup |
| `ARCHITECTURE.md` | How it is built: stack, database schema, state machines, JEV formulas, API, security, jobs |
| `WALKTHROUGH.md` | How it behaves end to end: demo script with exact numbers, every screen, build phases with acceptance criteria, test checklist |

If these documents disagree with each other, **stop and ask the team**. Do not guess. If code disagrees with these documents, the documents win until the team updates them.

---

## 1. The problem

Surplus food is not wasted for lack of kindness. It is wasted for lack of fast, reliable coordination.

- India wastes about **78.1 million tonnes** of food per year (UNEP Food Waste Index Report 2024).
- About **194 million** people in India are undernourished (FAO SOFI 2024).
- **1.05 billion tonnes** of food were wasted worldwide in 2022 (UNEP 2024).
- **19%** of food available to consumers is wasted (UNEP 2024).

**The running example used everywhere in this project:** A college event ends at **8:30 PM** with **120 vegetarian meals** left. Without FoodResQ, someone has to search for a nearby NGO, call several organisations one by one, check whether food type and capacity fit, and arrange who collects and when. By **10:30 PM** the safe window closes and the food is wasted.

### Current gaps FoodResQ closes

1. Phone calls and group chats are slow and unstructured.
2. Listings show the nearest Receiver, not the best fit.
3. Safety details and deadlines are rarely captured.
4. There is no pickup confirmation, so impact is never measured.

---

## 2. The solution in one paragraph

A Donor fills **one form** (food, quantity, preparation time, storage, pickup deadline, location, safety checklist, photo). FoodResQ **validates** it, computes a **safe pickup deadline** and a **priority level**, then the **JEV engine** filters out Receivers who cannot take the food in time and scores the rest on **8 factors**. The top Receiver(s) get an **offer** with a match score and plain-language reasons. If they decline or do not respond in time, the offer **cascades** to the next-best Receiver. The accepting Receiver travels to the Donor, shows a **4-digit handover code**, and the Donor enters it to confirm collection. The Receiver then confirms distribution, both sides leave **feedback**, and the rescue is recorded as impact along with an **FSSAI-style surplus food record**.

### The seven-step workflow (from the pitch, slide 3)

| # | Step | What happens |
|---|---|---|
| 1 | **Post** | Donor adds food, quantity, deadline, location |
| 2 | **Validate** | Fields, timing and safety checklist are checked; risky posts are FLAGGED for Admin |
| 3 | **Prioritise** | Urgency × quantity × perishability gives HIGH / MEDIUM / LOW |
| 4 | **JEV Match** | Hard filters, then 8-factor weighted score; ranked Receivers with reasons |
| 5 | **Accept** | Receiver accepts; else next-best (timeouts and declines cascade automatically) |
| 6 | **Collect** | Receiver picks up from Donor; handover code confirms it |
| 7 | **Impact** | Receiver confirms distribution; feedback; impact and FSSAI record stored |

---

## 3. Roles (exactly three — final decision)

| Role | Who | Can do |
|---|---|---|
| **Donor** | Restaurants, hotels, colleges and hostels, caterers and event organisers, other food businesses | Post surplus, track status live, enter handover code, chat with matched Receiver, give feedback, view history and impact, download records |
| **Receiver** | NGOs, shelters, community organisations, food distributors | Maintain profile (capacity, diet, food categories, service area, hours, availability), receive and accept/decline offers, collect food, confirm distribution, chat, give feedback, view history |
| **Admin** | FoodResQ platform team | Verify Receivers (and optionally badge Donors), review FLAGGED donations, resolve safety reports and disputes, manually assign a Receiver, view live map and analytics, tune JEV weights |

Rules:

- **There is no volunteer role and no delivery role.** The Receiver always collects directly from the Donor.
- One account has exactly one role in the MVP. The role is chosen at signup and **cannot be changed by the user**.
- The database separates `users` from `donor_profiles` and `receiver_profiles` so that "one organisation with both roles" can be added later without a schema rewrite. **Do not build multi-role switching in the MVP.**
- Donors can post as soon as they finish onboarding. Receivers **cannot receive any offer until an Admin verifies them**.
- **Household donors are not supported in the MVP** (highest food-safety risk). The `donor_type` enum does not include `household`.
- Admin accounts are created only by the seed script or by another Admin, never through public signup.

---

## 4. Feature scope

### 4.1 MVP — must be built (in this order; see WALKTHROUGH.md §4 for phases)

**Accounts and trust**
- Email and password signup/login (Supabase Auth), role selection, role-specific onboarding profile.
- Receiver verification queue for Admin (FSSAI registration number required; optional NGO Darpan ID; verification document upload).
- Account statuses: active, pending_verification, rejected, suspended.

**Donation posting**
- One-page form with FSSAI label fields: food name, source (Donor org, auto), date and time of preparation, last time of consumption (computed), veg / egg / non-veg.
- Storage condition and safe-deadline computation (ARCHITECTURE.md §6.2).
- Five-item safety checklist and a mandatory declaration; photo upload (missing photo → FLAGGED).
- Server-side validation and auto-flag rules.
- Donor can cancel with a reason before collection.

**JEV matching**
- Priority scoring (HIGH / MEDIUM / LOW).
- Two-stage matching: hard filters, then 8-factor weighted score (0–100) with reasons.
- Explainability: every evaluated Receiver, including excluded ones with the exclusion reason, is stored in `match_runs`.
- Offers with timeout; HIGH priority sends 2 offers in parallel, others send 1.
- Cascade on decline or timeout; search radius widens 10 → 15 → 20 km; Admin alerted when nothing is found.
- **Split allocation**: if the best Receiver can take only part of the food, the rest is offered onward.
- Double acceptance protection: first confirmed acceptance locks the servings (database row lock).

**Collection and completion**
- Allocation page with map (OpenStreetMap + Leaflet), Donor contact, deadline countdown, FSSAI label card.
- 4-digit handover code shown to the Receiver; Donor enters it → COLLECTED.
- Receiver confirms distribution (servings distributed, area) → COMPLETED.
- No-show detection and reliability penalty.

**Communication**
- In-app notification centre (realtime).
- Per-allocation Donor ↔ Receiver chat (plain messaging, no AI), open from acceptance until 24 h after completion.

**Feedback and trust loop**
- Two-way feedback after COMPLETED (24 h window, blind until both submit or the window closes).
- Receiver can report a **safety issue** → creates a safety report for Admin.
- Reliability score (Receivers) and quality score (Donors) recomputed from history.

**Admin**
- Verification queue, flagged donations queue, safety reports, disputes, manual assignment, live map, analytics, audit log, JEV weight settings.

**Impact and records**
- Donor and Receiver history; impact stats (meals rescued, successful rescues, average time to acceptance).
- Public impact counter on the landing page.
- FSSAI Schedule-II style surplus food record per allocation, downloadable as CSV.

**AI assistant (last MVP phase — build only after everything above passes its acceptance criteria)**
- Chat panel for Donors and Receivers: how-to help, status lookup, match explanation, drafting a donation from plain text.
- Strict limits: read-only tools plus "draft" only. It **never** submits, accepts, declines, confirms handover, ticks the safety checklist, or judges whether food is safe. See ARCHITECTURE.md §11.

### 4.2 Phase 2 — after the MVP (do not build now)
- Email notifications (feature flag `EMAIL_NOTIFICATIONS_ENABLED`).
- Printable food label and impact certificate PDF for Donors (CSR reporting; no tax claims).
- Receiver "need posts" (publish demand before food exists).
- Recurring donations (for example, a restaurant posting every night at 10 PM).
- UI in Hindi and Marathi.

### 4.3 Phase 3+ / Future (roadmap only)
- WhatsApp / SMS alerts.
- Demand prediction for Receivers (ML), replacing the manual `meals_needed_today` field.
- AI-assisted image screening of food photos.
- Real road-network ETA (Maps API / OSRM) replacing the Haversine estimate.
- Multi-role organisations, multi-city deployment, household donors with extra checks.

### 4.4 Out of scope — never build these unless the team updates this file
- Volunteer, driver or delivery roles; route optimisation for fleets.
- Payments, selling food, discounted food marketplaces.
- Any claim of food-safety certification or guaranteed waste reduction.
- Tax-deduction calculations or 80G claims.
- Native mobile apps (the web app is mobile-first and responsive instead).

---

## 5. Decisions log

Items marked **Default** were chosen by the documentation author because the team had not decided yet. They are safe and buildable. If the team changes one, update **all three files** before building.

| # | Decision | Value | Status |
|---|---|---|---|
| D1 | Roles | Donor, Receiver, Admin (3 roles) | **Final** |
| D2 | Feedback after rescue | Two-way, MVP | **Final** |
| D3 | AI chat assistant | Yes, last MVP phase, limited tools | **Final** (phase placement is Default) |
| D4 | Donor ↔ Receiver chat | Plain per-allocation messaging, MVP | Default |
| D5 | What "JEV" means | Name of the FoodResQ decision engine. v1 is a deterministic, rule-based weighted-scoring model. **No machine learning in v1.** | Default (team to supply the expansion of the acronym) |
| D6 | Auth | Supabase Auth (email + password); FastAPI verifies the Supabase JWT | Default |
| D7 | Maps and distance | OpenStreetMap tiles + Leaflet (`react-leaflet`); Haversine × 1.3 road factor; assumed 20 km/h city speed | Default |
| D8 | Notifications | In-app realtime only in the MVP; email in Phase 2 | Default |
| D9 | Household donors | Not allowed in the MVP | Default |
| D10 | Business writes | All writes go through FastAPI. The frontend uses Supabase only for auth, file uploads via signed URL, and realtime subscriptions | Default |
| D11 | Background jobs | APScheduler inside FastAPI **plus** an idempotent `POST /internal/tick` endpoint pinged every minute by an external cron (Render free tier sleeps) | Default |
| D12 | Time | Store all timestamps in UTC (`timestamptz`); display in IST (`Asia/Kolkata`) | Default |
| D13 | Quantity unit | Everything is measured in **servings** (one serving = one meal for one person). Optional `quantity_kg` is informational only | Default |

---

## 6. Tech stack (summary — details in ARCHITECTURE.md)

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS, React Router, TanStack Query, react-leaflet, Supabase JS client |
| Backend | Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, psycopg 3, APScheduler |
| Database | PostgreSQL on Supabase |
| Auth | Supabase Auth |
| File storage | Supabase Storage (`donation-photos` public-read via signed URL, `verification-docs` private, `feedback-photos` private) |
| Realtime | Supabase Realtime (`notifications`, `messages`, `donations` changes) |
| AI assistant | Anthropic Claude API, called **only from the backend** |
| Hosting | Frontend on Vercel, backend on Render, database/auth/storage on Supabase (free or low-cost tiers) |
| Testing | pytest (backend), Vitest + React Testing Library (frontend) |

---

## 7. Repository layout

```
foodresq/
├── README.md
├── ARCHITECTURE.md
├── WALKTHROUGH.md
├── frontend/                 # React app (see ARCHITECTURE.md §9.3)
├── backend/                  # FastAPI app (see ARCHITECTURE.md §9.2)
└── .github/workflows/        # CI: lint + tests for both apps
```

---

## 8. Local setup

### Prerequisites
Node.js 20+, Python 3.11+, a free Supabase project, Git.

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # fill in values (see below)
alembic upgrade head             # create tables
python -m scripts.seed           # demo users and data (WALKTHROUGH.md §2)
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                      # http://localhost:5173
```

### Environment variables

**backend/.env**
```
DATABASE_URL=postgresql+psycopg://...        # Supabase connection string
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...                # server only, never sent to the browser
SUPABASE_JWT_SECRET=...                      # or use SUPABASE_JWKS_URL, depending on project settings
CORS_ORIGINS=http://localhost:5173
APP_TIMEZONE=Asia/Kolkata
SCHEDULER_ENABLED=true
INTERNAL_TICK_SECRET=change-me
ANTHROPIC_API_KEY=...                        # Phase 6 only
ANTHROPIC_MODEL=...                          # set to a current model id from Anthropic docs; never hard-code
EMAIL_NOTIFICATIONS_ENABLED=false
```

**frontend/.env.local**
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

---

## 9. Rules for AI coding agents (read before every task)

1. **Follow these three documents exactly.** Names of tables, columns, enums, statuses, endpoints and routes must match ARCHITECTURE.md character for character.
2. **Never invent features, roles, statuses, or endpoints.** If something seems missing, add a `TODO(team):` comment and ask; do not improvise.
3. **Three roles only.** No volunteer, driver, or delivery role. The Receiver collects directly.
4. **JEV v1 is rule-based.** Use the exact formulas and weights in ARCHITECTURE.md §7. Do not add ML libraries for matching.
5. **All status changes go through the service layer** in `backend/app/services/` using the transition tables in ARCHITECTURE.md §5. Never update a `status` column directly from a router.
6. **Every status change writes an `audit_log` row** and creates the notifications listed in ARCHITECTURE.md §8.
7. **Never trust the client** for role, ownership, prices of anything, scores, deadlines or status. The server computes them.
8. **Secrets stay on the server.** The service role key and Anthropic key must never appear in frontend code.
9. **Times:** store UTC, compute in UTC, display IST.
10. **Food safety wording:** the app supports a safer workflow; it never certifies food as safe. Use the copy in WALKTHROUGH.md §5.
11. **Build phase by phase** (WALKTHROUGH.md §4). Do not start a phase until the previous phase's acceptance criteria pass.
12. **Tests are required** for the matching engine, state transitions, and offer acceptance concurrency. The demo fixture must produce the exact numbers in WALKTHROUGH.md §3.
13. **Keep it simple:** no microservices, no message queues, no Redis in the MVP.

---

## 10. Success metrics (what the app must measure)

Meals rescued (collected servings) · Successful rescues (completed allocations) · Average time to acceptance · % of donations fully matched · Expiry rate · Active Donors and Receivers (posted or accepted in last 30 days) · % of rescues where food arrived in good condition (from feedback).

Aligned with **SDG 2 (Zero Hunger)** and **SDG 12.3 (halve per-capita food waste by 2030)**.

---

## 11. Regulatory basis

FoodResQ's data model follows the **Food Safety and Standards (Recovery and Distribution of Surplus Food) Regulations, 2019** (FSSAI):
- Section 6(3): prepared food label must show name of food, source, date of preparation, last date of consumption, and veg / non-veg.
- Schedule II: donor and distribution organisation keep records of donor, receiver, donation date, item, batch number, manufacturing date, expiry, quantity donated, temperature, quantity distributed, area and date of distribution.
- Schedule I: advance notice to the distribution organisation so food is consumed within its shelf life.
- Section 5: distribution organisations should be registered/licensed and have transport, storage and reheating facilities.

Safe-window defaults are based on the widely used 2-hour rule for perishable food at room temperature (1 hour above 32 °C). They are **conservative product defaults, not legal or food-safety advice**. The team should review them with a food-safety expert before a real pilot.

---

## 12. Team

| Member | Owns |
|---|---|
| Suhani | Product lead and pitch |
| Aaditi | Frontend (React + TypeScript) |
| Shreeya | Backend and database (FastAPI) |
| Radhakrishna | AI/ML (JEV matching engine, AI assistant) |

Contact: suhanimahalle11@gmail.com
