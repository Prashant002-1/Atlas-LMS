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
- Direct record actions: instructors can publish draft weeks/work, and students submit written practice responses tied to aligned work.
- MVP contract tests cover required routes, links/redirects, direct record actions, and row detail fields.
- Active GitHub Actions CI runs lint, typecheck, schema push, tests, and build against Postgres.

Remaining before an institutional pilot:
- Real org creation, invite flow, and admin setup.
- Middleware/route-group hardening as the app surface expands beyond the current teaching/study pages.
- Migration-based CI once Drizzle migrations are committed instead of schema push.

## Phase 2 — Student experience
- Current: DB-backed study view with actionable focus objective, aligned published material, grounded practice, written response submission, work, evidence, standing, and empty/unavailable states.
- Current: practice can draw from a course-level practice base, so the task references a professor-provided dataset/problem frame instead of generic textbook phrasing.
- Next: render the planning views (`todayDesk`, `weekMap`, `assignmentFocus`) from the validated course-view contract.
- `studySession` view: grounded tutor (RAG over course content embeddings, Socratic prompting, citations)
- `objectiveCoverage` view: the "am I aligned to the syllabus?" coverage meter
- Per-user memory + planner, scoped

## Phase 3 — Instructor authoring
- Current: DB-backed teaching view with week and work rows, live objective coverage from alignments, course gaps, Review, recent decisions, outline drafting, week/work publishing, and module/assignment/objective/outline apply/dismiss.
- Current: teaching view shows the active practice base alongside the course map, framing how future practice variants should be generated from professor-owned data.
- Next: richer teaching composers for `courseBuilder` / `syllabusComposer` / `assessmentBuilder`.
- Next: persist editable practice bases per course/objective, including dataset variables, concept alignment, variant families, and review state.
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
