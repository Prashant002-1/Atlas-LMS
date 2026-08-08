# Course material ingestion contract

Atlas has two bounded intake paths. Supported document uploads are parsed locally in the Next.js server process and stored privately in PostgreSQL. Links, packages, media, and other non-document material may use the separate HTTPS ingestion contract documented below.

## Parser decision

Atlas uses self-hosted [AnyDoc](https://github.com/firecrawl/anydoc), pinned at `@firecrawl/anydoc@0.1.7`, as its default document parser. AnyDoc runs in the Atlas server process without a model API or external parsing service and converts its supported Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text-based PDF formats into one GitHub-Flavored Markdown representation.

The document action validates the authenticated owner and 25 MB limit, reads the exact upload bytes once, computes SHA-256, and invokes AnyDoc before one database transaction. The transaction writes the existing `files` record, private original bytes in `document_originals`, processing provenance in `course_material_records`, and the attachment owner. AnyDoc Markdown is saved unchanged in both `files.extracted_text` and `course_material_records.extraction.contentMarkdown` for compatibility with search, agent context, and the viewer. Those fields are two uses of one parser result, not independent conversions.

Atlas does not send documents to an LLM for parsing or structure. Title, summary, and outline are derived deterministically from the canonical Markdown. Plain text and code use strict, bounded UTF-8 decoding. Package formats such as Common Cartridge, QTI/XML, and ZIP keep separate reviewed handlers. Scanned or image-only PDFs fail clearly because AnyDoc does not perform OCR; Atlas does not silently send private documents to a hosted service.

## External material configuration

Document uploads do not require these variables. They apply only to intake that still uses the external material service.

| Variable | Purpose |
| --- | --- |
| `ATLAS_MATERIAL_INGEST_URL` | HTTPS endpoint that accepts upload and link jobs |
| `ATLAS_MATERIAL_INGEST_TOKEN` | Bearer credential used by Atlas for outbound requests |
| `ATLAS_MATERIAL_CALLBACK_SECRET` | Independent HMAC-SHA256 secret shared with the worker for callbacks |
| `ATLAS_PUBLIC_APP_URL` | Optional externally reachable Atlas origin used to build the callback URL; falls back to `AUTH_URL` |

Production ingestion and material URLs must use HTTPS. Local development may use HTTP only for `localhost` or `127.0.0.1`.

## External material upload request

This request is not used for a filename accepted by the local document parser.

Atlas sends `multipart/form-data`:

| Field | Type |
| --- | --- |
| `orgId` | UUID string |
| `courseId` | UUID string for course material; omitted for a personal document |
| `ownerUserId` | UUID string for a personal document; omitted for course material |
| `uploadedById` | UUID string |
| `checksumSha256` | lowercase hex digest of the exact uploaded bytes |
| `callbackUrl` | Atlas callback URL when available |
| `file` | original binary with file name and content type |

Exactly one of `courseId` or `ownerUserId` is present. Atlas resolves both from the authenticated actor and never accepts a browser-selected scope.

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

Links are course material only. Personal Atlas attachments accept uploaded files, not remote URLs.

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
- `url` is a durable HTTPS object URL that serves bytes without a redirect, or local HTTP in development.
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
  "ownerUserId": "uuid",
  "jobId": "stable-service-job-id",
  "status": "ready",
  "url": "https://durable-object-url",
  "extractedText": "...",
  "pageCount": 24,
  "metadata": {},
  "error": null
}
```

This example is a personal callback. A course callback sends `courseId` in place of `ownerUserId`.

The callback:

- caps the raw body at 3,000,000 bytes;
- verifies HMAC with constant-time comparison before JSON parsing;
- validates every field;
- resolves the row by job id, organization, and the exact course or personal owner;
- repeats organization plus course or owner predicates on both tables;
- updates `files.url` and `files.extracted_text` only when supplied;
- updates processing metadata transactionally;
- treats `ready` and `failed` as terminal states;
- accepts an identical terminal-state retry idempotently;
- returns HTTP 404 with `Retry-After: 1` if the worker races the initial database transaction.

## Processing states

| State | Meaning | Student context |
| --- | --- | --- |
| `queued` | extension row created before asynchronous external work starts | excluded |
| `processing` | accepted by external material work, extraction incomplete | excluded |
| `ready` | durable material is available | included for course context only when access is `course`; included for personal context only for the owning student's exact session |
| `failed` | terminal failure with a bounded error | excluded |

Instructor context may describe every state. Existing `files` rows with no extension metadata resolve as `ready` and `course` for backward compatibility.

## Document understanding and originals

Documents keep the existing `files` row as their source record. `document_originals` stores one private `bytea` value keyed by `file_id`, with organization, checksum, a non-empty check, and the same 25 MB database limit enforced by the action. Deleting the file cascades to its original. New local document uploads do not require a public object URL, job id, callback, or second model pass.

The canonical AnyDoc Markdown is saved in both existing readable fields in the same transaction. Deterministic title, summary, and heading sections accompany it for the viewer, while agents receive the same Markdown through the existing bounded context path. Parser name, exact version, input mode, checksum, processing state, and bounded errors remain inspectable provenance.

`document_attachments` gives each use a real foreign-key owner: course material record, syllabus course, assignment, or Atlas thread. A database check requires exactly one attachment owner and exactly one storage scope. Course rows have `course_id`; personal student rows have `owner_user_id`, `course_id = null`, private visibility, and an established personal-session attachment.

Atlas does not claim universal parsing. If AnyDoc or the bounded local decoder cannot produce Markdown, the same transaction stores the private original and a `failed` readable state with a stable bounded error. Authenticated viewers open or download database-backed originals through `/api/documents/[fileId]/original`; the route retains the durable HTTPS URL path only for legacy files. Course reads repeat organization, course, enrollment, publication, visibility, and attachment-owner checks. Personal reads instead require the exact organization, owning student, private processing row, and personal session, and reject every instructor or other student.

Capability references checked for this decision: [AnyDoc repository and format support](https://github.com/firecrawl/anydoc) and [AnyDoc Node.js bindings](https://github.com/firecrawl/anydoc/blob/main/node/README.md).
