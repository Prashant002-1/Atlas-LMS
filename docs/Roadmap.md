# Atlas LMS — Roadmap (local MVP → product)

Sequenced so each phase unlocks the next. Auth + tenancy first, because everything else depends on knowing _who_ and _which org_.

## Phase 0 — Foundation ✅ (this commit)
- Product thesis, architecture, ADRs (`docs/`)
- Drizzle schema: academic core + Alignment Graph + auth/runtime tables, org-scoped
- Auth.js scaffolding; session carries `{ userId, orgId, role }`
- Validated course-view contract with student and instructor personas
- Tool split: student reads course records; instructor writes reviewable proposals through `/api/chat`
- Provider configuration with paid-capable models; 1536-dim embeddings
- Infra: Dockerfile, compose, CI, `.env.example`, drizzle config

## Phase 1 — Local walking skeleton ✅
- Working route surface: `/`, `/sign-in`, `/sign-up`, `/teach`, `/student`, `/api/health`.
- Auth.js credential flow with role entry for seeded instructor/student accounts.
- Role-gated instructor and student pages; cross-role requests redirect to the correct route.
- Signed-out teaching/study requests redirect through the role entry path instead of exposing preview data.
- Seed script resets the local demo tenant with one org, instructor, student, course, objectives, modules, assignments, submission, and review item.
- DB-backed teaching/study pages; signed-in pages render real course data.
- Direct record actions: instructors can publish draft weeks/work, and students submit written responses tied to aligned work.
- MVP contract tests cover required routes, links/redirects, direct record actions, and row detail fields.
- Active GitHub Actions CI runs lint, typecheck, schema push, tests, and build against Postgres.

Remaining before an institutional pilot:
- Real org creation, invite flow, and admin setup.
- Middleware/route-group hardening as the app surface expands beyond the current teaching/study pages.
- Migration-based CI once Drizzle migrations are committed instead of schema push.

## Phase 2 — Student experience
- Current: DB-backed study view with actionable focus, latest course note, aligned published material, grounded practice, material-to-work detail flow, written response submission, missing recovery, waiting/done work state, evidence, standing, and empty/unavailable states.
- Current: practice draws from persisted course material so the task references a professor-provided dataset/problem frame before falling back.
- Current: student Atlas requests persist to the active course chat record, return a compact study package, reappear as recent study context, and follow into linked material/work records.
- Next: render the planning views (`todayDesk`, `weekMap`, `assignmentFocus`) from the validated course-view contract.
- `studySession` view: grounded tutor (RAG over course content embeddings, Socratic prompting, citations)
- `objectiveCoverage` view: the "am I aligned to the syllabus?" coverage meter
- Per-user memory + planner, scoped

## Phase 3 — Instructor authoring
- Current: DB-backed teaching view with week, work, and course-note rows, linked material on work records, live coverage from alignments, grading-first Today, missing-work recording, standing updates from graded work, Review, light generated-record edits, applied-record handoff, recent decisions, Today-owned Atlas command drafting, review-to-live publishing, queue publishing, and proposal dismiss.
- Current: common Atlas command requests become reviewable material/work drafts; explicit practice bases, concepts, and shifts persist into ordinary course records; unclear requests still persist as proposals.
- Next: route richer `courseBuilder` / `syllabusComposer` / `assessmentBuilder` outputs through the same command/proposal lane.
- Next: generate practice materials from professor-provided context without exposing separate authoring layers.
- Rich change-proposal diffs with edit-before-apply.
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
- Advisor views from explicit institution-defined criteria

---

### Cut lines / non-goals (for now)
- Native mobile apps (responsive web first)
- Synchronous video/conferencing (integrate, don't build)
- Proctoring integrations
