# Fundamentals

A daily study app that keeps your fundamentals sharp: a short session of flashcards, multiple-choice and math questions each day, scheduled with spaced repetition (FSRS). Math answers are checked exactly with SymPy, so `2x`, `x*2` and `2*x` are all accepted. Works on phones, tablets and laptops, and installs to the home screen as a PWA.

- Design spec: [`docs/superpowers/specs/2026-10-04-daily-fundamentals-app-design.md`](docs/superpowers/specs/2026-10-04-daily-fundamentals-app-design.md)
- Plan 1 (this foundation): [`docs/superpowers/plans/2026-10-04-plan-1-foundation-core-loop.md`](docs/superpowers/plans/2026-10-04-plan-1-foundation-core-loop.md)

## How it fits together

| Part | Where | What it does |
|---|---|---|
| Web app + API | `src/app` | Next.js 16 pages, `/api/session` (today's cards), `/api/answer` (grade + schedule) |
| Domain logic | `src/lib` | `session.ts` builds the daily queue, `grading.ts` grades answers, `answer.ts` records them, `scheduler.ts` wraps FSRS |
| Database | `src/db` | Drizzle schema for Postgres; `seed-data.ts` holds the starter cards |
| Math checker | `sidecar/` | Python FastAPI + SymPy service on port 8001 |
| Offline | `public/sw.js` | Service worker caching today's session |

## Run it locally

You need Node 22+ and Python 3.12+. Docker is optional.

```bash
npm install
cp .env.example .env                     # then set AUTH_SECRET: openssl rand -hex 32

# 1. Postgres: either Docker...
docker compose up -d db
docker compose exec db psql -U app -c "CREATE DATABASE app_test"
# ...or an embedded Postgres 16 with no Docker (keep it running in its own terminal):
npm run db:dev

# 2. Create the tables in both databases, then add the starter cards
npm run db:push
DATABASE_URL=postgres://app:app@localhost:5432/app_test npx drizzle-kit push
npm run db:seed

# 3. Math checker (its own terminal)
cd sidecar && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app:app --port 8001

# 4. The app
npm run dev                               # http://localhost:3000
```

With `ENABLE_DEV_LOGIN=1` (the default in `.env.example`) the sign-in page has a **Dev login** that signs in as any email. It is always off in production builds. For real sign-in, set the Google or email variables in `.env`.

## Tests

```bash
npm test                                  # unit tests (needs Postgres with the app_test database)
cd sidecar && .venv/bin/pytest -q         # math checker
npx playwright test                       # end to end on iPhone, iPad and desktop sizes (needs the app, DB and sidecar running)
PW_WEBKIT=1 npx playwright test           # same, phone and tablet in real WebKit (run `npx playwright install webkit` once)
npm run build && npm run check:build      # production build, and check no page bakes in build-time state
npx tsx scripts/check-seed.mts            # every seed math answer is accepted by the checker
```
