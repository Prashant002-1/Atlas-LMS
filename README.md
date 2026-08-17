# Atlas LMS

Atlas is an LMS rebuilt around teacher-governed AI. The active product direction is in [`docs/README.md`](docs/README.md).

## Quickstart

For a brand-new checkout with an empty database volume:

```bash
docker compose up -d db
npm install
cp .env.example .env.local
npm run db:push -- --force
npm run db:upgrade -- --allow-destructive
npm run workflow:bootstrap
npm run db:seed
npm run local:check
npm run dev
```

`db:push` is only the empty-database initializer. For an existing local
database, use the managed upgrade path instead:

```bash
docker compose up -d db
npm install
npm run db:upgrade
npm run workflow:bootstrap
npm run local:check
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The demo accounts use password `atlas1234`:

- `instructor@demo.edu`
- `student@demo.edu`

## Verification

```bash
npm run verify

# With the dev server running:
npm run smoke
```

## Current State

The v0 loop is implemented: professor configuration, student session, evidence-verified grade draft, professor finalization, class result, and approved practice-set proposal.

Atlas is the professor's course-wide operator. It can inspect and act on the current LMS through typed, tenant-scoped tools. Course agent identity and teaching behavior are append-only, versioned configuration written through conversation with Atlas and compiled into student sessions below fixed application and assignment rules.

The Atlas composer supports voice transcription through Google Gemini. It uses the server-side `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` and defaults to `gemini-3.7-flash`; `ATLAS_TRANSCRIPTION_MODEL` can override that transcription-only model. Recordings can run for ten minutes, show a quiet countdown during the final 30 seconds, and append each completed transcript to the composer for review. This path does not change or invoke Atlas's configured chat model until the user sends the text.

Atlas can search current public sources through one bounded, read-only Exa tool when server policy permits it and `EXA_API_KEY` is present. The tool composes with professor Atlas, assessed sessions, and the student's personal Atlas. Platform boundaries always apply; student requests also intersect university policy and every applicable course policy. Course actors never see or supply the provider key, endpoint, or access status.

Assessed AI assignments include `execute_code` by default. Atlas runs Python, JavaScript, and TypeScript in a disposable AWS AgentCore Code Interpreter session outside the web and Workflow processes. Each chat gets a lazy 15-minute workspace; Atlas stages only bounded text inputs, copies back only declared outputs, persists terminal results and authorized artifacts, and stops the workspace when the assessed session submits. Professor planning and the student's personal Atlas do not receive the tool. See [`docs/adr/0020-agentcore-code-execution.md`](docs/adr/0020-agentcore-code-execution.md).

Course Setup owns course identity, offering facts, the grade scale, class policies, the syllabus pointer, and the course agent. The searchable material library and its bounded external-ingestion seam live on Materials. Instructor Settings describes the professor's personal Atlas and its durable memory. Atlas owns the model and provider runtime through server environment secrets.

The current seed data is the active v0 demo world from [`docs/v0/data-blueprint.md`](docs/v0/data-blueprint.md), including native session, evidence, report, and rollup rows. Additional course material and course agent configuration rows can be seeded through the current schema without changing the product surfaces.

## License

Proprietary, (c) Atlas LMS. All rights reserved.
