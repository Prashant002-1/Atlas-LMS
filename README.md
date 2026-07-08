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

Phase 0 of [`docs/v0/implementation-plan.md`](docs/v0/implementation-plan.md) is complete. The old Eve/command/cue product path is removed, `/teach/atlas` is an intentional v0 shell, and the next work is the v0 primitives.

The current seed data is still the legacy broad demo package. Generate the v0 demo world from [`docs/v0/data-blueprint.md`](docs/v0/data-blueprint.md) in a separate pass.

## License

Proprietary, (c) Atlas LMS. All rights reserved.
