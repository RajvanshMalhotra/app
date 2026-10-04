# Daily Fundamentals Trainer — Design Spec

Date: 2026-10-04
Status: Draft, awaiting review

## 1. Purpose

A public web app (installable PWA, app stores later) that keeps people sharp on fundamentals through short daily sessions of flashcards and quizzes. Users either enter topics or let the AI build a curriculum from their target role (e.g. ML Engineer) and resume. Users can upload book PDFs so questions are grounded in real sources. Stats show where a user is strongest and where they need polishing; an AI tutor answers follow-up questions; a live leaderboard adds motivation.

**Success criteria (v1)**
- A new user can sign up, set a target role, optionally upload a resume and books, and get a first daily session within minutes (seeded with fast-model cards while heavy generation runs in the background).
- A daily session takes 10–15 minutes and mixes due reviews, new cards, and weak-topic drills.
- Math answers are graded exactly (symbolic/numeric), not by an LLM.
- Daily sessions keep working when the HPC is offline.
- The UI looks polished on mobile and desktop.

## 2. Scope

**In v1:** accounts, curriculum generation, card generation (fast + heavy), PDF RAG, FSRS spaced repetition, math checking, stats dashboard, AI tutor chat, live leaderboard, admin page, vLLM setup on the HPC, Docker Compose deployment.

**Deferred to v2:** trending-interview-topic scraping (LeetCode Discuss etc.; must respect site terms of service), Capacitor wrappers for the App Store and Play Store, social features beyond the leaderboard.

## 3. Architecture

```
 Phone / Browser (PWA)
        │
   Next.js app (UI + API routes, auth)
        │
    Postgres + pgvector  ◄──►  Worker (pg-boss job queue)
                                   │
                     vLLM on HPC (OpenAI-compatible API)
                      ├─ heavy: DeepSeek R1
                      ├─ fast:  Qwen/Llama instruct (size chosen per GPU)
                      └─ embed: bge-m3
```

- **Frontend/API:** Next.js (App Router, TypeScript), Tailwind, shadcn/ui, Framer Motion. Auth.js with email magic links and Google.
- **Database:** Postgres with the pgvector extension; Drizzle ORM.
- **Worker:** Node/TypeScript process consuming pg-boss jobs. PDF extraction uses a small Python sidecar (PyMuPDF, with OCR fallback); math checking uses a Python SymPy sidecar. Both expose small HTTP endpoints inside the Compose network.
- **Deployment:** Docker Compose on the user's server (web, worker, postgres, python-sidecar, Caddy for TLS). The server reaches the HPC's vLLM over the network or an SSH/VPN tunnel; the address is set in env config.

### Units and responsibilities

| Unit | Does | Depends on |
|---|---|---|
| `scheduler` | FSRS scheduling; builds the daily session | db |
| `llm-gateway` | Routes a task to heavy/fast/embed via `models.config.ts`; retries, timeouts, JSON schema validation (zod) | vLLM |
| `generation` | Curriculum + card generation, quality filter | llm-gateway, rag |
| `rag` | PDF ingestion, chunking, embedding, retrieval | sidecar, llm-gateway, db |
| `grading` | Exact match / multiple choice / SymPy math / LLM grading for free text | sidecar, llm-gateway |
| `stats` | Per-topic accuracy, retention, streaks, weekly AI summary | db, llm-gateway |
| `tutor` | Streaming chat with card + weak-topic + RAG context | llm-gateway, rag |
| `leaderboard` | XP computation, boards, SSE live updates | db |

### Model routing (`models.config.ts`)

| Task | Model |
|---|---|
| Curriculum generation | heavy |
| Tricky questions (multi-step math, edge cases, interview-style) | heavy |
| Standard flashcards / MCQs | fast |
| Card quality check | fast |
| Free-text grading | fast |
| Tutor chat | fast |
| Weekly stats summary | fast |
| Embeddings | embed |

## 4. Data model

- `users`: id, email, display_name, target_role, resume_text, leaderboard_opt_in, timestamps
- `topics`: id, parent_id, name, track (e.g. "ml-engineer")
- `curricula`: id, user_id, ordered topic_ids, target_days, status
- `cards`: id, topic_id, owner_user_id (null = shared), type (`flashcard` | `mcq` | `free_text` | `math`), prompt, answer, choices, difficulty (1–5), source (`ai_fast` | `ai_heavy` | `book` | `user`), citation, quality_status, flag_count
- `reviews`: id, user_id, card_id, rating, correct, response_ms, FSRS state (stability, difficulty, due_at), created_at
- `documents`: id, user_id, title, status, is_shared (admin-approved only)
- `chunks`: id, document_id, section, page, text, embedding vector(1024)
- `xp_events`: id, user_id, topic_id, amount, created_at
- `jobs`: managed by pg-boss

## 5. Key flows

**Onboarding:** sign up → choose a target role and/or type topics → optionally upload a resume (PDF) and books. A `curriculum.generate` job runs on heavy; the user sees and can edit the topic list. Fast-model cards for the first topics are generated immediately so the first session is ready within minutes.

**Curriculum generation:** input = role + resume text + user topics. R1 returns a prioritised topic list (JSON, schema-validated), skipping or downweighting topics the resume shows as strong.

**Card generation:** pre-generate per topic in batches (target: 30 cards/topic). The fast model writes standard cards; R1 writes ~20% tricky cards. If a user's book covers the topic, retrieve the top-k chunks and require the model to cite section and page. Every card then passes a fast-model quality check (correct, unambiguous, answer matches); failures are discarded. Users can flag cards, and cards with 3 or more flags are hidden pending admin review.

**Daily session:** 10–15 minutes ≈ 20 items: due reviews first, then new cards from the current curriculum topic, then 3–5 drills from the user's weakest topics. Each answer is graded, FSRS state is updated, and an XP event is written.

**Grading:** MCQ and flashcards (self-rated Again/Hard/Good/Easy) are deterministic. `math` cards are checked by SymPy for symbolic equivalence or numeric tolerance. `free_text` cards are graded by the fast model against the reference answer, returning a score and feedback.

**PDF RAG ingestion:** upload → stored on disk/volume → sidecar extracts text per page (OCR fallback) → split by heading/section, ~800 tokens with overlap → embedded → `chunks`. Uploads are private to the uploader; sharing requires admin approval.

## 6. Stats, tutor, leaderboard

**Stats:** a mastery map (topic heatmap of retention × accuracy), streak, accuracy trend, and "needs polishing" (the bottom 3 topics, each with a Drill button). A weekly AI summary is generated by the fast model.

**Tutor:** a streaming chat (SSE) with context: the current card, the user's answer, their weak topics, and retrieved book chunks with citations. Rate limit: 30 messages/hour per user (configurable).

**Leaderboard:**
- XP = base 10 × difficulty multiplier (1.0–2.5) for correct answers.
- Answers faster than a minimum time earn nothing.
- Daily XP cap: 500.
- Boards: weekly (resets Monday 00:00 UTC) and all-time, each filterable by track and by topic.
- Live updates via SSE from a cached aggregate refreshed on each XP event.
- Users appear by display name only and can opt out of being shown.

## 7. Error handling

- **HPC unreachable:** sessions use pre-generated cards; generation jobs retry with exponential backoff; tutor and new generation show a "temporarily unavailable" message.
- **Invalid LLM output:** schema validation, 2 retries, then discard and log.
- **Failed jobs:** visible on an admin page with a retry button.
- **Uploads:** size limit 100 MB, PDFs only; failed ingestion is reported to the user.

## 8. Testing

- Unit tests: FSRS scheduler, XP scoring and caps, math checker, model routing, chunker.
- Integration tests run against a fake OpenAI-compatible LLM server (no HPC needed in CI).
- Playwright end-to-end tests: onboarding, daily session, tutor chat, leaderboard.

## 9. HPC setup (part of v1)

- vLLM serving three OpenAI-compatible endpoints: heavy (DeepSeek R1 or an R1 distill, sized to the available GPUs), fast (Qwen2.5/Llama instruct), and embed (bge-m3).
- Exact models are chosen once the GPU type and count are known.
- Exposed to the app server over a secured tunnel with API-key auth.

## 10. Open items

- GPU type and count on the HPC (decides model sizes).
- Domain name for deployment.
- App name.
