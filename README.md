# Atlas LMS

**The AI-native learning platform.** The agent isn't a feature bolted onto an LMS — it _is_ the LMS. It builds and runs courses for professors, and tutors students inside them, with every piece of content grounded in the professor's actual learning objectives.

> Canvas is a filing cabinet. Atlas is a partner — on both sides of the classroom.

---

## Why Atlas exists

Today, every university runs an **instructional-design center**: staff whose entire job is helping professors operate Canvas/Blackboard/Moodle — building modules, formatting syllabi, organizing content, wiring up assignments. That's headcount that exists only because the tools are hostile.

- **Professors** burn absurd amounts of time on course _mechanics_ instead of teaching.
- **Students** do all their real learning _outside_ the LMS — copy-pasting into ChatGPT and NotebookLM — disconnected from the syllabus. They never know if what they studied is what the professor actually wanted. Exams become surprises.

The current LMS _feels_ secure and entrenched. In an AI-fast world it's bloatware.

**Atlas changes both sides at once:**

| Persona | Today | With Atlas |
|---|---|---|
| **Professor** | Weeks wrestling Canvas + an ID center | "Build a 14-week stats course aligned to these 5 outcomes" → drafted syllabus, modules, assignments, rubrics. Professor curates, doesn't construct. |
| **Student** | Copy-paste to ChatGPT, hope it's relevant | A tutor _inside_ the course, grounded in the real material and syllabus. Always knows: "Is this what will be tested?" |

The connective tissue is the **Alignment Graph**: every objective, every piece of content, every study session is mapped to learning outcomes. That's the thing neither Canvas nor ChatGPT has — and the thing that makes "no surprises" real.

See [`docs/Vision.md`](docs/Vision.md) for the full thesis (problem, wedge, moat, why-now) and [`docs/Architecture.md`](docs/Architecture.md) for the system design.

---

## What's in this repo

This is the **product foundation** — the architecture and the spine, ported from the award-winning _Personal Canvas_ prototype and rebuilt to be multi-tenant, authenticated, read-write, and grounded in the Alignment Graph.

```
app/                      Next.js 16 App Router (marketing + authed app + API)
  api/chat/               Persona-aware agent endpoint (streamText + typed tools)
lib/
  db/schema.ts            Drizzle schema — academic core + Alignment Graph + auth + AI runtime
  auth/                   Auth.js (sessions carry userId, orgId, role)
  ai/
    provider.ts           Model config + fallback chain
    tools/student-tools.ts     Read tools, scoped to the signed-in student
    tools/instructor-tools.ts  Authoring tools (human-in-the-loop change proposals)
  workspace/              The generative-UI engine (decision → validation → reducer)
docs/                     Vision, Architecture, Roadmap
drizzle/                  Migrations
```

The **generative-UI engine** (`lib/workspace/`) is the crown jewel: the agent must emit a validated _decision_ (`goal / view / panels / actions / reason / evidence`) before it touches data. The frontend only renders registered layouts. We extended it from student planning views to **instructor authoring views** — a trusted generative UI for _building_ an LMS, not just consuming one.

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

# 5. Seed a demo org, an instructor, a student, and a course
npm run db:seed

# 6. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Status

> ⚠️ **Foundation, not finished.** This commit establishes the architecture, data model, auth, agent scaffolding, and infrastructure. The UI surfaces (authoring canvas, student desk) and full tool implementations are being built on top of it. See [`docs/Roadmap.md`](docs/Roadmap.md).

## License

Proprietary — © Atlas LMS. All rights reserved.
