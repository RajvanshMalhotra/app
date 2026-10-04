# Plan 1: Foundation + Core Daily Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A responsive, installable website where a signed-in user completes a daily session of seeded flashcards, MCQ and math cards, with FSRS scheduling and exact math grading.

**Architecture:** One Next.js (App Router, TypeScript) app for UI and API routes, Postgres via Drizzle, and a small Python FastAPI sidecar for SymPy math checking. Domain logic (scheduler, session builder, grading) lives in plain TypeScript modules under `src/lib/` so it can be unit-tested without Next.js.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, KaTeX, Drizzle ORM + postgres-js, Auth.js v5 (`next-auth@beta`) with the Drizzle adapter, `ts-fsrs`, Serwist (PWA), Vitest, Playwright, Python 3.12 + FastAPI + SymPy + pytest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-04-daily-fundamentals-app-design.md`

**Later plans (out of scope here):** 2 LLM gateway, vLLM and generation · 3 PDF RAG · 4 stats and tutor · 5 leaderboard · 6 production deployment.

## Global Constraints

- Mobile-first breakpoints: base (phone), `md` 768px (tablet), `lg` 1024px (laptop).
- Supported browsers: iOS Safari 16.4+, Android Chrome, desktop evergreen browsers.
- Tap targets ≥44px; use `100dvh` and `env(safe-area-inset-*)`.
- Light and dark themes follow the system, with a manual toggle.
- Math is rendered with KaTeX.
- Daily session ≈ 20 items: due reviews first, then new cards, then 3–5 weak-topic drills.
- Card types: `flashcard` | `mcq` | `free_text` | `math`. Flashcard ratings: Again/Hard/Good/Easy.
- Math graded by SymPy (symbolic equivalence or numeric tolerance 1e-6 relative), never by an LLM.
- Keyboard: Space flips, 1–4 rate, Enter submits.
- All tests run without the HPC.

## Review Focus

1. **Nothing due and no new cards** → the session page shows a friendly "All done for today" state, not an empty screen or an error. (Task 4, Task 9)
2. **Equivalent math forms** (`2x` vs `x*2`, `1/2` vs `0.5`, extra spaces, `^` for powers) → graded correct. (Task 5)
3. **Malformed math input** (`2x+`, empty string, `import os`) → graded incorrect with a message, never a 500 or code execution. (Task 5)
4. **Math sidecar down** → the answer falls back to self-rating instead of failing the request. (Task 6)
5. **Double tap / double submit** of the same answer → exactly one review row is recorded. (Task 7)

---

## File Structure

```
docker-compose.yml                 Postgres (pgvector image) + math sidecar for dev
.env.example
drizzle.config.ts
src/db/schema.ts                   all tables for this plan
src/db/client.ts                   drizzle client
src/db/seed.ts                     starter topics + cards
src/lib/scheduler.ts               FSRS wrapper
src/lib/session.ts                 buildDailySession
src/lib/grading.ts                 grade(card, response)
src/lib/math-client.ts             HTTP client for sidecar
src/lib/answer.ts                  recordAnswer (grade + schedule + idempotency)
src/auth.ts                        Auth.js config
src/app/api/auth/[...nextauth]/route.ts
src/app/api/session/route.ts
src/app/api/answer/route.ts
src/app/layout.tsx, globals.css    theme, safe areas
src/app/manifest.ts, src/app/sw.ts PWA
src/components/app-shell.tsx       bottom tabs (phone) / sidebar (lg)
src/components/study-card.tsx      card UI, flip, rate, keyboard
src/components/math.tsx            KaTeX renderer
src/app/(app)/today/page.tsx       daily session page
src/app/(app)/page.tsx             home
src/app/signin/page.tsx
sidecar/app.py, sidecar/test_app.py, sidecar/requirements.txt, sidecar/Dockerfile
tests/unit/*.test.ts               vitest
tests/e2e/session.spec.ts          playwright, 3 viewports
```

---

### Task 1: Scaffold the app, dev database and test runners

**Files:**
- Create: the Next.js project at the repo root, `docker-compose.yml`, `.env.example`, `vitest.config.ts`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (Vitest), `npm run dev`, and Postgres at `postgres://app:app@localhost:5432/app`

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
npm i drizzle-orm postgres ts-fsrs next-auth@beta @auth/drizzle-adapter katex framer-motion zod
npm i -D drizzle-kit vitest @vitejs/plugin-react vite-tsconfig-paths @playwright/test @types/katex tsx
npx shadcn@latest init -d
```

- [ ] **Step 2: Dev services** — `docker-compose.yml`:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: app }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  math:
    build: ./sidecar
    ports: ["8001:8001"]
volumes: { pgdata: {} }
```

`.env.example`:

```
DATABASE_URL=postgres://app:app@localhost:5432/app
TEST_DATABASE_URL=postgres://app:app@localhost:5432/app_test
MATH_URL=http://localhost:8001
AUTH_SECRET=change-me
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
EMAIL_SERVER=smtp://user:pass@smtp.example.com:587
EMAIL_FROM=noreply@example.com
```

- [ ] **Step 3: Vitest config** — `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { include: ["tests/unit/**/*.test.ts"], fileParallelism: false },
});
```

Add to the `package.json` scripts: `"test": "vitest run"`, `"e2e": "playwright test"`, `"db:push": "drizzle-kit push"`, `"db:seed": "tsx src/db/seed.ts"`.

- [ ] **Step 4: Smoke test** — `tests/unit/smoke.test.ts`:

```ts
import { expect, test } from "vitest";
test("runs", () => expect(1 + 1).toBe(2));
```

Run: `npm test` → Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Next.js app, dev services, vitest"
```

---

### Task 2: Database schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `tests/unit/db.test.ts`, `tests/unit/helpers.ts`

**Interfaces:**
- Produces: tables `users`, `accounts`, `sessions`, `verificationTokens` (Auth.js), `topics`, `cards`, `reviews`; `db` (drizzle instance); types `Card = typeof cards.$inferSelect` and `Review = typeof reviews.$inferSelect`; test helper `resetDb()`

- [ ] **Step 1: Write the failing test** — `tests/unit/db.test.ts`:

```ts
import { beforeEach, expect, test } from "vitest";
import { db } from "@/db/client";
import { cards, topics, users } from "@/db/schema";
import { resetDb } from "./helpers";

beforeEach(resetDb);

test("inserts a topic and a card", async () => {
  const [t] = await db.insert(topics).values({ name: "Linear Algebra", track: "ml-engineer" }).returning();
  const [c] = await db.insert(cards).values({
    topicId: t.id, type: "math", prompt: "d/dx x^2", answer: "2*x", difficulty: 1, source: "user",
  }).returning();
  expect(c.id).toBeTypeOf("string");
  await db.insert(users).values({ email: "a@b.c" });
});
```

`tests/unit/helpers.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
export async function resetDb() {
  await db.execute(sql`TRUNCATE reviews, cards, topics, users RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- db` → Expected: FAIL, cannot resolve `@/db/client`.

- [ ] **Step 3: Implement** — `src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
const url = process.env.VITEST ? process.env.TEST_DATABASE_URL! : process.env.DATABASE_URL!;
export const db = drizzle(postgres(url), { schema });
```

`src/db/schema.ts`:

```ts
import { boolean, integer, pgEnum, pgTable, primaryKey, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  displayName: text("display_name"),
  targetRole: text("target_role"),
  resumeText: text("resume_text"),
  leaderboardOptIn: boolean("leaderboard_opt_in").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"), access_token: text("access_token"),
  expires_at: integer("expires_at"), token_type: text("token_type"),
  scope: text("scope"), id_token: text("id_token"), session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  track: text("track").notNull(),
});

export const cardType = pgEnum("card_type", ["flashcard", "mcq", "free_text", "math"]);
export const cardSource = pgEnum("card_source", ["ai_fast", "ai_heavy", "book", "user"]);

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  topicId: uuid("topic_id").notNull().references(() => topics.id),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  type: cardType("type").notNull(),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  choices: text("choices").array(),
  difficulty: integer("difficulty").notNull().default(1),
  source: cardSource("source").notNull(),
  citation: text("citation"),
  qualityStatus: text("quality_status").notNull().default("ok"),
  flagCount: integer("flag_count").notNull().default(0),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cardId: uuid("card_id").notNull().references(() => cards.id),
  clientAnswerId: text("client_answer_id").notNull(),
  rating: integer("rating").notNull(),
  correct: boolean("correct").notNull(),
  responseMs: integer("response_ms").notNull(),
  stability: real("stability").notNull(),
  fsrsDifficulty: real("fsrs_difficulty").notNull(),
  reps: integer("reps").notNull(),
  lapses: integer("lapses").notNull(),
  state: integer("state").notNull(),
  dueAt: timestamp("due_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("reviews_client_answer_uq").on(t.userId, t.clientAnswerId)]);

export type Card = typeof cards.$inferSelect;
export type Review = typeof reviews.$inferSelect;
```

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({ schema: "./src/db/schema.ts", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_URL! } });
```

- [ ] **Step 4: Create both databases and push the schema**

```bash
cp .env.example .env && docker compose up -d db
docker compose exec db psql -U app -c "CREATE DATABASE app_test"
npx dotenv -e .env -- npm run db:push
DATABASE_URL=postgres://app:app@localhost:5432/app_test npm run db:push
```

Load `.env` in Vitest: `npm i -D dotenv-cli` and set the script to `"test": "dotenv -e .env -- vitest run"`.

Run: `npm test -- db` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(db): schema for users, auth, topics, cards, reviews"
```

---

### Task 3: FSRS scheduler

**Files:**
- Create: `src/lib/scheduler.ts`, `tests/unit/scheduler.test.ts`

**Interfaces:**
- Produces:
  - `type Rating = 1 | 2 | 3 | 4` (Again, Hard, Good, Easy)
  - `type SchedState = { stability; fsrsDifficulty; reps; lapses; state; dueAt: Date; lastReview: Date | null }`
  - `scheduleReview(prev: SchedState | null, rating: Rating, now: Date): SchedState`

- [ ] **Step 1: Failing test**

```ts
import { expect, test } from "vitest";
import { scheduleReview } from "@/lib/scheduler";

const now = new Date("2026-10-04T10:00:00Z");

test("new card rated Good is due later than now", () => {
  const s = scheduleReview(null, 3, now);
  expect(s.dueAt.getTime()).toBeGreaterThan(now.getTime());
  expect(s.reps).toBe(1);
});

test("Again comes back sooner than Easy", () => {
  const again = scheduleReview(null, 1, now);
  const easy = scheduleReview(null, 4, now);
  expect(again.dueAt.getTime()).toBeLessThan(easy.dueAt.getTime());
});

test("lapse on a mature card increments lapses", () => {
  let s = scheduleReview(null, 3, now);
  s = scheduleReview(s, 3, s.dueAt);
  s = scheduleReview(s, 3, s.dueAt);
  const lapsed = scheduleReview(s, 1, s.dueAt);
  expect(lapsed.lapses).toBe(1);
});
```

- [ ] **Step 2: Run** `npm test -- scheduler` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { createEmptyCard, fsrs, type Card as FsrsCard, type Grade } from "ts-fsrs";

export type Rating = 1 | 2 | 3 | 4;
export type SchedState = {
  stability: number; fsrsDifficulty: number; reps: number; lapses: number;
  state: number; dueAt: Date; lastReview: Date | null;
};

const f = fsrs({ enable_fuzz: false });

export function scheduleReview(prev: SchedState | null, rating: Rating, now: Date): SchedState {
  const card: FsrsCard = prev
    ? { ...createEmptyCard(prev.lastReview ?? now), due: prev.dueAt, stability: prev.stability,
        difficulty: prev.fsrsDifficulty, reps: prev.reps, lapses: prev.lapses, state: prev.state,
        last_review: prev.lastReview ?? undefined }
    : createEmptyCard(now);
  const { card: c } = f.next(card, now, rating as Grade);
  return { stability: c.stability, fsrsDifficulty: c.difficulty, reps: c.reps, lapses: c.lapses,
           state: c.state, dueAt: c.due, lastReview: now };
}
```

- [ ] **Step 4: Run** `npm test -- scheduler` → PASS.

- [ ] **Step 5: Commit** `git commit -am "feat: FSRS scheduler wrapper"` (after `git add src/lib/scheduler.ts tests/unit/scheduler.test.ts`).

---

### Task 4: Daily session builder

**Files:**
- Create: `src/lib/session.ts`, `tests/unit/session.test.ts`

**Interfaces:**
- Consumes: `db`, `cards`, `reviews`, `topics`
- Produces:
  - `type SessionItem = { card: Card; kind: "review" | "new" | "drill" }`
  - `buildDailySession(userId: string, now: Date, size = 20): Promise<SessionItem[]>`
  - The latest review per card is the source of truth for scheduling state.

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, expect, test } from "vitest";
import { db } from "@/db/client";
import { cards, reviews, topics, users } from "@/db/schema";
import { buildDailySession } from "@/lib/session";
import { resetDb } from "./helpers";

beforeEach(resetDb);
const now = new Date("2026-10-04T10:00:00Z");

async function setup(nCards: number) {
  const [u] = await db.insert(users).values({ email: "u@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "Prob", track: "ml-engineer" }).returning();
  const cs = await db.insert(cards).values(Array.from({ length: nCards }, (_, i) => ({
    topicId: t.id, type: "flashcard" as const, prompt: `q${i}`, answer: `a${i}`, source: "user" as const,
  }))).returning();
  return { u, cs };
}

function rev(userId: string, cardId: string, dueAt: Date, correct = true) {
  return { userId, cardId, clientAnswerId: crypto.randomUUID(), rating: correct ? 3 : 1, correct,
    responseMs: 4000, stability: 1, fsrsDifficulty: 5, reps: 1, lapses: 0, state: 2, dueAt };
}

test("empty when there are no cards", async () => {
  const [u] = await db.insert(users).values({ email: "e@x.y" }).returning();
  expect(await buildDailySession(u.id, now)).toEqual([]);
});

test("due reviews come first, not-yet-due cards are excluded", async () => {
  const { u, cs } = await setup(3);
  await db.insert(reviews).values([
    rev(u.id, cs[0].id, new Date("2026-10-03T00:00:00Z")),
    rev(u.id, cs[1].id, new Date("2026-10-10T00:00:00Z")),
  ]);
  const s = await buildDailySession(u.id, now);
  expect(s[0]).toMatchObject({ kind: "review", card: { id: cs[0].id } });
  expect(s.map((i) => i.card.id)).not.toContain(cs[1].id);
  expect(s.find((i) => i.card.id === cs[2].id)?.kind).toBe("new");
});

test("caps at size", async () => {
  const { u } = await setup(40);
  expect(await buildDailySession(u.id, now, 20)).toHaveLength(20);
});
```

- [ ] **Step 2: Run** `npm test -- session` → FAIL.

- [ ] **Step 3: Implement**

```ts
import { and, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews, type Card } from "@/db/schema";

export type SessionItem = { card: Card; kind: "review" | "new" | "drill" };

const DRILLS = 4;

export async function buildDailySession(userId: string, now: Date, size = 20): Promise<SessionItem[]> {
  const latest = db.$with("latest").as(
    db.selectDistinctOn([reviews.cardId], { cardId: reviews.cardId, dueAt: reviews.dueAt, correct: reviews.correct })
      .from(reviews).where(eq(reviews.userId, userId))
      .orderBy(reviews.cardId, sql`${reviews.createdAt} desc`),
  );
  const due = await db.with(latest).select({ card: cards }).from(latest)
    .innerJoin(cards, eq(cards.id, latest.cardId))
    .where(sql`${latest.dueAt} <= ${now}`).orderBy(latest.dueAt).limit(size);

  const items: SessionItem[] = due.map((r) => ({ card: r.card, kind: "review" }));
  if (items.length >= size) return items;

  const seenIds = (await db.selectDistinct({ id: reviews.cardId }).from(reviews)
    .where(eq(reviews.userId, userId))).map((r) => r.id);
  const visible = and(eq(cards.qualityStatus, "ok"), or(isNull(cards.ownerUserId), eq(cards.ownerUserId, userId)));
  const newRows = await db.select().from(cards)
    .where(seenIds.length ? and(visible, notInArray(cards.id, seenIds)) : visible)
    .orderBy(cards.difficulty).limit(size - items.length);
  items.push(...newRows.map((card) => ({ card, kind: "new" as const })));

  const room = Math.min(DRILLS, size - items.length);
  if (room > 0) {
    const taken = new Set(items.map((i) => i.card.id));
    const weak = await db.with(latest).select({ card: cards }).from(latest)
      .innerJoin(cards, eq(cards.id, latest.cardId))
      .where(eq(latest.correct, false)).limit(room + taken.size);
    items.push(...weak.filter((w) => !taken.has(w.card.id)).slice(0, room)
      .map((w) => ({ card: w.card, kind: "drill" as const })));
  }
  return items;
}
```

- [ ] **Step 4: Run** `npm test -- session` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts tests/unit/session.test.ts && git commit -m "feat: daily session builder"
```

---

### Task 5: Math checking sidecar (Python)

**Files:**
- Create: `sidecar/app.py`, `sidecar/test_app.py`, `sidecar/requirements.txt`, `sidecar/Dockerfile`

**Interfaces:**
- Produces: `POST /check {expected: str, given: str}` → `{correct: bool, reason: "equivalent"|"numeric"|"different"|"parse_error"}`; `GET /health` → `{ok: true}`

- [ ] **Step 1: Failing tests** — `sidecar/test_app.py`:

```python
import pytest
from fastapi.testclient import TestClient
from app import app

c = TestClient(app)

def check(e, g):
    return c.post("/check", json={"expected": e, "given": g}).json()

@pytest.mark.parametrize("e,g", [
    ("2*x", "2x"), ("2*x", "x*2"), ("1/2", "0.5"), ("x^2 + 1", " x**2+1 "),
    ("sin(x)^2 + cos(x)^2", "1"), ("pi", "3.14159265358979"),
])
def test_equivalent(e, g):
    assert check(e, g)["correct"] is True

def test_different():
    assert check("2*x", "3x") == {"correct": False, "reason": "different"}

@pytest.mark.parametrize("g", ["2x+", "", "import os", "__import__('os')", "x" * 2000])
def test_malformed_is_incorrect_not_error(g):
    r = c.post("/check", json={"expected": "2*x", "given": g})
    assert r.status_code == 200
    assert r.json()["correct"] is False

def test_health():
    assert c.get("/health").json() == {"ok": True}
```

`sidecar/requirements.txt`:

```
fastapi==0.115.*
uvicorn==0.32.*
sympy==1.13.*
httpx==0.27.*
pytest==8.*
```

- [ ] **Step 2: Run** `cd sidecar && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pytest -q` → FAIL (no `app`).

- [ ] **Step 3: Implement** — `sidecar/app.py`:

```python
import re
from fastapi import FastAPI
from pydantic import BaseModel
from sympy import N, simplify
from sympy.parsing.sympy_parser import (
    convert_xor, implicit_multiplication_application, parse_expr, standard_transformations,
)

app = FastAPI()
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
SAFE = re.compile(r"^[0-9a-zA-Z\s\.\+\-\*/\^\(\),=]*$")
MAX_LEN = 500


class CheckIn(BaseModel):
    expected: str
    given: str


def parse(s: str):
    s = s.strip()
    if not s or len(s) > MAX_LEN or not SAFE.match(s) or "__" in s:
        raise ValueError("unsafe or empty")
    return parse_expr(s, transformations=TRANSFORMS, evaluate=True)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check")
def check(body: CheckIn):
    try:
        e, g = parse(body.expected), parse(body.given)
    except Exception:
        return {"correct": False, "reason": "parse_error"}
    try:
        if simplify(e - g) == 0:
            return {"correct": True, "reason": "equivalent"}
        if not e.free_symbols and not g.free_symbols:
            ev, gv = complex(N(e)), complex(N(g))
            if abs(ev - gv) <= 1e-6 * max(1.0, abs(ev)):
                return {"correct": True, "reason": "numeric"}
    except Exception:
        return {"correct": False, "reason": "parse_error"}
    return {"correct": False, "reason": "different"}
```

Note: `"import os"` passes the character whitelist, but `parse_expr` fails on it as a statement, so it's still graded `parse_error`. The `__` and whitelist checks block attribute access. The pi test passes the numeric tolerance (π vs. 3.14159265358979 differs by ~3e-15).

- [ ] **Step 4: Run** `.venv/bin/pytest -q` → all PASS.

- [ ] **Step 5: Dockerfile and commit**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
```

```bash
echo ".venv/" >> .gitignore
git add sidecar .gitignore && git commit -m "feat: SymPy math checking sidecar"
```

---

### Task 6: Grading module

**Files:**
- Create: `src/lib/math-client.ts`, `src/lib/grading.ts`, `tests/unit/grading.test.ts`

**Interfaces:**
- Consumes: `Card`; sidecar `POST /check`
- Produces:
  - `type Response = { kind: "rating"; rating: Rating } | { kind: "choice"; choice: string } | { kind: "text"; text: string }`
  - `type GradeResult = { status: "graded"; correct: boolean; rating: Rating; feedback?: string } | { status: "self_rate"; reason: string }`
  - `grade(card: Card, res: Response, deps?: { checkMath }): Promise<GradeResult>`
  - `checkMath(expected, given): Promise<{correct: boolean; reason: string}>`, which throws on a network error
  - `free_text` returns `self_rate` in this plan (LLM grading comes in Plan 2).

- [ ] **Step 1: Failing test**

```ts
import { expect, test, vi } from "vitest";
import { grade } from "@/lib/grading";
import type { Card } from "@/db/schema";

const base = { id: "c", topicId: "t", ownerUserId: null, choices: null, difficulty: 1, source: "user",
  citation: null, qualityStatus: "ok", flagCount: 0 } as const;
const card = (o: Partial<Card>) => ({ ...base, type: "flashcard", prompt: "p", answer: "a", ...o }) as Card;

test("flashcard uses the self rating", async () => {
  expect(await grade(card({}), { kind: "rating", rating: 4 })).toEqual({ status: "graded", correct: true, rating: 4 });
  expect(await grade(card({}), { kind: "rating", rating: 1 })).toMatchObject({ correct: false, rating: 1 });
});

test("mcq compares choice, case- and space-insensitive", async () => {
  const c = card({ type: "mcq", answer: "Adam", choices: ["SGD", "Adam"] });
  expect(await grade(c, { kind: "choice", choice: " adam " })).toMatchObject({ correct: true, rating: 3 });
  expect(await grade(c, { kind: "choice", choice: "SGD" })).toMatchObject({ correct: false, rating: 1 });
});

test("math delegates to the sidecar", async () => {
  const checkMath = vi.fn().mockResolvedValue({ correct: true, reason: "equivalent" });
  const r = await grade(card({ type: "math", answer: "2*x" }), { kind: "text", text: "2x" }, { checkMath });
  expect(checkMath).toHaveBeenCalledWith("2*x", "2x");
  expect(r).toMatchObject({ status: "graded", correct: true });
});

test("math falls back to self rating when the sidecar is down", async () => {
  const checkMath = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
  const r = await grade(card({ type: "math" }), { kind: "text", text: "2x" }, { checkMath });
  expect(r).toEqual({ status: "self_rate", reason: "Couldn't check this automatically — how did you do?" });
});

test("math parse error is incorrect with feedback", async () => {
  const checkMath = vi.fn().mockResolvedValue({ correct: false, reason: "parse_error" });
  const r = await grade(card({ type: "math" }), { kind: "text", text: "2x+" }, { checkMath });
  expect(r).toMatchObject({ status: "graded", correct: false, feedback: "We couldn't read that expression." });
});
```

- [ ] **Step 2: Run** `npm test -- grading` → FAIL.

- [ ] **Step 3: Implement** — `src/lib/math-client.ts`:

```ts
export async function checkMath(expected: string, given: string): Promise<{ correct: boolean; reason: string }> {
  const r = await fetch(`${process.env.MATH_URL}/check`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ expected, given }), signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(`math sidecar ${r.status}`);
  return r.json();
}
```

`src/lib/grading.ts`:

```ts
import type { Card } from "@/db/schema";
import type { Rating } from "./scheduler";
import { checkMath as realCheckMath } from "./math-client";

export type Response =
  | { kind: "rating"; rating: Rating } | { kind: "choice"; choice: string } | { kind: "text"; text: string };
export type GradeResult =
  | { status: "graded"; correct: boolean; rating: Rating; feedback?: string }
  | { status: "self_rate"; reason: string };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const SELF = "Couldn't check this automatically — how did you do?";

export async function grade(card: Card, res: Response, deps = { checkMath: realCheckMath }): Promise<GradeResult> {
  if (res.kind === "rating") return { status: "graded", correct: res.rating >= 3, rating: res.rating };
  if (card.type === "mcq" && res.kind === "choice") {
    const ok = norm(res.choice) === norm(card.answer);
    return { status: "graded", correct: ok, rating: ok ? 3 : 1 };
  }
  if (card.type === "math" && res.kind === "text") {
    try {
      const r = await deps.checkMath(card.answer, res.text);
      if (r.reason === "parse_error") return { status: "graded", correct: false, rating: 1, feedback: "We couldn't read that expression." };
      return { status: "graded", correct: r.correct, rating: r.correct ? 3 : 1 };
    } catch {
      return { status: "self_rate", reason: SELF };
    }
  }
  return { status: "self_rate", reason: SELF };
}
```

- [ ] **Step 4: Run** `npm test -- grading` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/grading.ts src/lib/math-client.ts tests/unit/grading.test.ts && git commit -m "feat: grading for flashcard, mcq, math"
```

---

### Task 7: Recording answers (idempotent)

**Files:**
- Create: `src/lib/answer.ts`, `tests/unit/answer.test.ts`

**Interfaces:**
- Consumes: `grade`, `scheduleReview`, `db`
- Produces: `recordAnswer({ userId, cardId, clientAnswerId, response, responseMs, now, deps? }): Promise<GradeResult & { dueAt?: Date }>`. Only `graded` results write a review. A repeated `clientAnswerId` returns the original result without writing a new row.

- [ ] **Step 1: Failing test**

```ts
import { beforeEach, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews, topics, users } from "@/db/schema";
import { recordAnswer } from "@/lib/answer";
import { resetDb } from "./helpers";

beforeEach(resetDb);
const now = new Date("2026-10-04T10:00:00Z");

async function setup() {
  const [u] = await db.insert(users).values({ email: "u@x.y" }).returning();
  const [t] = await db.insert(topics).values({ name: "T", track: "ml-engineer" }).returning();
  const [c] = await db.insert(cards).values({ topicId: t.id, type: "flashcard", prompt: "q", answer: "a", source: "user" }).returning();
  return { u, c };
}

test("writes one review with FSRS state", async () => {
  const { u, c } = await setup();
  const r = await recordAnswer({ userId: u.id, cardId: c.id, clientAnswerId: "k1",
    response: { kind: "rating", rating: 3 }, responseMs: 5000, now });
  expect(r).toMatchObject({ status: "graded", correct: true });
  const rows = await db.select().from(reviews).where(eq(reviews.userId, u.id));
  expect(rows).toHaveLength(1);
  expect(rows[0].dueAt.getTime()).toBeGreaterThan(now.getTime());
});

test("double submit with the same clientAnswerId writes once", async () => {
  const { u, c } = await setup();
  const args = { userId: u.id, cardId: c.id, clientAnswerId: "same",
    response: { kind: "rating" as const, rating: 3 as const }, responseMs: 5000, now };
  await Promise.all([recordAnswer(args), recordAnswer(args)]);
  expect(await db.select().from(reviews)).toHaveLength(1);
});
```

- [ ] **Step 2: Run** `npm test -- answer` → FAIL.

- [ ] **Step 3: Implement**

```ts
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cards, reviews } from "@/db/schema";
import { grade, type GradeResult, type Response } from "./grading";
import { scheduleReview } from "./scheduler";

type Args = { userId: string; cardId: string; clientAnswerId: string; response: Response;
  responseMs: number; now: Date; deps?: Parameters<typeof grade>[2] };

export async function recordAnswer(a: Args): Promise<GradeResult & { dueAt?: Date }> {
  const [existing] = await db.select().from(reviews)
    .where(and(eq(reviews.userId, a.userId), eq(reviews.clientAnswerId, a.clientAnswerId)));
  if (existing) return { status: "graded", correct: existing.correct, rating: existing.rating as 1 | 2 | 3 | 4, dueAt: existing.dueAt };

  const [card] = await db.select().from(cards).where(eq(cards.id, a.cardId));
  if (!card) throw new Error("card not found");
  const g = await grade(card, a.response, a.deps);
  if (g.status !== "graded") return g;

  const [prev] = await db.select().from(reviews)
    .where(and(eq(reviews.userId, a.userId), eq(reviews.cardId, a.cardId)))
    .orderBy(desc(reviews.createdAt)).limit(1);
  const s = scheduleReview(prev ? { ...prev, lastReview: prev.createdAt } : null, g.rating, a.now);

  const inserted = await db.insert(reviews).values({
    userId: a.userId, cardId: a.cardId, clientAnswerId: a.clientAnswerId, rating: g.rating,
    correct: g.correct, responseMs: a.responseMs, stability: s.stability, fsrsDifficulty: s.fsrsDifficulty,
    reps: s.reps, lapses: s.lapses, state: s.state, dueAt: s.dueAt, createdAt: a.now,
  }).onConflictDoNothing().returning();
  return { ...g, dueAt: inserted[0]?.dueAt ?? s.dueAt };
}
```

- [ ] **Step 4: Run** `npm test -- answer` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/answer.ts tests/unit/answer.test.ts && git commit -m "feat: idempotent answer recording"
```

---

### Task 8: Auth and API routes

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/session/route.ts`, `src/app/api/answer/route.ts`, `src/app/signin/page.tsx`, `src/middleware.ts`

**Interfaces:**
- Consumes: `buildDailySession`, `recordAnswer`
- Produces:
  - `GET /api/session` → `{ items: { kind, card: { id, type, prompt, choices, answer, citation } }[] }`
  - `POST /api/answer` with body `{ cardId, clientAnswerId, response, responseMs }` → `GradeResult & { dueAt? }`
  - Both return 401 when signed out and 400 on an invalid body.
  - `auth()` helper.
  - Dev-only Credentials provider `dev-login` (email only), enabled when `NODE_ENV !== "production"`, which e2e tests use.

- [ ] **Step 1: Auth config** — `src/auth.ts`:

```ts
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

const dev = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts, sessionsTable: sessions, verificationTokensTable: verificationTokens }),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [
    Google,
    Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM }),
    ...(dev ? [Credentials({
      id: "dev-login", credentials: { email: {} },
      async authorize(c) {
        const email = String(c.email);
        const [u] = (await db.select().from(users).where(eq(users.email, email)))
          .concat(await db.insert(users).values({ email }).onConflictDoNothing().returning());
        return u ?? null;
      },
    })] : []),
  ],
  callbacks: { jwt({ token, user }) { if (user?.id) token.uid = user.id; return token; },
               session({ session, token }) { session.user.id = token.uid as string; return session; } },
});
```

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
export { GET, POST } from "@/auth";
```

Change the export in `src/auth.ts` to also expose `export const { GET, POST } = handlers;`.

- [ ] **Step 2: API routes** — `src/app/api/session/route.ts`:

```ts
import { auth } from "@/auth";
import { buildDailySession } from "@/lib/session";

export async function GET() {
  const s = await auth();
  if (!s?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const items = await buildDailySession(s.user.id, new Date());
  return Response.json({ items: items.map(({ kind, card }) => ({ kind, card: {
    id: card.id, type: card.type, prompt: card.prompt, choices: card.choices, answer: card.answer, citation: card.citation } })) });
}
```

`src/app/api/answer/route.ts`:

```ts
import { z } from "zod";
import { auth } from "@/auth";
import { recordAnswer } from "@/lib/answer";

const Body = z.object({
  cardId: z.string().uuid(), clientAnswerId: z.string().min(8).max(64), responseMs: z.number().int().nonnegative(),
  response: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rating"), rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) }),
    z.object({ kind: z.literal("choice"), choice: z.string().max(500) }),
    z.object({ kind: z.literal("text"), text: z.string().max(2000) }),
  ]),
});

export async function POST(req: Request) {
  const s = await auth();
  if (!s?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  return Response.json(await recordAnswer({ ...parsed.data, userId: s.user.id, now: new Date() }));
}
```

- [ ] **Step 3: Sign-in page** — `src/app/signin/page.tsx`: a centered card with "Continue with Google", an email field + "Email me a link", and in dev only a "Dev login" form posting to `signIn("dev-login", { email, redirectTo: "/today" })`. Use server actions:

```tsx
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignIn() {
  const dev = process.env.NODE_ENV !== "production";
  return (
    <main className="min-h-dvh grid place-items-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <form action={async () => { "use server"; await signIn("google", { redirectTo: "/today" }); }}>
          <Button className="h-11 w-full">Continue with Google</Button>
        </form>
        <form className="space-y-2" action={async (f) => { "use server"; await signIn("nodemailer", { email: f.get("email"), redirectTo: "/today" }); }}>
          <Input name="email" type="email" required placeholder="you@example.com" className="h-11" />
          <Button variant="outline" className="h-11 w-full">Email me a link</Button>
        </form>
        {dev && (
          <form action={async (f) => { "use server"; await signIn("dev-login", { email: f.get("email"), redirectTo: "/today" }); }}>
            <Input name="email" aria-label="dev email" defaultValue="dev@local.test" className="h-11" />
            <Button variant="ghost" className="mt-2 h-11 w-full">Dev login</Button>
          </form>
        )}
      </div>
    </main>
  );
}
```

Run `npx shadcn@latest add button input` first.

`src/middleware.ts`:

```ts
export { auth as middleware } from "@/auth";
export const config = { matcher: ["/today/:path*", "/"] };
```

In `src/auth.ts`, add `callbacks.authorized: ({ auth }) => !!auth` so the middleware redirects signed-out users to `/signin`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm test` → no type errors, all tests pass.
Run: `npm run dev`, then `curl -s -o /dev/null -w "%{http_code}" localhost:3000/api/session` → Expected: `401`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: auth (Google, email, dev login) and session/answer API"
```

---

### Task 9: Responsive shell, theme and PWA

**Files:**
- Create/modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/components/app-shell.tsx`, `src/components/theme-toggle.tsx`, `src/app/manifest.ts`, `src/app/sw.ts`, `next.config.ts`, `public/icons/*`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`

**Interfaces:**
- Produces:
  - `<AppShell>` with nav items Today `/today`, Stats `/stats`, Leaderboard `/leaderboard`, Library `/library`. The non-Today pages render "Coming soon" placeholders until their plans.
  - The theme is a `data-theme` attribute on `<html>`.

- [ ] **Step 1: Design pass.** Before writing the UI, invoke the `frontend-design:frontend-design` skill (or `impeccable:impeccable`) with this brief: *calm, focused study app; editorial typography (Inter for UI, a serif such as Fraunces for card prompts); one accent color; generous whitespace; dark and light themes.* Record the chosen tokens in `globals.css`.

- [ ] **Step 2: Theme tokens and safe areas** — the `globals.css` base (extend the shadcn variables):

```css
@import "tailwindcss";
:root { --accent-brand: oklch(0.62 0.17 255); color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { color-scheme: dark; } }
:root[data-theme="dark"] { color-scheme: dark; }
html, body { min-height: 100dvh; }
body { padding-top: env(safe-area-inset-top); -webkit-tap-highlight-color: transparent; }
```

`layout.tsx` sets `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` via `export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: [...] }`, loads the fonts with `next/font/google`, and imports `katex/dist/katex.min.css`.

- [ ] **Step 3: App shell** — `src/components/app-shell.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Sun, Trophy } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:flex flex-col gap-1 border-r p-4">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm aria-[current=page]:bg-muted aria-[current=page]:font-medium">
            <n.icon className="size-4" />{n.label}
          </Link>
        ))}
        <div className="mt-auto"><ThemeToggle /></div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 lg:pb-8">
        {children}
      </main>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-background/90 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}
            className="flex h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground aria-[current=page]:text-foreground">
            <n.icon className="size-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

`theme-toggle.tsx` cycles system → light → dark, sets `document.documentElement.dataset.theme`, and persists the choice in `localStorage`, with the read and write wrapped in try/catch. `src/app/(app)/layout.tsx` wraps its children in `<AppShell>`. `(app)/page.tsx` redirects to `/today`. Create `(app)/stats`, `(app)/leaderboard`, and `(app)/library` pages that render "Coming soon".

- [ ] **Step 4: PWA** — `npm i @serwist/next serwist`. `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Daily Fundamentals", short_name: "Fundamentals", start_url: "/today", display: "standalone",
    background_color: "#0b0b0f", theme_color: "#0b0b0f",
    icons: [{ src: "/icons/192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}
```

`src/app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst, Serwist } from "serwist";
declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: any };
new Serwist({
  precacheEntries: self.__SW_MANIFEST, skipWaiting: true, clientsClaim: true,
  runtimeCaching: [{ matcher: ({ url }) => url.pathname === "/api/session", handler: new NetworkFirst({ cacheName: "session" }) }, ...defaultCache],
}).addEventListeners();
```

`next.config.ts`: `export default withSerwist({ swSrc: "src/app/sw.ts", swDest: "public/sw.js", disable: process.env.NODE_ENV === "development" })(nextConfig)`, with `withSerwist` from `@serwist/next`. Add `public/sw.js*` to `.gitignore`. Put `apple-touch-icon.png` (180px) and the 192/512/maskable icons in `public/icons`; generate placeholder icons with `npx pwa-asset-generator` from a simple SVG logo.

- [ ] **Step 5: Verify and commit**

Run: `npm run build` → succeeds. Run `npm start`, then open Chrome DevTools → Application → Manifest → "Installable" with no errors. Check the iPhone 14, iPad and 1280px viewports: bottom tabs on phone and tablet, sidebar at ≥1024px.

```bash
git add -A && git commit -m "feat: responsive app shell, theming, installable PWA"
```

---

### Task 10: Daily session UI

**Files:**
- Create: `src/components/math.tsx`, `src/components/study-card.tsx`, `src/app/(app)/today/page.tsx`, `src/app/(app)/today/session-client.tsx`

**Interfaces:**
- Consumes: `GET /api/session` and `POST /api/answer` (shapes from Task 8)
- Produces: `/today`, with `data-testid` hooks for e2e: `prompt`, `flip`, `rate-1`…`rate-4`, `choice-<i>`, `math-input`, `submit`, `result`, `progress`, `done`

- [ ] **Step 1: KaTeX renderer** — `src/components/math.tsx`. Render text where `$...$` segments are inline math:

```tsx
import katex from "katex";
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return <>{parts.map((p, i) => p.startsWith("$") && p.endsWith("$")
    ? <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }) }} />
    : <span key={i}>{p}</span>)}</>;
}
```

- [ ] **Step 2: Session client** — `session-client.tsx` (client component):

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StudyCard, type SessionCard } from "@/components/study-card";

type Item = { kind: "review" | "new" | "drill"; card: SessionCard };

export function SessionClient() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/session").then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((d) => setItems(d.items)).catch(() => setError("Couldn't load today's session. Pull to retry."));
  }, []);
  if (error) return <p role="alert" className="py-24 text-center text-muted-foreground">{error}</p>;
  if (!items) return <div className="mx-auto mt-16 h-80 max-w-xl animate-pulse rounded-3xl bg-muted" />;
  if (i >= items.length) return (
    <div data-testid="done" className="py-24 text-center">
      <h2 className="text-2xl font-semibold">All done for today 🎉</h2>
      <p className="mt-2 text-muted-foreground">{items.length ? `${items.length} cards reviewed.` : "Nothing due — come back tomorrow."}</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted" data-testid="progress" aria-valuenow={i} aria-valuemax={items.length} role="progressbar">
        <motion.div className="h-full bg-[var(--accent-brand)]" animate={{ width: `${(i / items.length) * 100}%` }} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={items[i].card.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
          <StudyCard card={items[i].card} kind={items[i].kind} onDone={() => setI((x) => x + 1)} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
```

`today/page.tsx` renders `<SessionClient />` under an `<h1>` titled "Today".

- [ ] **Step 3: StudyCard** — `src/components/study-card.tsx`. Behavior:
  - **Flashcard:** the prompt is shown with a "Show answer" button (`flip`) or Space. After flipping, the answer and four rating buttons appear (`rate-1..4`, keys 1–4).
  - **MCQ:** the choices are buttons (`choice-i`). Clicking one submits it.
  - **Math:** an `<input inputMode="text">` (`math-input`) with a live KaTeX preview, submitted by Enter or `submit`.
  - **free_text:** a textarea plus submit, then a self-rate result.
  - **Results:** a `graded` result shows correct/incorrect, the reference answer, the feedback and the citation, plus a "Next" button. A `self_rate` result shows its reason and the four rating buttons, which re-post with `{kind: "rating"}` under a **new** `clientAnswerId`.
  - Each submission generates its `clientAnswerId` once (`useRef(crypto.randomUUID())`), and buttons are disabled while a request is in flight.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { RichText } from "./math";
import { Button } from "./ui/button";

export type SessionCard = { id: string; type: "flashcard" | "mcq" | "free_text" | "math"; prompt: string;
  answer: string; choices: string[] | null; citation: string | null };
type Result = { status: "graded"; correct: boolean; feedback?: string } | { status: "self_rate"; reason: string };

const RATINGS = [["Again", 1], ["Hard", 2], ["Good", 3], ["Easy", 4]] as const;

export function StudyCard({ card, onDone }: { card: SessionCard; kind: string; onDone: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const started = useRef(Date.now());
  const answerId = useRef(crypto.randomUUID());

  async function send(response: object, fresh = false) {
    if (busy) return;
    setBusy(true);
    if (fresh) answerId.current = crypto.randomUUID();
    try {
      const r = await fetch("/api/answer", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, clientAnswerId: answerId.current, response, responseMs: Date.now() - started.current }) });
      const data: Result = await r.json();
      if (card.type === "flashcard" || fresh) onDone(); else setResult(data);
    } finally { setBusy(false); }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (card.type === "flashcard" && !flipped && e.code === "Space") { e.preventDefault(); setFlipped(true); }
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && ((card.type === "flashcard" && flipped) || result?.status === "self_rate"))
        send({ kind: "rating", rating: n }, result?.status === "self_rate");
      if (e.key === "Enter" && result?.status === "graded") onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ratingRow = (fresh: boolean) => (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(([label, n]) => (
        <Button key={n} data-testid={`rate-${n}`} variant="outline" className="h-12" disabled={busy}
          onClick={() => send({ kind: "rating", rating: n }, fresh)}>{label}<span className="ml-1 hidden text-xs opacity-50 lg:inline">{n}</span></Button>
      ))}
    </div>
  );

  return (
    <article className="rounded-3xl border bg-card p-6 shadow-sm md:p-10">
      <p data-testid="prompt" className="font-serif text-xl leading-relaxed md:text-2xl"><RichText text={card.prompt} /></p>
      <div className="mt-8 space-y-4">
        {card.type === "flashcard" && !flipped && <Button data-testid="flip" className="h-12 w-full" onClick={() => setFlipped(true)}>Show answer</Button>}
        {card.type === "flashcard" && flipped && (<><div className="rounded-xl bg-muted p-4"><RichText text={card.answer} /></div>{ratingRow(false)}</>)}
        {card.type === "mcq" && !result && card.choices?.map((c, i) => (
          <Button key={c} data-testid={`choice-${i}`} variant="outline" className="h-auto min-h-12 w-full justify-start whitespace-normal py-3 text-left" disabled={busy}
            onClick={() => send({ kind: "choice", choice: c })}><RichText text={c} /></Button>))}
        {(card.type === "math" || card.type === "free_text") && !result && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ kind: "text", text }); }}>
            {card.type === "math"
              ? <input data-testid="math-input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 2x + 1"
                  className="h-12 w-full rounded-xl border bg-background px-4 font-mono text-base" autoCapitalize="off" autoCorrect="off" />
              : <textarea data-testid="math-input" value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-xl border bg-background p-4 text-base" />}
            {card.type === "math" && text && <div className="text-muted-foreground"><RichText text={`$${text}$`} /></div>}
            <Button data-testid="submit" className="h-12 w-full" disabled={busy || !text.trim()}>Check</Button>
          </form>)}
        {result && (
          <div data-testid="result" className="space-y-4">
            {result.status === "graded"
              ? <p className={result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{result.correct ? "Correct" : "Not quite"}{result.feedback ? ` — ${result.feedback}` : ""}</p>
              : <p className="text-muted-foreground">{result.reason}</p>}
            <div className="rounded-xl bg-muted p-4"><RichText text={card.answer} />{card.citation && <p className="mt-2 text-xs text-muted-foreground">{card.citation}</p>}</div>
            {result.status === "graded" ? <Button className="h-12 w-full" onClick={onDone}>Next</Button> : ratingRow(true)}
          </div>)}
      </div>
    </article>
  );
}
```

Note: the math input uses `text-base` (16px) so iOS Safari doesn't zoom in on focus.

- [ ] **Step 4: Verify manually**

Run `docker compose up -d && npm run db:seed && npm run dev`, then dev-login and complete one card of each type on desktop and in the DevTools iPhone viewport.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: daily session UI with flashcard, mcq, math, free text"
```

---

### Task 11: Starter content seed

**Files:**
- Create: `src/db/seed.ts`, `src/db/seed-data.ts`

**Interfaces:**
- Produces: `npm run db:seed`, which is idempotent (skips a topic that already exists by name+track). It seeds at least 4 topics (Linear Algebra, Probability, Calculus, ML Fundamentals) × 8 cards, mixing all 4 types and difficulties 1–3.

- [ ] **Step 1: Seed data** — `src/db/seed-data.ts` (excerpt; write all 32 cards in this shape, each with a correct answer you have checked):

```ts
export const SEED = [
  { topic: "Calculus", track: "ml-engineer", cards: [
    { type: "math", prompt: "Differentiate $f(x) = x^3 + 2x$", answer: "3*x^2 + 2", difficulty: 1 },
    { type: "math", prompt: "Compute $\\int_0^1 2x\\,dx$", answer: "1", difficulty: 1 },
    { type: "mcq", prompt: "The derivative of $\\sigma(x)$ (sigmoid) is…", choices: ["$\\sigma(x)(1-\\sigma(x))$", "$\\sigma(x)^2$", "$1-\\sigma(x)$", "$e^{-x}$"], answer: "$\\sigma(x)(1-\\sigma(x))$", difficulty: 2 },
    { type: "flashcard", prompt: "State the chain rule.", answer: "$(f\\circ g)'(x) = f'(g(x))\\,g'(x)$", difficulty: 1 },
  ]},
  { topic: "Probability", track: "ml-engineer", cards: [
    { type: "math", prompt: "A fair die is rolled twice. $P(\\text{sum}=7)$?", answer: "1/6", difficulty: 1 },
    { type: "flashcard", prompt: "Bayes' theorem?", answer: "$P(A|B) = \\frac{P(B|A)P(A)}{P(B)}$", difficulty: 1 },
    { type: "mcq", prompt: "Variance of Bernoulli($p$)?", choices: ["$p$", "$p(1-p)$", "$p^2$", "$1-p$"], answer: "$p(1-p)$", difficulty: 1 },
  ]},
  // Linear Algebra, ML Fundamentals …
] as const;
```

- [ ] **Step 2: Seed script** — `src/db/seed.ts`:

```ts
import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { cards, topics } from "./schema";
import { SEED } from "./seed-data";

for (const t of SEED) {
  const [exists] = await db.select().from(topics).where(and(eq(topics.name, t.topic), eq(topics.track, t.track)));
  if (exists) continue;
  const [topic] = await db.insert(topics).values({ name: t.topic, track: t.track }).returning();
  await db.insert(cards).values(t.cards.map((c) => ({ ...c, choices: "choices" in c ? [...c.choices] : null, topicId: topic.id, source: "user" as const })));
  console.log(`seeded ${t.topic}: ${t.cards.length} cards`);
}
process.exit(0);
```

- [ ] **Step 3: Verify the math answers.** With the sidecar running, post each math card's answer against itself and check that every one returns correct:

```bash
npx tsx -e 'import {SEED} from "./src/db/seed-data"; for (const t of SEED) for (const c of t.cards) if (c.type==="math") fetch("http://localhost:8001/check",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expected:c.answer,given:c.answer})}).then(r=>r.json()).then(r=>console.log(r.correct, c.answer))'
```

Expected: every line starts with `true`.

- [ ] **Step 4: Run** `npm run db:seed` twice. The first run prints the seeded topics; the second prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/db/seed.ts src/db/seed-data.ts && git commit -m "feat: starter content seed"
```

---

### Task 12: End-to-end tests across devices

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/session.spec.ts`

**Interfaces:**
- Consumes: the dev-login, `/today` and test IDs from Task 10.

- [ ] **Step 1: Config**

```ts
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  webServer: { command: "npm run dev", url: "http://localhost:3000/signin", reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: "http://localhost:3000" },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 14"] } },
    { name: "ipad", use: { ...devices["iPad Pro 11"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
});
```

- [ ] **Step 2: Test**

```ts
import { expect, test } from "@playwright/test";

async function login(page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("dev email").fill(email);
  await page.getByRole("button", { name: "Dev login" }).click();
  await page.waitForURL("**/today");
}

test("signed-out users are redirected to sign in", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/signin/);
});

test("complete the first card and advance", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}-${Date.now()}@local.test`);
  await expect(page.getByTestId("prompt")).toBeVisible();
  const first = await page.getByTestId("prompt").textContent();
  if (await page.getByTestId("flip").isVisible()) {
    await page.getByTestId("flip").click();
    await page.getByTestId("rate-3").click();
  } else if (await page.getByTestId("choice-0").isVisible()) {
    await page.getByTestId("choice-0").click();
    await page.getByRole("button", { name: "Next" }).click();
  } else {
    await page.getByTestId("math-input").fill("0");
    await page.getByTestId("submit").click();
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByTestId("prompt")).not.toHaveText(first!);
});

test("navigation adapts to screen size", async ({ page }, info) => {
  await login(page, `nav-${info.project.name}-${Date.now()}@local.test`);
  const tabs = page.getByRole("navigation", { name: "Primary" });
  if (info.project.name === "desktop") await expect(tabs).toBeHidden();
  else await expect(tabs).toBeVisible();
});

test("no horizontal scroll", async ({ page }, info) => {
  await login(page, `scroll-${info.project.name}-${Date.now()}@local.test`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
```

Note: iPad Pro 11 in portrait is 834px wide (below `lg`), so it shows the bottom tabs. That's intended.

- [ ] **Step 3: Run**

```bash
npx playwright install chromium webkit
docker compose up -d && npm run db:seed && npm run e2e
```

Expected: 12 passed (4 tests × 3 projects).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e && git commit -m "test: e2e session flow on iPhone, iPad, desktop"
```

---

## Done criteria for Plan 1

- `npm test`, `cd sidecar && .venv/bin/pytest`, and `npm run e2e` are all green.
- `npm run build` succeeds, and the app is installable (manifest + service worker).
- A dev user can sign in on phone, tablet and laptop and complete a seeded daily session.
