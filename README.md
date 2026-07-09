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

Open [http://localhost:3000](http://localhost:3000). The legacy seed accounts use password `atlas1234`:

- `instructor@demo.edu`
- `student@demo.edu`

## Verification

```bash
npm run verify

# With the dev server running:
npm run smoke
```

## Current State

Phases 0-4 of [`docs/v0/implementation-plan.md`](docs/v0/implementation-plan.md) are complete and merged. The v0 loop is implemented: professor configuration -> student session -> evidence-verified journey report -> class insight -> approved practice-set proposal. Phase 5 is limited to live validation, on-camera polish, and recording.

The current seed data is the active v0 demo world from [`docs/v0/data-blueprint.md`](docs/v0/data-blueprint.md), including native session, evidence, report, and rollup rows. The professor-facing agent-chat layer and its broader AI SDK integration are deliberately not part of this completed loop; they need their own architecture phase before implementation.

## License

Proprietary, (c) Atlas LMS. All rights reserved.
