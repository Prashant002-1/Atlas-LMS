# ADR-0021: Standalone AI Assignments product boundary

Status: Accepted, standalone pilot implemented separately
Date: 2026-08-26

## Context

Atlas LMS has a substantial assessed-session runtime, but it is coupled to LMS courses, enrollments, files, assignments, policies, and gradebook records. Requiring a teacher to adopt the whole LMS makes the differentiated AI assignment harder to try and harder to integrate with an existing system such as Canvas.

## Decision

The standalone AI Assignments product lives in its own repository, deployment, database, object store, authentication boundary, tenant model, and worker runtime. Atlas LMS keeps its existing functionality and does not read or write the standalone database.

Atlas contains only an opt-in service client at `lib/ai-assignments/client.ts`. The client is disabled when `ATLAS_AI_ASSIGNMENTS_URL` is unset. Its first capability is health and contract discovery. It does not redirect sessions, sync rosters, publish assignments, or pass grades until the standalone service exposes authenticated and idempotent endpoints for those operations.

The standalone product owns versioned contracts for course provisioning, assignment publication, student launch, and teacher-finalized grade delivery. External systems map their identifiers to product-owned identifiers; they do not become alternate assessment authorities.

## Consequences

- A teacher can use one standalone course without replacing the institution's LMS.
- Atlas LMS remains deployable and operable with no standalone service.
- No credential, database connection, storage key, transcript, draft report, or grade row is shared between products.
- Health discovery is not evidence that synchronization or LTI is configured.
- Canvas LTI 1.3 and LTI Advantage remain a second product phase built on the same adapter contracts.
