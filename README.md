# Atlas LMS

Atlas is a course record for teaching and study. Objectives, modules, assignments, submissions, proposals, and evidence share one model, so professors can shape a course and students can study from the same record.

Start with the product context in [`PRODUCT.md`](PRODUCT.md), then read [`docs/Brand.md`](docs/Brand.md) for brand direction, [`docs/DesignSystem.md`](docs/DesignSystem.md) for UI rules, [`docs/Vision.md`](docs/Vision.md) for the broader thesis, and [`docs/Architecture.md`](docs/Architecture.md) for the system shape.

---

## Why Atlas Exists

Today, professors lose time to course mechanics: building module trees, aligning assignments, copying term structure forward, and proving coverage after the fact. Students study from material scattered across the LMS, notes, and outside tools, then guess whether they covered what will be assessed.

Atlas makes course intent explicit:

| Persona | Today | With Atlas |
|---|---|---|
| Professor | Course structure, objectives, and assessments drift apart | One command line: state an intent, review the drafted blocks, apply. The record stays yours. |
| Student | Material and assessed work feel disconnected | Study from the course record: cues on every record (Explain, Practice, Ask), shaped by the professor's policy. |

The connective tissue is the Alignment Graph: every objective, module, assignment, submission, and study action ties back to course intent. That structured record is also the context the agent runs on — Atlas is not a chatbot bolted onto an LMS; the context layer is the product.

---

## How the agent works

One runtime (`lib/agent/`), two surfaces, one doctrine — reactive on command, propose never perform, grounded in the record:

- **Context packs** (`context.ts`) — a deterministic, budgeted rendering of the course record (objectives, modules, work, pages, notes, work-state), every line traceable to a row. Same course state, same pack.
- **Sessions** (`session.ts`) — persistent and anchored (the command bar resumes per course; each student cue threads to the record it was pressed on), with rolling compaction that preserves record ids verbatim.
- **Blocks** (`blocks.ts`) — the generative-UI contract. The agent never draws UI; it emits typed blocks (objective, module, assignment, page, announcement, practice set, rubric, explanation, answer) validated against one zod registry. The client renders blocks through one component map (`components/agent/block-views.tsx`); proposals persist blocks as rows (`proposal_blocks`) and re-render from the DB.
- **Apply** (`apply.ts`) — the only door from draft to live. Approving a proposal writes course rows in one transaction and stamps each block with what it created; dismissing closes it. Nothing the agent does mutates the course before that.
- **Policy** (`course_ai_policies`) — the professor's control object: which student cues exist, how deep explanations go, citation requirements, a per-course voice, standing instructions, daily limits, and the opt-in class signal. `/teach/atlas` is the control panel.
- **BYOK** (`keys.ts`) — each org attaches its own OpenRouter/OpenAI key (AES-256-GCM at rest, masked in the UI, resolved server-side per request), with the platform env key as fallback.

Two streaming routes carry all of it: `/api/agent/command` (professor: one intent → one proposal of typed blocks, streamed live) and `/api/agent/cue` (student: one button press → one grounded, policy-shaped response).

---

## What runs now

Everything is behind sign-in — there is no public surface.

- `/` — routes to your workspace by role.
- `/sign-in`, `/sign-up` — auth. Accounts are provisioned (or seeded).
- `/teach` — the teaching record: Atlas command line, Review (typed blocks, apply/dismiss), Publish queue, Students, Map.
- `/teach/atlas` — course AI policy + org model key.
- `/student` — the study record: today, policy-gated cues, practice, material, work, coverage.
- Record pages (`/teach/week/…`, `/teach/work/…`, `/student/material/…`, `/student/work/…`) with cues anchored to the record in view.
- `/api/health` — database health check.

A semester picker in the header moves any account between terms (testing and real rollover); courses hang off terms.

## Repo Shape

```
app/                      Next.js 16 App Router (auth + workspaces + agent API)
  page.tsx                Role router (no public surface)
  sign-in/ sign-up/       Auth
  teach/                  Teaching record (+ /teach/atlas policy & keys)
  student/                Study record
  api/agent/command/      Professor command surface (streaming)
  api/agent/cue/          Student cue surface (streaming)
middleware.ts             Session gate for every route
lib/
  agent/                  The runtime: blocks, context packs, sessions, apply, keys, runtime
  db/schema.ts            Drizzle schema: academic core, Alignment Graph, terms, AI runtime
  db/fixtures/            The shared demo data package (3 semesters, 9 courses)
  db/seed.ts              Deterministic seed from the package
  auth/                   Auth.js (sessions carry userId, orgId, role)
  instructor/             Teaching record loaders + actions (apply/dismiss, policy, keys)
  student/                Study record loaders + actions
  workspace/              Term/course scope + product contract tests
components/
  agent/                  Block registry views, command composer, cue panel
  atlas/                  Shell and primitives
docs/                     Brand, DesignSystem, Vision, Architecture, Roadmap
.github/workflows/ci.yml  Verification on pull requests and main
```

---

## Quickstart

### Prerequisites
- Node.js 20+
- Docker (for local Postgres + pgvector)

### Setup
```bash
# 1. Start Postgres 16 + pgvector
docker compose up -d db

# 2. Install deps
npm install

# 3. Configure environment
cp .env.example .env.local
#    Fill in DATABASE_URL and AUTH_SECRET. A platform model key is optional —
#    you can instead attach an org key in-app (/teach/atlas) after signing in.

# 4. Create the schema (Drizzle is the source of truth)
npm run db:push

# 5. Seed the shared demo data package
npm run db:seed

# 6. Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you land on sign-in.

### The demo data package

Every developer seeds the same deterministic package: Demo University across three semesters (Fall 2025, Spring 2026, and the current Summer 2026), nine full courses with objectives, week-by-week modules, assignments, pages, announcements, rosters, submissions, grades, and per-course AI policies. Same stable UUIDs in every environment; re-seeding is idempotent and touches only the demo tenant.

Canonical accounts (password `atlas1234` for every seeded account):
- `instructor@demo.edu` — Prof. Alan Torres. Teaches STAT-201 (the flagship: grading queue, missing work, draft weeks to publish) and STAT-405 now; taught STAT-201 in Fall 2025.
- `student@demo.edu` — Maya Patel. Four current courses with a real story: strong in HIST-310 (which speaks as "The Archivist" — course personas are policy), a sampling-distributions misconception in STAT-201, a missing CS-152 assignment, ungraded WRIT-105 work.

---

## Verification

```bash
npm run verify

# With the dev server running:
npm run smoke
```

`npm run verify` runs typecheck, lint, tests, and a production build. Tests include the product contract (routes exist, every surface is gated, the agent observes the doctrine, blocks stay a closed registry, policy reaches the runtime) and the fixture integrity checks (references resolve, the demo window falls inside the current term, archived terms are fully graded) — all without a database. `npm run smoke` checks the running app: signed-out redirects, auth pages, health, agent-route guards, and signed-in teaching/study pages.

## Status

The agentic core is in place: professors draft through the command line and review typed blocks; students work through policy-gated cues; everything the agent says is grounded in the course record and nothing goes live without approval. See [`docs/Roadmap.md`](docs/Roadmap.md) for what's next.

## License

Proprietary — © Atlas LMS. All rights reserved.
