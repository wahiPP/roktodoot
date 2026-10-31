# RoktoDoot

An agent-based emergency blood coordination system for Bangladesh.
CSE327 Software Engineering project, North South University.

A family types a request in Bangla, English or Banglish ("Dhaka Medical e O+ lagbe, 2 bag, aj raate"). Five cooperating agents understand it, check whether it looks genuine, find eligible donors nearby, contact them in widening waves, fall back to blood banks, and follow up after the donation. The family watches the search on a live map.

> RoktoDoot coordinates volunteers. It is not a medical device and gives no medical advice. All donors, phone numbers and blood banks in the demo data are simulated.

## What is in this repository

```
backend/    FastAPI + SQLAlchemy + LangGraph   (Python 3.11+)
  app/agents/   intake, trust, matching, outreach, followup, orchestrator
  app/routers/  REST API and WebSocket
  app/rules.json  compatibility, cooldown, ranking weights, waves, trust thresholds
  tests/        pytest (117 tests, ~92% coverage, runs on SQLite and PostgreSQL)
frontend/   Next.js 14 + TypeScript + Tailwind + Leaflet (PWA)
  src/__tests__/  Vitest component tests
  e2e/            Playwright end-to-end test
docs/       architecture, interface design, parser accuracy, demo script, updates
.github/workflows/ci.yml   lint + tests on every PR, SQLite and PostgreSQL
```

## Run it locally

You need Python 3.11+ and Node 20+.

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env
python -m app.seed            # 16 Dhaka hospitals, 6 blood banks, 200 simulated donors
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

For demos, set `SECONDS_PER_MINUTE=3` in `.env` so a 10-minute wave lasts 30 seconds.

**Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. With no Supabase keys set, the login page offers a demo login. Seeded accounts:

| Email | Role |
|---|---|
| `requester@demo.roktodoot.org` | requester with a verified phone |
| `admin@demo.roktodoot.org` | admin (tick "Sign in as admin") |
| `donor001@demo.roktodoot.org` … `donor200@…` | donors |

**Or with Docker:** `docker compose up --build` starts PostgreSQL, the API and the web app.

## The five agents

| Agent | File | What it does | Technique |
|---|---|---|---|
| Intake | `agents/intake.py`, `agents/rule_parser.py` | Turns free text into blood group, units, hospital, deadline, urgency and phone. Asks a follow-up question when something is missing. | Gemini with a Pydantic schema when `GEMINI_API_KEY` is set; the rule-based parser otherwise, or whenever the LLM fails |
| Trust | `agents/trust.py` | Scores the request 0 to 100 and publishes (≥60), holds for an admin (30 to 59) or rejects (<30). Writes a note explaining why. | Weighted rules |
| Matching | `agents/matching.py` | Filters donors by compatibility, cooldown, availability, opt-out, radius and weekly contact cap, then ranks them. | Bounding-box SQL query, haversine distance, weighted score |
| Outreach and Escalation | `agents/outreach.py`, `agents/orchestrator.py`, `worker.py` | Contacts donors in waves (5 km, 10 km, 25 km), escalates on timeout or when everyone declines, then lists blood banks. Only one donor can win an accept. | LangGraph graphs, database-backed worker (restart-safe) |
| Follow-up | `agents/followup.py` | Confirms the donation, starts the donor's cooldown, thanks them, reminds them when they can donate again, expires requests after 24 hours. | Background jobs, Bangla and English templates |

The LLM is only used for language. Every decision about who to contact, when and in what order is made by rules in `rules.json`, so it can be tested and explained. Every agent step is stored in `request_events`, which is both the audit log and the map timeline.

## Tests

```bash
cd backend && pytest --cov=app                   # 117 tests
TEST_DATABASE_URL=postgresql://user:pass@localhost/roktodoot_test pytest   # same tests on PostgreSQL

cd frontend && npm test                          # Vitest component tests
npm run test:e2e                                 # Playwright; needs both servers running
```

What is covered:

- **Agents:** compatibility matrix, cooldown, readiness, ranking formula, trust thresholds, wave sizes and timeouts, early escalation, bank fallback, accept race, restart safety, expiry, reminders
- **Parser:** 60 messages in Bangla, English and Banglish (40 dev, 20 held back). A message counts only if every field is right. See [docs/parser-accuracy.md](docs/parser-accuracy.md)
- **LLM path:** recorded responses, invalid output, network failure, caching. No API quota is used in tests
- **API:** the full flow, permissions, validation, rate limiting, admin review, data deletion, WebSocket
- **Privacy:** donor contact hidden until acceptance; map has no names, no phone numbers and positions rounded to ~1 km
- **Login security:** valid, expired, wrong-key and wrong-audience tokens; Supabase HS256 and ES256 (JWKS); dev login forced off in production

## Google login (Supabase)

1. Create a Supabase project. In **Authentication → Providers**, enable Google and paste the OAuth client ID and secret from Google Cloud Console. Add `http://localhost:3000/auth/callback` (and your Vercel URL) as redirect URLs.
2. Frontend `.env.local`: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Backend `.env`: `SUPABASE_URL` (tokens are checked against the project's JWKS). Older projects that still sign with HS256 also need `SUPABASE_JWT_SECRET`.
4. Put admin emails in `ADMIN_EMAILS`.

## Deploy

- **Database:** Supabase PostgreSQL. Use its connection string as `DATABASE_URL`.
- **Backend:** Render, using `render.yaml`. Set `ENV=production`, which switches off dev login and the demo endpoints.
- **Frontend:** Vercel, root directory `frontend`, with `NEXT_PUBLIC_API_URL` pointing at the Render URL.
- Free Render instances sleep after inactivity and the worker sleeps with them. Open the site a few minutes before a demo, or add an uptime monitor on `/health`.

## API overview

| Method and path | Purpose |
|---|---|
| `POST /auth/dev-login` | Demo login (development only) |
| `GET/PATCH /me`, `POST /me/phone/verify` | Profile and demo phone verification (code `123456`) |
| `POST /donors`, `GET /donors/me`, `PATCH /donors/me/availability`, `DELETE /donors/me` | Donor profile, pause, opt out and delete |
| `GET /donors/inbox` | Requests this donor can answer (no family contact shown) |
| `POST /requests`, `PATCH /requests/{id}`, `POST /requests/{id}/confirm` | Create from text or form, edit, confirm |
| `GET /requests/{id}`, `GET /requests/mine` | Request details (donor contact only after acceptance) |
| `GET /requests/{id}/map`, `WS /ws/requests/{id}?token=` | Live escalation map |
| `POST /requests/{id}/respond`, `/fulfil`, `/cancel` | Donor answer, donation confirmed, cancel |
| `GET /admin/requests?status=HELD`, `POST /admin/requests/{id}/decision`, `GET /admin/requests/{id}/events`, `GET /admin/stats` | Admin review, audit log, analytics |
| `POST /dev/requests/{id}/skip-wave`, `/simulate` | Demo helpers (development only) |

## Team

| Member | Area |
|---|---|
| [Member A] | Frontend and UX |
| [Member B] | Backend and DevOps |
| [Member C] | AI agents |
