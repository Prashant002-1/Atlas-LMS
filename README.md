# Atlas LMS

Atlas is a course record for teaching and study. Objectives, modules, assignments, submissions, proposals, and evidence share one model, so professors can shape a course and students can study from the same record.

Start with the product context in [`PRODUCT.md`](PRODUCT.md), then read [`docs/Brand.md`](docs/Brand.md) for brand direction, [`docs/DesignSystem.md`](docs/DesignSystem.md) for UI rules, [`docs/Vision.md`](docs/Vision.md) for the broader thesis, and [`docs/Architecture.md`](docs/Architecture.md) for the system shape.

---

## Why Atlas Exists

Today, professors lose time to course mechanics: building module trees, aligning assignments, copying term structure forward, and proving coverage after the fact. Students study from material scattered across the LMS, notes, and outside tools, then guess whether they covered what will be assessed.

Atlas makes course intent explicit:

| Persona | Today | With Atlas |
|---|---|---|
| Professor | Course structure, objectives, and assessments drift apart | Review one course record: weeks, work, objectives, coverage, and drafted changes. |
| Student | Material and assessed work feel disconnected | Study from the course record: focus objective, source material, practice, response, and coverage. |

The connective tissue is the Alignment Graph: every objective, module, assignment, submission, and study action can be tied back to the course intent.

---

## What runs now

This repo now includes a working local MVP surface:

- `/` — product overview with a live course preview.
- `/sign-in` — role entry for teaching or study.
- `/sign-up` — one-course start surface.
- `/teach` — teaching view with modules, work, objective coverage, review, outline drafting, publish, and recent decisions.
- `/student` — study view with focus objective, Atlas package request, aligned material, practice response, work, evidence, and standing.
- `/api/health` — database health check.

Workspace routes redirect signed-out visitors to the matching role entry path.

The local seed creates one organization, one instructor, one student, one course, four objectives, four modules, two assignments, one graded submission, and one pending review item.

## Repo Shape

```
app/                      Next.js 16 App Router (marketing + authed app + API)
  page.tsx                Overview
  sign-in/                Role-based access
  sign-up/                Course start
  teach/                  Teaching view
  student/                Study view
  api/chat/               Persona-aware course endpoint
lib/
  db/schema.ts            Drizzle schema: academic core, Alignment Graph, auth, runtime
  auth/                   Auth.js (sessions carry userId, orgId, role)
  ai/
    provider.ts           Model config
    tools/student-tools.ts     Read tools, scoped to the signed-in student
    tools/instructor-tools.ts  Authoring tools that create reviewable changes
  instructor/             DB-backed teaching record + review actions
  student/                DB-backed study record + response actions
  workspace/              Workspace decision contract + route-contract tests
components/atlas/         Shared shell and primitives
docs/                     Brand, DesignSystem, Vision, Architecture, Roadmap
.github/workflows/ci.yml  Verification on pull requests and main
```

`lib/workspace/` holds the decision contract used by product surfaces and tools. Views, panels, actions, and evidence are registered explicitly so course state renders through known layouts instead of arbitrary UI.

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
#    Fill in DATABASE_URL, AUTH_SECRET, and a model provider key.

# 4. Create the schema (Drizzle is the source of truth)
npm run db:push

# 5. Reset and seed the local demo tenant
npm run db:seed

# 6. Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local access:
- Use the Instructor or Student button on `/sign-in`.
- Manual credentials are still available for direct auth checks:
  - `instructor@demo.edu` / `atlas1234`
  - `student@demo.edu` / `atlas1234`

`npm run db:seed` deletes and recreates only the local demo tenant. The seeded course starts with four objectives, a source-backed module map, one graded student submission, and one pending teaching review item.

---

## Verification

```bash
npm run verify

# With the dev server running:
npm run smoke
```

`npm run verify` runs typecheck, lint, tests, and a production build. `npm run smoke` checks the local routes, public page copy, custom 404, health, signed-out redirects, and signed-in teaching/study pages against `http://localhost:3000`; set `ATLAS_BASE_URL` to point it at a different host.

`npm test` includes an MVP contract check so required routes exist, internal links/redirects target implemented routes, core record actions stay wired, and DB-backed row details stay surfaced.

## Status

Atlas is still early, but the local MVP is runnable: the core routes render, the seeded teaching/study flows are DB-backed, protected routes go through role entry, signed-in pages render real course data, teaching can draft/review/apply course changes, and study connects focus, package requests, material, response, work, and evidence from the course record. See [`docs/Roadmap.md`](docs/Roadmap.md) for the larger product path.

## License

Proprietary — © Atlas LMS. All rights reserved.
