# Atlas Docs

Read these in order when orienting:

1. [`Vision.md`](Vision.md), the product thesis.
2. [`demo/script.md`](demo/script.md), the camera target and demo acceptance test.
3. [`v0/README.md`](v0/README.md), the v0 scope map.
4. [`v0/implementation-plan.md`](v0/implementation-plan.md), current phase status and build plan.
5. [`v0/architecture.md`](v0/architecture.md), runtime and grading-pipeline design.
6. [`v0/econ241-seed-contract.md`](v0/econ241-seed-contract.md), the active ECON-241 seed-data contract.

Supporting docs:

- [`Brand.md`](Brand.md), brand direction.
- [`DesignSystem.md`](DesignSystem.md), UI token and surface guidance.
- [`prototypes/launch-dashboard-reference.md`](prototypes/launch-dashboard-reference.md),
  the captured launch-site palette and surface reference for the dashboard.
- [`adr/README.md`](adr/README.md), architecture decision records.
- [`course-materials/ingestion-contract.md`](course-materials/ingestion-contract.md),
  document parsing, private originals, opaque uploads, and link intake.

Deployment and operations:

- [`deployment/aws-hosting.md`](deployment/aws-hosting.md), the live AWS
  production inventory, release runbook, verification, rollback, recovery,
  monitoring, and cost-control source of truth.
- [`deployment/aws-cost-estimate.md`](deployment/aws-cost-estimate.md), the
  expected AWS cost floor and optional-service costs.
- [`deployment/dependency-maintenance.md`](deployment/dependency-maintenance.md),
  protected CI, Dependabot grouping, audit policy, and documented exceptions.
- [`adr/0018-gcp-demo-hosting-and-compute-boundary.md`](adr/0018-gcp-demo-hosting-and-compute-boundary.md),
  the historical GCP hosting decision and isolated code-execution boundary.
- [`adr/0020-agentcore-code-execution.md`](adr/0020-agentcore-code-execution.md),
  the implemented assessed-session execution boundary.
- [`deployment/aws-agentcore-code-execution.md`](deployment/aws-agentcore-code-execution.md),
  the single-account AWS setup, quota, IAM, and smoke-test runbook.
- [`deployment/gcp-yc-demo.md`](deployment/gcp-yc-demo.md), the retired GCP
  demo inventory and migration history. It is no longer the live runbook.

Historical/context notes:

- [`trajectory/`](trajectory/), notes from the product shift.
- [`demo/pitch-narrative-notes.md`](demo/pitch-narrative-notes.md), pitch-story scratchpad.
- [`prototypes/`](prototypes/), old visual prototypes.
- [`v0/data-blueprint.md`](v0/data-blueprint.md), the superseded original v0 design brief.

Removed/superseded work:

- The old command/cue/Eve product path is gone. Do not rebuild from `atlas-command` history or the prototype unless explicitly asked.
