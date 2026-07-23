# Atlas LMS

Atlas is an LMS rebuilt around teacher-governed AI. The active product direction is in [`docs/README.md`](docs/README.md).

## Quickstart

```bash
docker compose up -d db
npm install
cp .env.example .env.local
npm run db:push
npm run db:seed
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

The Atlas composer supports voice transcription through Google Gemini. It uses the server-side `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` and defaults to `gemini-3.6-flash`; `ATLAS_TRANSCRIPTION_MODEL` can override that transcription-only model. Recordings can run for ten minutes, show a quiet countdown during the final 30 seconds, and append each completed transcript to the composer for review. This path does not change or invoke Atlas's configured chat model until the user sends the text.

Course Setup owns course identity, offering facts, the grade scale, class policies, the syllabus pointer, and the course agent. The searchable material library and its bounded external-ingestion seam live on Materials. Teacher Settings describes the professor's personal Atlas. Atlas owns the model and provider runtime through server environment secrets.

The current seed data is the active v0 demo world from [`docs/v0/data-blueprint.md`](docs/v0/data-blueprint.md), including native session, evidence, report, and rollup rows. Additional course material and course agent configuration rows can be seeded through the current schema without changing the product surfaces.

## License

Proprietary, (c) Atlas LMS. All rights reserved.
