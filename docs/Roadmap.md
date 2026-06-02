# Atlas LMS — Roadmap (demo → product)

Sequenced so each phase unlocks the next. Auth + tenancy first, because everything else depends on knowing _who_ and _which org_.

## Phase 0 — Foundation ✅ (this commit)
- Product thesis, architecture, ADRs (`docs/`)
- Drizzle schema: academic core + Alignment Graph + auth + AI runtime, org-scoped
- Auth.js scaffolding; session carries `{ userId, orgId, role }`
- Generative-UI engine ported + extended to instructor personas
- Agent split: student (read) + instructor (write-as-proposal) tools, persona-aware `/api/chat`
- Provider with real models + fallback; 1536-dim embeddings
- Infra: Dockerfile, compose, CI, `.env.example`, drizzle config

## Phase 1 — Walking skeleton (auth + tenancy live)
- Wire Auth.js adapter end-to-end: sign-up, sign-in, org creation, invite flow
- `middleware.ts` route protection; role-gated layouts
- Seed script: demo org + instructor + student + one course
- `db:migrate` in CI against an ephemeral Postgres

## Phase 2 — Student experience (port + ground)
- Student desk UI: render the ported planning views (`todayDesk`, `weekMap`, `assignmentFocus`)
- `studySession` view: grounded tutor (RAG over course content embeddings, Socratic prompting, citations)
- `objectiveCoverage` view: the "am I aligned to the syllabus?" coverage meter
- Per-user memory + planner, scoped

## Phase 3 — Instructor authoring (the wedge magic)
- Authoring canvas UI for `courseBuilder` / `syllabusComposer` / `assessmentBuilder`
- Change-proposal review/approve/apply flow with diffs
- Objective definition + auto-alignment tooling (`objectiveMap`)
- **One-click Canvas import** (repurpose the prototype parser) → restructure → align

## Phase 4 — Trust, scale, compliance
- Postgres RLS (ADR-003 hardening)
- Accessibility checks at authoring time (WCAG)
- Background jobs for embedding/backfill (off the request path); rate limiting; audit logs
- Observability (tracing on the agent loop, cost dashboards)
- Accreditation evidence export from the Alignment Graph

## Phase 5 — Go-to-market surface
- SSO (SAML/OIDC) + LTI 1.3 for institutional pilots
- Grading desk (rubric-grounded, human-in-the-loop)
- At-risk early-warning for advisors

---

### Cut lines / non-goals (for now)
- Native mobile apps (responsive web first)
- Synchronous video/conferencing (integrate, don't build)
- Proctoring (partner, don't build)
