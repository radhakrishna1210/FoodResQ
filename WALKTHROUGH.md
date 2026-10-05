# FoodResQ — Project Walkthrough

This document describes **how FoodResQ behaves**, screen by screen and step by step, and **the order to build it**. Every number in the demo scenario is computed from the formulas in `ARCHITECTURE.md` and must be reproduced exactly by the implementation. Read `README.md` (scope, rules) and `ARCHITECTURE.md` (schema, formulas, API) first.

Contents
1. How to use this document
2. Seed data
3. The golden demo: 120 veg meals at 8:30 PM
4. Build phases and acceptance criteria
5. UI specification (design system, every screen, copy)
6. Edge-case walkthroughs
7. Feedback walkthrough
8. AI assistant walkthrough (Phase 6)
9. Manual QA checklist and demo-day checklist
10. Glossary

---

## 1. How to use this document

- **Building:** follow §4 phase by phase. A phase is done only when all its acceptance criteria pass.
- **Testing:** §3 is the golden scenario. Encode it as an automated test (`tests/test_golden_demo.py`) and as the live demo.
- **UI work:** §5 defines every screen, what it shows, and the exact copy for safety-related text.
- **Unsure about behaviour?** §6 covers the edge cases. If a case is not covered anywhere, add `TODO(team):` and ask. Do not invent behaviour.

---

## 2. Seed data

`python -m scripts.seed` must create exactly these records (idempotent: re-running updates rather than duplicates). It also creates the Supabase Auth users with the listed passwords. All demo passwords: `Demo@1234`.

### 2.1 Users

| Email | Role | Status | Profile |
|---|---|---|---|
| `admin@foodresq.demo` | admin | active | — |
| `college.a@foodresq.demo` | donor | active | see 2.2 |
| `receiver.a@foodresq.demo` | receiver | active (verified) | see 2.3 |
| `receiver.b@foodresq.demo` | receiver | active (verified) | see 2.3 |
| `receiver.c@foodresq.demo` | receiver | active (verified) | see 2.3 |
| `receiver.pending@foodresq.demo` | receiver | pending_verification | Demo Pending NGO, used to show the verification queue |

### 2.2 Donor — College A
| Field | Value |
|---|---|
| org_name | College A (Demo) |
| donor_type | college_hostel |
| address | Bibwewadi, Pune |
| lat, lng | 18.4636, 73.8682 |
| is_verified | true |
| phone | 9000000001 |

### 2.3 Receivers

| Field | Receiver A | Receiver B | Receiver C |
|---|---|---|---|
| org_name | Receiver A (Demo NGO) | Receiver B (Demo Shelter) | Receiver C (Demo Community Pantry) |
| receiver_type | ngo | shelter | community_org |
| fssai_registration_no | 10012345000001 | 10012345000002 | 10012345000003 |
| lat, lng | 18.4760, 73.8720 | 18.4250, 73.8180 | 18.4830, 73.8590 |
| service_radius_km | 10 | 15 | 10 |
| max_capacity_servings | 150 | 50 | 100 |
| diet_accepted | veg_only | veg_only | all |
| accepted_categories | cooked_meal, bakery, sweets | cooked_meal, bakery | packaged, raw_produce |
| has_vehicle / storage / reheating | true / true / true | true / false / true | true / true / false |
| operating_hours | all days 00:00–24:00 | all days 00:00–24:00 | all days 00:00–24:00 |
| is_available_now | true | true | true |
| meals_needed_today | 150 (set_on = today) | 60 (set_on = today) | 100 (set_on = today) |
| reliability_score | 0.900 | 0.800 | 0.850 |
| phone | 9000000011 | 9000000012 | 9000000013 |

The seed sets `reliability_score` directly. Scores are recomputed only when real events happen (ARCHITECTURE §13), so values change after the demo is run. To reset, re-run the seed with `--reset` (deletes demo donations, offers, allocations and related rows, then restores profiles).

### 2.4 Optional history (`--history`)
Creates 5 past COMPLETED donations from College A to Receiver A and B (total 410 servings) dated over the previous 7 days, with feedback, so dashboards and the public counter are not empty. Do not use `--history` when running the golden test.

### 2.5 Demo donation helper (`--demo-donation`)
Creates the golden-demo donation **relative to the current time** so the numbers in §3 hold at any time of day:
- `prepared_at = now − 94 min`
- `donor_pickup_by = now + 116 min`
- `storage_condition = hot_held`, so `safe_pickup_deadline = prepared_at + 6 h = now + 266 min`; `donor_pickup_by` (now + 116 min) is earlier, so it still binds — `effective_deadline = now + 116 min`
For the live demo, prefer posting through the UI with these values (§3.2).

---

## 3. The golden demo: 120 veg meals at 8:30 PM

Times below assume the demo runs at the times in the pitch deck. The deck showed "Posted 8:32, Matched 8:34" and a "94%" score as illustrations. In the app, matching runs within seconds of posting, and the real formula gives Receiver A **91**. Update the deck to match the app, or say that deck numbers were illustrative.

### 3.1 Story
A college event ends at **8:30 PM**. The canteen has **120 vegetarian meals**, cooked at **7:00 PM** and kept hot in chafing dishes. The event coordinator posts them at **8:34 PM** and wants pickup by **10:30 PM**.

### 3.2 Step 1 — Post (Donor, `/donor/donations/new`)
College A logs in and fills the form:

| Field | Value |
|---|---|
| Food name | Veg pulao and dal (120 meals) |
| Category | Cooked meal |
| Diet | Veg |
| Servings | 120 |
| Prepared at | 7:00 PM today |
| Storage | Kept hot (hot_held) |
| Pickup by | 10:30 PM today |
| Pickup location | College A (prefilled from profile, adjustable on map) |
| Instructions | Main canteen, gate 2 |
| Contact phone | 9000000001 |
| Safety checklist | all 5 ticked |
| Declaration | ticked |
| Photo | 1 photo uploaded |

### 3.3 Step 2 — Validate (server)
- All hard rules pass (ARCHITECTURE §6.1).
- `safe_pickup_deadline` = 7:00 PM + 6 h = **1:00 AM**.
- `effective_deadline` = min(10:30 PM, 1:00 AM) = **10:30 PM**.
- "Last time of consumption" on the label = 1:00 AM + 4 h = **5:00 AM**.
- Auto-flags: none (photo present, 120 ≤ 200, Donor verified, no open reports) → status **POSTED**.

### 3.4 Step 3 — Prioritise
At 8:34 PM, time left = 116 min = 1.93 h.
- urgency = 1 − 1.93/6 = **0.678**
- quantity = 120/200 = **0.600**
- perishability (cooked_meal) = **1.0**
- priority_score = 0.5·0.678 + 0.3·0.600 + 0.2·1.0 = **0.719** → **HIGH**

### 3.5 Step 4 — Bridge Match
Search radius 10 km. HIGH priority → HIGH weight set, batch size 2.

| | Receiver A | Receiver B | Receiver C |
|---|---|---|---|
| Road distance | **1.9 km** | **8.9 km** | **3.1 km** |
| ETA | 21 min (arrive 8:55) | 42 min (arrive 9:16) | 24 min |
| Hard filters | pass | pass | **fail: `category_not_accepted`** (accepts only packaged and raw produce) |
| distance | 0.81 | 0.11 | — |
| capacity | 1.00 (150 ≥ 120) | 0.42 (50 of 120) | — |
| feasibility | 0.82 | 0.64 | — |
| demand | 1.00 | 0.50 | — |
| reliability | 0.90 | 0.80 | — |
| diet | 1.00 | 1.00 | — |
| availability | 1.00 | 1.00 | — |
| **Match score** | **91** — Rank 1, "Recommended" | **52** — Rank 2, "Partial fit" | Excluded — "Does not accept this food type" |

Computation notes (these follow ARCHITECTURE §7.2 rounding exactly): distance is rounded to 0.1 km before ETA; ETA = ceil(15 + km / 20 × 60), so A = ceil(20.7) = 21 min and B = ceil(41.7) = 42 min; feasibility A = (116 − 21) / 116 = 0.819, B = (116 − 42) / 116 = 0.638. Weighted sums: A = 90.63 → **91**, B = 51.84 → **52**. Factor values in the table are rounded to 2 decimals for display only.

**Reasons for Receiver A** (top 3 positives by weighted contribution: distance 0.203, capacity 0.200, feasibility 0.164):
"Very close: 1.9 km (about 21 min)", "Can take all 120 servings", "Arrives well before the deadline".

**Reasons for Receiver B:** no positive rule qualifies (distance 0.11 < 0.4, demand 0.5 < 0.8, reliability 0.80 < 0.85, feasibility 0.64 < 0.7), so it shows the fallback "Best available option nearby" plus the warning **"Partial fit: can take 50 of 120 servings"**.

This matches slide 4 of the pitch: A wins because it is close, has enough capacity, needs veg food and is available; C is closer than B but cannot take this food.

### 3.6 Offers
- Timeout = clamp(floor(116 × 0.10), 5, 15) = **11 min** → expires 8:45 PM.
- Offer to A: offered_servings = min(150, 120) = **120**.
- Offer to B: offered_servings = min(50, 120) = **50**.
- Donation → **MATCHED**. Both Receivers get `OFFER_RECEIVED`. The Donor sees "Offered to 2 Receivers. Waiting for acceptance."

### 3.7 Step 5 — Accept (Receiver A, 8:40 PM)
- Receiver A opens the offer card (score 91, reasons, map, countdown "Respond in 5 min") and taps **Accept**.
- Transaction (ARCHITECTURE §7.9): allocation created with 120 servings and a handover code (e.g. `4827`); remaining = 0.
- B's offer → **SUPERSEDED** (B sees "This food was taken by another Receiver").
- Donation → **ACCEPTED**. Donor gets `OFFER_ACCEPTED`: "Receiver A (Demo NGO) accepted 120 servings. ETA about 9:01 PM."
- Chat opens between College A and Receiver A.

### 3.8 Step 6 — Collect (9:15 PM)
- Receiver A arrives and shows the code **4827** on the pickup page.
- The Donor enters 4827 on the donation detail page → allocation **COLLECTED**, donation **COLLECTED**.
- Both get `COLLECTED`. Meals rescued counters increase by 120 immediately.

### 3.9 Step 7 — Impact (9:20 PM)
- Receiver A taps **Confirm distribution**: servings distributed 120, area "Shelter, Market Yard".
- Allocation → **COMPLETED**, donation → **COMPLETED**.
- Both get `FEEDBACK_REQUEST`. The FSSAI record row becomes available on `/donor/donations/:id` → "Download record (CSV)".
- Status timeline shown: POSTED 8:34 → MATCHED 8:34 → ACCEPTED 8:40 → COLLECTED 9:15 → COMPLETED 9:20.

### 3.10 Feedback
- Receiver A rates College A: 5 stars, quantity matched ✓, fresh on arrival ✓, properly packed ✓.
- College A rates Receiver A: 5 stars, on time ✓, professional ✓, proper containers ✓.
- After both submit, each can see the other's rating. Trust scores recompute.

---

## 4. Build phases and acceptance criteria

Build strictly in order. Each phase ends with tests passing and a short manual check.

### Phase 0 — Project setup
Tasks: monorepo layout (README §7), Vite + React + TS + Tailwind, FastAPI skeleton, Alembic, `.env.example` files, Supabase project, CI workflow, `/health` endpoint, typed API client, layouts and router with placeholder pages.
Acceptance:
- [ ] `npm run dev` and `uvicorn` both start; frontend calls `/health` and shows "API connected".
- [ ] CI runs lint and tests (with a trivial test each) and passes.
- [ ] Migration `0001_initial` creates every table, enum, index and `app_config` default from ARCHITECTURE §4 and §16.

### Phase 1 — Accounts, roles, profiles, verification
Tasks: Supabase Auth signup/login, `GET /me`, `POST /onboarding`, role-based route guards, Donor and Receiver profile forms (map pin picker), verification document upload, `/pending` page, Admin verification queue with verify/reject, suspend/reinstate, seed script (§2.1–2.3), audit log.
Acceptance:
- [ ] A new user can sign up, choose Donor or Receiver, complete the profile, and land on the right dashboard.
- [ ] A new Receiver sees `/pending` and cannot call offer endpoints (403).
- [ ] Admin verifies the Receiver → Receiver gets `VERIFICATION_RESULT` and can reach `/receiver`.
- [ ] Choosing `admin` at onboarding returns 403. Donor cannot open `/receiver` or `/admin` routes (frontend redirects; API returns 403).
- [ ] Editing a Receiver's FSSAI number resets them to pending.

### Phase 2 — Donation posting
Tasks: post form (§5.4), signed photo upload, validation (ARCHITECTURE §6.1), safe deadline (§6.2), auto-flags (§6.3), priority (§6.4), Donor dashboard and detail page with timeline, Donor cancel, Admin flags queue with approve/reject.
Acceptance:
- [ ] Posting the §3.2 values stores `effective_deadline` = prepared_at + 3.5 h and priority HIGH (0.719 at 116 min left).
- [ ] `room_temp` with `ambient_above_32c = true`, prepared 40 min ago → rejected ("too close to its safe limit").
- [ ] Missing photo → FLAGGED with reason `missing_photo`; Admin approve → POSTED; reject → CANCELLED with notification.
- [ ] Unticked checklist item → 422 with field error.
- [ ] Unit tests cover every storage condition and every flag rule.

### Phase 3 — Bridge matching and offers
Tasks: `matching/` package (geo, filters, scoring, reasons, engine), match runs storage, offers with timeout and batch size, cascade on decline/timeout, radius widening, no-match alerts, `jobs.tick()` with APScheduler and `/internal/tick`, lazy checks, Receiver offers list and offer detail with Accept/Decline, Admin donation detail showing all match runs and exclusion reasons, Admin settings for weights.
Acceptance:
- [ ] **Golden test passes:** A = 91, B = 52, C excluded `category_not_accepted`, timeout 11 min, both A and B receive offers (A 120, B 50).
- [ ] Declining all offers triggers a new match run; once no candidates remain, radius widens 10 → 15 → 20.
- [ ] With no candidates at 20 km, Donor and Admins get exactly one `NO_MATCH_ALERT`.
- [ ] An offer past `expires_at` becomes TIMED_OUT via tick and via lazy check on read.
- [ ] Admin cannot save weights that do not sum to 1.00.
- [ ] `tick()` run twice in a row produces no extra changes.

### Phase 4 — Accept, collect, complete, messaging, notifications
Tasks: concurrency-safe accept (ARCHITECTURE §7.9), split allocation, allocation pages for Donor and Receiver, handover code entry with 5-attempt lock, Admin override, distribution confirmation, auto-complete, Receiver cancel and re-match, no-show detection, per-allocation chat, notification centre with realtime + polling fallback, pickup reminders.
Acceptance:
- [ ] Golden flow §3.7–3.9 works end to end in the browser with realtime updates on both screens.
- [ ] Concurrency test: two simultaneous accepts → one allocation of 120; the other gets 409 `OFFER_NOT_AVAILABLE` or offer SUPERSEDED.
- [ ] If B accepts first: B gets 50, remaining 70, A's offer updates to 70 servings; A accepts → donation ACCEPTED with two allocations.
- [ ] Wrong code 5 times → `HANDOVER_LOCKED`, Admins notified, Admin override works.
- [ ] Allocation not collected by deadline + 15 min → NO_SHOW, Receiver reliability drops, donation status re-evaluated.
- [ ] Chat works only for the two parties and closes 24 h after completion.

### Phase 5 — Feedback, trust, safety, disputes, records, impact, admin analytics
Tasks: feedback forms and blind rule, safety reports, disputes, trust score recomputation, Donor auto-suspension rule, FSSAI CSV, impact pages, public counter, Admin analytics with two charts, live map, audit log viewer.
Acceptance:
- [ ] Feedback only allowed within 24 h of completion, once per direction; blind rule enforced by the API (not just the UI).
- [ ] `safety_issue = true` creates a safety report; donation status unchanged; Admin can resolve.
- [ ] Two valid safety reports in 30 days suspend the Donor.
- [ ] CSV contains every Schedule-II column (ARCHITECTURE §14.1) with correct IST dates.
- [ ] Analytics numbers match a hand-calculated fixture.

### Phase 6 — AI assistant
Tasks: backend `/assistant/chat` with tools and system prompt (ARCHITECTURE §11), rate limit, conversation storage, frontend floating chat panel, draft-to-form handoff, help articles.
Acceptance:
- [ ] "Why was Receiver A recommended?" returns the stored reasons accurately.
- [ ] "Post my 120 veg meals" returns a draft and opens the prefilled form with the checklist and declaration **unticked**; nothing is saved until the Donor submits.
- [ ] "Accept this offer for me" → assistant refuses and explains how to accept manually.
- [ ] "Is this food still safe?" → assistant does not judge; points to the safety checklist help article.
- [ ] A user cannot read another user's data through the assistant (test with crafted ids).
- [ ] With `GEMINI_API_KEY` unset, the panel shows "Assistant is unavailable right now" and nothing else breaks.

### Phase 7 — Polish and deploy
Tasks: mobile layouts (360 px), loading/empty/error states for every page, accessibility pass, deploy to Vercel + Render + Supabase, external cron, demo rehearsal with `--reset`.
Acceptance:
- [ ] Lighthouse accessibility ≥ 90 on landing, Donor dashboard, offer page.
- [ ] Full golden demo runs on the deployed URLs from two phones (Donor and Receiver) in under 5 minutes.
- [ ] Deck slide 5 "Current Status" and demo link/QR updated.

---

## 5. UI specification

### 5.1 Design system

**Colours** (from the pitch deck)
| Token | Hex | Use |
|---|---|---|
| `primary` | `#1B70BE` | Primary buttons, Donor accents, links |
| `teal` | `#27B5C9` | Receiver accents, MATCHED |
| `purple` | `#715BB0` | Admin accents, COLLECTED |
| `gold` | `#B8860B` | Warnings, FLAGGED, MEDIUM priority |
| `red` | `#D9534F` | Errors, HIGH priority, EXPIRED countdown < 15 min |
| `green` | `#2E9E6B` | Success, COMPLETED |
| `slate` | `#657385` | Secondary text, POSTED, LOW priority |
| Background | `#F7F9FC`; cards white with 1 px `#E3E8EF` border, 12 px radius |

**Status badge colours** (same everywhere)
POSTED slate · MATCHED teal · ACCEPTED primary · COLLECTED purple · COMPLETED green · EXPIRED dark grey `#4A5160` · CANCELLED light grey `#9AA3AF` · FLAGGED gold. Offer labels: PENDING teal "Awaiting response", ACCEPTED green, DECLINED grey "Rejected", TIMED_OUT grey "No response", SUPERSEDED grey "Taken by another Receiver", WITHDRAWN grey "Withdrawn".

**Typography:** headings Poppins (600), body Inter (400/500), fallback system sans. Base size 16 px.
**Icons:** lucide-react (Utensils = Donor, HandHeart = Receiver, ShieldCheck = Admin, Brain = Bridge, Clock = deadline).
**Countdown component:** shows "1 h 56 m left"; turns gold under 45 min, red under 15 min, "Deadline passed" when over. Used on every active donation, offer and pickup card.
**Mobile-first:** single column under 768 px; bottom navigation bar for Donor and Receiver on mobile; sidebar on desktop.
**Language:** plain, short, friendly. Never "Error 409": show the error `message` from the API.

### 5.2 Public pages
- **Landing `/`:** hero line "Surplus food → the right Receiver → rescued in time.", three-step illustration (Donor posts → Bridge matches → Receiver collects), live counters from `/impact/public` (meals rescued, rescues completed, verified Receivers), buttons "I have surplus food" (signup as Donor) and "We collect food" (signup as Receiver), SDG 2 and 12.3 badges, footer with team and partners.
- **Login / Signup:** email, password; signup also has full name and phone. After signup → `/onboarding`.
- **Onboarding:** step 1 choose role (two big cards: Donor / Receiver). Step 2 profile form:
  - Donor: org name, type, optional FSSAI licence no., address + map pin.
  - Receiver: org name, type, FSSAI registration no. (required), NGO Darpan ID (optional), address + map pin, service radius slider (1–20 km), max servings per pickup, diet accepted, food categories (multi-select chips), vehicle/storage/reheating toggles, operating hours editor, verification document upload.
- **Pending `/pending`:** "Thanks! The FoodResQ team is verifying your organisation. You'll be notified when you can start receiving food." If rejected: show reason and an "Edit profile and resubmit" button.

### 5.3 Donor dashboard `/donor`
- Top: "Post surplus food" primary button.
- **Active donations** cards: title, servings, status badge, priority badge, countdown to "Pickup by", progress line (e.g. "Accepted 100 of 120"), matched Receiver name (after acceptance), button "Open".
- **Impact summary** strip: meals rescued, successful rescues, average time to acceptance.
- Empty state: "No active donations. When you have surplus food, post it here. It takes about a minute."

### 5.4 Post donation `/donor/donations/new`
One page, three sections:
1. **Food:** food name, category, diet (Veg / Egg / Non-veg with green, yellow, red dots), servings, optional kg, allergens, description.
2. **Timing and storage:** prepared at (datetime), storage (Kept hot / Room temperature / Refrigerated / Sealed packaged), "Is it above 32 °C where the food is kept?" (shown for room temperature, default Yes), packaged expiry date (packaged only), pickup by (datetime). Live preview box: **"Pickup by: 10:30 PM · Last time of consumption: 5:00 AM"** computed with the same rules as the server (server remains the authority).
3. **Pickup and safety:** address/map pin (prefilled), instructions, contact phone, photo upload (recommended; note "Posts without a photo need a quick review before matching"), the 5-item checklist, and the declaration.

**Checklist copy (exact):**
- "Food was prepared and handled hygienically."
- "Food was not served from customers' plates."
- "Food is in clean, covered containers."
- "Food is kept separate from waste."
- "Food shows no signs of spoilage (smell, colour, texture)."

**Declaration copy (exact):** "I confirm the information above is accurate and that this food is surplus that was not served to anyone. I understand FoodResQ helps coordinate the rescue but does not inspect or certify food. The donor is responsible for following food-safety rules."

Submit button: "Post and find a Receiver". On success → donation detail page.

### 5.5 Donation detail `/donor/donations/:id`
- Header: title, status badge, priority badge, countdown.
- **FSSAI label card:** food name, source (org), prepared at, last time of consumption, Veg/Egg/Non-veg.
- **Timeline:** each status with IST time.
- **Matching panel:** before acceptance: "Finding the best Receiver…" / "Offered to N Receivers. Waiting for acceptance." / "Under review by FoodResQ team" (FLAGGED). Donors do not see the names of Receivers who have not accepted.
- **Allocations list:** per allocation: Receiver name, servings, ETA, status, phone (call button), chat button, **"Enter handover code"** input (4 digits) while ACCEPTED, feedback button after COMPLETED.
- Actions: Cancel donation (reason required; disabled once anything is collected), Download record (after completion), Raise dispute (per allocation).

### 5.6 Receiver dashboard `/receiver`
- Availability toggle at the top: "Available now" (on/off), and "Meals we need today" number input.
- **Incoming offers** (most urgent first). **Offer card:** priority badge, food name, servings offered, diet dot, category, Donor name and distance/ETA, "Pickup by" countdown, **match score as a large percentage**, up to 3 reasons and any warning, response countdown ("Respond in 7 min"), buttons **Accept** and **Decline**. Decline opens a reason picker.
- **Active pickups:** cards linking to the pickup page.
- Empty state: "No offers right now. Keep 'Available now' on to receive food offers near you."

### 5.7 Pickup page `/receiver/pickups/:allocationId`
- Map with pickup pin and the Receiver's location pin; button "Open in Google Maps" (link with coordinates; no API key needed).
- Donor name, address, instructions, phone (call button), servings, countdown.
- **Handover code** displayed large: "Show this code to the donor: 4 8 2 7".
- FSSAI label card.
- Chat panel.
- Buttons: "Cancel pickup" (reason required, before collection; warns "Cancelling affects your reliability score"), after collection **"Confirm distribution"** (servings distributed, area).

### 5.8 Feedback `/allocations/:id/feedback`
Star rating plus the role-specific yes/no questions (ARCHITECTURE §13.3), comment, and for Receivers: "Report a food-safety issue" toggle that reveals a required description and optional photo. Note text: "Your feedback is shared after both sides submit, or after 24 hours."

### 5.9 Admin pages
- **Overview `/admin`:** counters (pending verifications, flagged donations, open safety reports, open disputes, active rescues, meals rescued today), plus recent `NO_MATCH_ALERT`s with "Assign manually".
- **Verifications:** table with org, type, FSSAI no., Darpan ID, document link, map location; Verify / Reject (reason).
- **Flags:** flagged donation cards with reasons, photo, countdown; Approve / Reject.
- **Donation detail `/admin/donations/:id`:** everything the Donor sees plus every match run: radius, weights, and a table of all candidates (included and excluded) with factor scores, final score, and exclusion label. Manual assign form.
- **Safety reports / Disputes:** list → detail → resolve.
- **Live map:** active donations (gold pins) and active pickups (teal pins) with countdowns.
- **Analytics:** metric cards (ARCHITECTURE §14.3), line chart of meals rescued per day, bar chart by food category, date range picker.
- **Settings:** Bridge weights (two sets, live "sum = 1.00" check), timing constants from `app_config`.

### 5.10 Shared UI
- Notification bell with unread count; `/notifications` list with "Mark all read".
- Toasts for realtime events.
- AI assistant (Phase 6): floating button bottom-right "Ask FoodResQ", side panel with chat, suggested prompts: Donor — "Where is my donation?", "Why this Receiver?", "Help me post food"; Receiver — "Explain this offer", "What should I do at pickup?".

---

## 6. Edge-case walkthroughs

**6.1 Receiver rejects (declines).** A declines at 8:38 with reason `no_vehicle_now`. B's offer is still PENDING, so no new run yet. If B also declines, no PENDING offers remain → donation → POSTED → match run with trigger `declined` → next candidates (none in seed) → radius widens to 15, then 20 → `NO_MATCH_ALERT` to Donor and Admins.

**6.2 Nobody responds.** Both offers expire at 8:45 → TIMED_OUT (each Receiver gets `OFFER_TIMED_OUT`) → re-match as in 6.1. Timed-out offers lower acceptance rate.

**6.3 Double acceptance.** A and B tap Accept within the same second. The row lock serialises them. If A is first: A gets 120, B's offer becomes SUPERSEDED and B's request returns 409 "Another Receiver has already taken this food." If B is first: B gets 50 (its capacity), A's offer updates to 70, A then gets 70. Both cases are correct.

**6.4 Partial fit only.** Only B is available (A unavailable). B is offered 50; B accepts → remaining 70 → status back to POSTED → matching continues for 70 servings → if nothing found, at deadline the 70 become `expired_servings` and the donation goes to ACCEPTED (because B holds an allocation).

**6.5 Deadline passes before acceptance.** At 10:30 PM with zero allocations → donation EXPIRED; pending offers WITHDRAWN; Donor gets `DONATION_EXPIRED` with copy: "This donation expired before a Receiver could collect it. Thank you for trying. Posting earlier gives Receivers more time."

**6.6 Receiver no-show.** A accepted but has not collected by 10:45 PM (deadline + 15 min grace) → allocation NO_SHOW, reliability −0.05 penalty, Donor and Admins notified → donation EXPIRED (nothing collected). Donor can raise a `no_show` dispute.

**6.7 Receiver cancels after accepting.** A cancels at 8:50 ("vehicle broke down") → allocation CANCELLED, 120 servings return to `remaining_servings`, donation → POSTED, re-match (B was SUPERSEDED earlier and is excluded by `already_offered`, so the engine looks for others) → Donor notified `ALLOCATION_CANCELLED`.

**6.8 Donor cancels.** Before collection only, with a reason → pending offers WITHDRAWN, allocations CANCELLED, Receivers notified `DONATION_CANCELLED`.

**6.9 Missing safety info.** Posted without photo → FLAGGED (`missing_photo`); Donor sees "Under review". Admin approves at 8:40 → POSTED → matching starts with the time left at 8:40. If no Admin acts before the deadline → EXPIRED.

**6.10 Wrong handover code.** Donor enters wrong code → "Code doesn't match. 4 attempts left." After 5 → locked, `HANDOVER_LOCKED` to Admins; Admin can override with a reason after calling both parties.

**6.11 Receiver closed or out of radius.** Excluded at Stage 1 with `closed_at_arrival` / `out_of_radius`; visible to Admin on the match run, not to the Donor.

**6.12 Receiver edits capacity while holding an allocation.** `capacity_available` subtracts held servings, so new offers respect the reduced capacity; existing allocations are not changed.

**6.13 Suspended user.** Suspended Donor cannot post (403 with message "Your account is suspended. Contact FoodResQ."). Suspended Receiver is excluded at Stage 1 and existing PENDING offers are WITHDRAWN.

**6.14 Realtime disconnected.** UI shows a small "Reconnecting…" pill and polls every 15 s until the channel recovers.

---

## 7. Feedback walkthrough

1. Allocation COMPLETED at 9:20 PM → both parties get `FEEDBACK_REQUEST` linking to `/allocations/:id/feedback`.
2. Receiver submits at 9:30 PM. Receiver cannot yet see the Donor's feedback (none exists). Donor still sees "Waiting for your feedback".
3. Donor submits at 9:40 PM → both feedbacks visible to both. Trust scores recompute: Receiver A reliability, College A quality.
4. If the Donor never submits, at 9:20 PM next day the window closes; Receiver's feedback becomes visible to the Donor; no further submissions.
5. Safety path: Receiver marks "food-safety issue" with description "Dal smelled sour on arrival" → `safety_reports` row (open), Admins notified, Donor's next posts auto-flag `open_safety_report` until Admin resolves. Admin resolves `resolved_valid` → Donor quality −0.2; a second valid report within 30 days → Donor suspended.

---

## 8. AI assistant walkthrough (Phase 6)

**Donor, during the golden demo:**
- User: "Why did you pick Receiver A?" → tool `get_match_explanation` → "Receiver A scored 91 out of 100. It's 1.9 km away (about 21 minutes), can take all 120 servings, and needs veg meals today. Receiver B could take only 50 servings, and Receiver C doesn't accept cooked meals."
- User: "Where is my food now?" → `get_donation_status` → "Receiver A accepted 120 servings at 8:40 PM. Expected arrival is about 9:01 PM."

**Donor, drafting:**
- User: "We have 80 egg biryani plates left at the hostel mess, made at 8, need them gone by 11" → `draft_donation` → reply "I've prepared a draft. Please review it, tick the safety checklist, and post." + draft JSON {title "Egg biryani (80 plates)", category cooked_meal, diet egg, servings 80, prepared_at 8:00 PM, donor_pickup_by 11:00 PM, storage left empty for the user}. The form opens prefilled. Storage condition and checklist must be chosen by the user.

**Receiver:**
- User: "Explain this offer" → `explain_offer` → plain-language breakdown of factors.
- User: "Accept it for me" → "I can't accept offers for you. Tap the green Accept button on the offer card to accept it."

**Safety question:**
- User: "The rice was made 5 hours ago, is it okay to donate?" → no judgement: "I can't judge whether food is safe. FoodResQ's posting form uses conservative time limits, and the donor is responsible for food-safety rules. Here's what the safety checklist covers: …"

---

## 9. Manual QA checklist and demo-day checklist

### 9.1 Manual QA (run before every demo)
- [ ] Signup and onboarding for both roles on a phone screen.
- [ ] Pending Receiver blocked; Admin verify unblocks.
- [ ] Golden flow end to end on two devices with realtime updates.
- [ ] Decline, timeout, double accept, partial fit, no-show, cancel flows (§6).
- [ ] Flagged donation approve and reject.
- [ ] Handover lock and override.
- [ ] Feedback blind rule and safety report.
- [ ] CSV record downloads and opens correctly in Excel.
- [ ] Notifications arrive and links open the right pages.
- [ ] All pages have loading, empty and error states; nothing overflows at 360 px.
- [ ] No secrets visible in the browser network tab or bundle.

### 9.2 Demo-day checklist
- [ ] `python -m scripts.seed --reset` on the deployed database.
- [ ] External cron is pinging `/internal/tick`; backend is awake (open `/health` 2 minutes before).
- [ ] Phone 1 logged in as College A, phone 2 as Receiver A, laptop as Admin on `/admin/live`.
- [ ] Practise the script: post (§3.2) → show Bridge ranking on Admin donation page → Receiver A accepts → show B superseded → handover code → confirm distribution → feedback → impact counter.
- [ ] Backup: screen recording of the full flow in case of network issues.
- [ ] Pitch deck slide 5 status and demo link/QR updated; slide 4 and 5 scores match the app (A = 91).

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Donor** | Organisation posting surplus food |
| **Receiver** | Verified organisation that collects food directly from the Donor and distributes it |
| **Admin** | FoodResQ platform operator |
| **Donation** | One posting of surplus food |
| **Serving** | One meal for one person; the single quantity unit |
| **Offer** | A proposal to one Receiver to take some servings of a donation, with a timeout |
| **Allocation** | Servings of a donation assigned to one Receiver after acceptance; one donation can have several |
| **Bridge** | The FoodResQ decision engine: hard filters + 8-factor weighted score + explanations |
| **Match run** | One execution of Bridge for a donation, storing every candidate evaluated |
| **Effective deadline / Pickup by** | min(Donor's pickup-by time, safe pickup deadline) |
| **Last time of consumption** | prepared_at + safe window (FSSAI label field) |
| **Handover code** | 4-digit code shown to the Receiver and entered by the Donor to confirm collection |
| **Reliability score** | Receiver trust score from acceptance, on-time pickup and ratings |
| **Quality score** | Donor trust score from Receiver feedback and safety reports |
| **FLAGGED** | Donation held for Admin review before matching |
| **Superseded** | Offer closed because another Receiver took all remaining servings |
