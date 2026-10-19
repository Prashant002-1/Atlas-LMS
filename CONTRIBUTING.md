# Contributing to Atlas

Thanks for your interest. Atlas is an open-source learning management system
built around teacher-governed AI. Issues, pull requests, forks, and
experiments are all welcome.

Start with [`docs/README.md`](docs/README.md). It maps the product thesis, the
system architecture, the architecture decision records, and the agent tool
contracts.

## Ground rules

Atlas has a small number of product invariants. A change that breaks one of
them will be asked to change shape, however good the code is.

- **Teacher-shaped.** The agent acts only inside professor-defined scope. It
  never invents labels, thresholds, or grades.
- **Evidence-backed.** A score cites verbatim evidence verified against the
  stored transcript. Unverified quotes never reach a score or a screen.
- **Propose, then approve.** Every course-changing write goes through a
  reviewable proposal and apply path. No tool posts, grades, sends, or
  publishes directly.
- **Scoped and persistent.** Every query is scoped to the signed-in
  organization and course, and every live object is a database row.
- **Server-owned providers.** Model, embedding, search, and execution
  credentials are server environment secrets. Teacher and student surfaces
  never read or override them.
- **Record-first interface.** Show the course record and the controls that
  operate on it. See [`docs/DesignSystem.md`](docs/DesignSystem.md).

## Development setup

You need Node.js 24 or newer and Docker (for the local PostgreSQL with
pgvector). The full quickstart is in the [README](README.md#getting-started).

```bash
docker compose up -d db
npm install
cp .env.example .env.local
npm run db:push -- --force
npm run db:upgrade -- --allow-destructive
npm run workflow:bootstrap
npm run db:seed
npm run dev
```

Core records and navigation work without any model provider key. Agent
features need at least one chat provider configured in `.env.local`.

## Making a change

1. Branch from `main`.
2. Keep the change scoped. One concern per pull request.
3. Run the verification gate before pushing:

   ```bash
   npm run verify
   ```

   That runs the typecheck, lint, unit tests, and a production build. With the
   dev server running, `npm run smoke` exercises the signed-in routes.

4. Open a pull request against `main`. CI runs the same gate against a
   disposable PostgreSQL database and builds the production container.

### Database changes

- `db:push` only initializes an empty database.
- Every change to an existing database needs reviewed SQL in `drizzle/` and an
  entry in the managed migration list used by `scripts/db-release.ts`.
- Never edit an applied migration. Add a new forward migration.
- Keep schema upgrades separate from seeding.

### Seed data

The ECON-241 demo course is a deliberate, course-sized record. Its contract is
in [`docs/v0/econ241-seed-contract.md`](docs/v0/econ241-seed-contract.md).
When you change it, update the corpus, the asset manifest if a binary changes,
and the fixture tests together. Seed people are fictional.

### Documentation

- Record a significant architectural choice as a new ADR in `docs/adr/`.
- Keep agent tool contracts in `docs/agent-tools/` in sync with the code.
- Prefer updating an existing document to adding a parallel one.

## Reporting bugs and proposing features

Use the issue templates. For anything security-related, follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
