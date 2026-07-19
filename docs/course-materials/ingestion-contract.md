# Course material ingestion contract

Atlas keeps binary storage and extraction outside the Next.js web process. This document defines the HTTPS service contract used by Course Setup.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ATLAS_MATERIAL_INGEST_URL` | HTTPS endpoint that accepts upload and link jobs |
| `ATLAS_MATERIAL_INGEST_TOKEN` | Bearer credential used by Atlas for outbound requests |
| `ATLAS_MATERIAL_CALLBACK_SECRET` | Independent HMAC-SHA256 secret shared with the worker for callbacks |
| `ATLAS_PUBLIC_APP_URL` | Optional externally reachable Atlas origin used to build the callback URL; falls back to `AUTH_URL` |

Production ingestion and material URLs must use HTTPS. Local development may use HTTP only for `localhost` or `127.0.0.1`.

## Upload request

Atlas sends `multipart/form-data`:

| Field | Type |
| --- | --- |
| `orgId` | UUID string |
| `courseId` | UUID string |
| `uploadedById` | UUID string |
| `checksumSha256` | lowercase hex digest of the exact uploaded bytes |
| `callbackUrl` | Atlas callback URL when available |
| `file` | original binary with file name and content type |

Limits enforced before the request:

- supported extension allowlist;
- non-empty file;
- 25 MB maximum;
- 90-second request timeout.

## Link request

Atlas sends `application/json`:

```json
{
  "orgId": "uuid",
  "courseId": "uuid",
  "uploadedById": "uuid",
  "sourceUrl": "https://public.example/material",
  "displayName": "Course material name",
  "callbackUrl": "https://atlas.example/api/materials/ingestion"
}
```

Atlas rejects non-HTTPS URLs, embedded URL credentials, and direct localhost loopback targets. The ingestion service must also resolve DNS and block private, link-local, and metadata-network destinations before fetching a link.

## Initial response

The service returns JSON:

```json
{
  "jobId": "stable-service-job-id",
  "url": "https://durable-object-url",
  "status": "processing",
  "extractedText": null,
  "pageCount": null,
  "metadata": {}
}
```

Rules:

- `jobId` is stable and unique for the service job.
- `url` is a durable HTTPS object URL, or local HTTP in development.
- `status` is `processing` or `ready`.
- `extractedText` is optional and at most 2,000,000 characters.
- `pageCount` is optional.
- serialized metadata is at most 50,000 characters.
- the whole response is at most 3,000,000 characters.
- a `processing` response is rejected unless Atlas has a callback URL and callback secret.
- a non-2xx response creates no `files` or `course_material_records` rows.

## Callback

The worker POSTs the exact JSON body to `/api/materials/ingestion` with:

```http
X-Atlas-Material-Signature: sha256=<64 lowercase hex characters>
```

The digest is:

```text
HMAC-SHA256(ATLAS_MATERIAL_CALLBACK_SECRET, exact_request_body_bytes)
```

Callback body:

```json
{
  "orgId": "uuid",
  "courseId": "uuid",
  "jobId": "stable-service-job-id",
  "status": "ready",
  "url": "https://durable-object-url",
  "extractedText": "...",
  "pageCount": 24,
  "metadata": {},
  "error": null
}
```

The callback:

- caps the raw body at 3,000,000 bytes;
- verifies HMAC with constant-time comparison before JSON parsing;
- validates every field;
- resolves the row by job id, organization, and course;
- repeats organization and course predicates on both tables;
- updates `files.url` and `files.extracted_text` only when supplied;
- updates processing metadata transactionally;
- treats `ready` and `failed` as terminal states;
- accepts an identical terminal-state retry idempotently;
- returns HTTP 404 with `Retry-After: 1` if the worker races the initial database transaction.

## Processing states

| State | Meaning | Student context |
| --- | --- | --- |
| `queued` | extension row created before a worker starts | excluded |
| `processing` | accepted by worker, extraction incomplete | excluded |
| `ready` | durable material is available | included only when access is `course` |
| `failed` | terminal failure with a bounded error | excluded |

Instructor context may describe every state. Existing `files` rows with no extension metadata resolve as `ready` and `course` for backward compatibility.
