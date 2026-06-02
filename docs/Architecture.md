# Atlas LMS — Architecture

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) + React 19 | Ported from prototype |
| AI runtime | Vercel AI SDK v6 (`streamText`, typed tools, multi-step) | Ported |
| Models | Provider-abstracted; paid-capable defaults via env | **Fixed:** prototype shipped `:free` models with no SLA |
| DB | PostgreSQL 16 + pgvector | Atlas is the **source of truth** (read-write), not a Canvas mirror |
| ORM / migrations | **Drizzle ORM** | **Fixed:** prototype created tables lazily at request time |
| Auth | **Auth.js (NextAuth v5)** + Drizzle adapter | **Fixed:** prototype had no auth at all |
| Tenancy | Shared DB, `org_id` on every domain row, app-layer scoping | RLS is a planned hardening step |
| UI | Tailwind v4, Radix, Framer Motion | Ported |

> Architecture Decision Records for the four "Fixed" items live at the bottom of this doc.

---

## System shape

```
                     ┌──────────────────────────────────────────────┐
  Browser  ─────────▶│  Next.js App Router                          │
  (student /         │   /(marketing)      public landing            │
   instructor)       │   /(app)/student    student desk (gen-UI)     │
                     │   /(app)/teach      authoring canvas (gen-UI) │
                     │   /api/chat         persona-aware agent       │
                     └───────────────┬──────────────────────────────┘
                                     │  session = { userId, orgId, role }
                     ┌───────────────▼──────────────────────────────┐
                     │  Agent loop (streamText, ≤8 steps)            │
                     │   1. setWorkspaceDecision  (validated)        │
                     │   2. typed tools (parameterized SQL/Drizzle)  │
                     │        • student-tools  (read, scoped)        │
                     │        • instructor-tools (write → proposals) │
                     └───────────────┬──────────────────────────────┘
                                     │
                     ┌───────────────▼──────────────────────────────┐
                     │  Postgres 16 + pgvector  (org-scoped)         │
                     │   Academic core · Alignment Graph ·           │
                     │   Change proposals · AI runtime · Auth        │
                     └──────────────────────────────────────────────┘
```

---

## The generative-UI engine (`lib/workspace/`)

This is the prototype's best idea, carried forward and extended. The agent cannot freely draw UI. It must first call `setWorkspaceDecision` and emit a structured plan:

```
goal · focus · view · panels[] · actions[] · reason · evidence[]
```

`validation.ts` checks that plan against `VIEW_RULES`: only registered views, panels only in their allowed slots, only allowed actions per view. The frontend `reducer.ts` folds the streamed tool outputs into view state and renders **only registered layouts/panels**. The model orchestrates the UI; it can never inject an unsafe or unknown one.

**What we added:** the prototype only had student _planning_ views (`todayDesk`, `weekMap`, `assignmentFocus`, …). Atlas extends the same contract to two personas:

- **Student views:** `todayDesk`, `weekMap`, `assignmentFocus`, `coursePulse`, `studySession` (grounded tutor), `objectiveCoverage` (alignment to syllabus).
- **Instructor views:** `courseBuilder`, `syllabusComposer`, `assessmentBuilder`, `gradingDesk`, `classInsights`, `objectiveMap`.

A "trusted generative UI for authoring an LMS" is, as far as we know, novel.

---

## The Alignment Graph (the new IP)

The tables that make Atlas more than a chat wrapper:

- `learning_objectives` — course/module objectives (with Bloom level), agent- or human-authored.
- `program_outcomes` — accreditation/program-level outcomes.
- `objective_outcome_map` — objectives → program outcomes (many-to-many).
- `content_alignments` — any content item (module, assignment, quiz, page, file) → objective, with weight.

From this graph we compute: student coverage vs. assessed weight, professor coverage gaps, and accreditation evidence — all as queries, not manual spreadsheets.

---

## Human-in-the-loop authoring

Agent _write_ actions never mutate the course directly. They produce a **`change_proposal`** (a structured diff + summary) that the instructor reviews, edits, and approves. Only on approval is it applied. This keeps the professor in control and creates an audit trail — essential for institutional trust.

---

## Multi-tenancy & auth

- Every domain row carries `org_id`. Every tool resolves the tenant from the session and scopes its queries — no global reads (the prototype read the entire DB unscoped).
- Sessions are issued by Auth.js and carry `{ userId, orgId, role }`. `role ∈ {superadmin, admin, instructor, ta, student}`.
- `requireUser()` / `requireRole()` guard server actions, routes, and tools. Write tools additionally check the actor's role on the specific course (via `enrollments`).
- Memory and chat sessions are **per-user** (the prototype shared two hardcoded chat IDs across all visitors).

---

## Architecture Decision Records

**ADR-001 — Drizzle for schema & migrations.** The prototype ran `CREATE TABLE IF NOT EXISTS` / `ALTER` at request time. Products need versioned, reviewable migrations and typed queries. Drizzle keeps us close to SQL while giving both. _Trade-off:_ a build step; acceptable.

**ADR-002 — Auth.js over a managed vendor (e.g. Clerk).** Institutions will demand SAML/SSO and LTI; we need to own the auth layer and avoid per-seat vendor cost at university scale. _Trade-off:_ more code now; strategically necessary.

**ADR-003 — App-layer tenancy now, RLS later.** Per-row `org_id` + scoped queries ships fast and is debuggable. Postgres Row-Level Security is a hardening milestone before first paid institution.

**ADR-004 — 1536-dim embeddings.** The prototype used a 2048-dim model that _cannot_ be indexed by pgvector (ivfflat/hnsw cap at 2000 dims) and mismatched its own 1536 columns. We standardize on 1536 so content/memory vectors are HNSW-indexable from day one.

> These four are the biggest reversible-but-load-bearing choices. Flag early if you'd steer differently.
