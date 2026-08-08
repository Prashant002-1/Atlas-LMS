# ECON-241 Seed Contract

**Status:** active source of truth for the ECON-241 demo course. **Scope:** replace the prior sparse ECON-241 fixture with a university-course-sized record. Other seeded courses are out of scope.

## Purpose

The course must give instructor, student, and agent workflows enough material to behave like a real course. Length is a product requirement here, not decorative filler. The seed should contain substantial course prose, documents that can actually be opened, varied student work, returned feedback, current work, and future work.

The course is Intermediate Microeconomics, Fall 2026, taught through the VidStack pricing case. The scenario can be imperfect as a real-world economic forecast. Its job is to provide a rich and coherent enough course record for product evaluation.

## Canonical source

- `lib/db/fixtures/courses/econ241-course-corpus.ts` owns ECON-241's modules, course pages, material metadata and extracted text, long syllabus, course description, and assignment briefs.
- `lib/db/fixtures/v0-demo-world.ts` owns students, enrollment, assessment history, submissions, agent-session records, grading, and the fixture package shape.
- `lib/db/seed.ts` reads each material's `assetPath`, stores the exact bytes in `document_originals`, and runs the same AnyDoc pipeline as an authenticated upload. The normal deterministic demo seed remains the import path.
- `public/seed-assets/econ-241/fall-2026/asset-manifest.json` maps stable asset identifiers to the source files used by seed ingestion.

Do not restore short placeholder pages or file links for ECON-241. When changing the course, update the corpus, the material manifest if a binary changes, and the fixture tests together.

## Minimum data shape

| Record | Contract |
| --- | --- |
| Term | Fourteen teaching weeks, early in the term on the demo date, with completed, current, and future work. |
| Modules | Fourteen weekly modules, each with a substantive summary, learning objectives, a central question, and a distinct topic. |
| Pages | Twelve full teaching pages, generally 650 to 800 words, with a model, worked course context, common mistake, application, and workshop. |
| Materials | Forty-five material records: syllabus, three weekly teaching artifacts for all fourteen weeks, a Week 7 session case pack, and an instructor-only Exam 2 outline. |
| Assignments | Fourteen briefs across the term. Each is a real prompt with required work, evidence expectations, interpretation, and a limitation standard. |
| Student evidence | Returned early work, a grading queue, missing work, text submissions, uploaded-file submissions, shared-link submissions, scores, feedback, and varied student voices. |
| Agent evidence | The governed Pricing Strategy Session, transcript-derived journey records, and the existing elasticity-versus-slope aggregate remain deterministic. |

## Documents and import mapping

The static asset pack is intentionally canonical rather than generating a separate source file for every one of the forty-five material records. Week-specific records share a course-wide deck, reader, or workbook source. Seed ingestion stores an original beside each file record because originals follow that record's lifecycle, while fixture metadata retains the exact week and course context.

| Asset ID | File | Used by |
| --- | --- | --- |
| `econ241-fall2026-syllabus` | `econ241-syllabus-fall2026.pdf` | Course syllabus |
| `econ241-fall2026-lecture-deck` | `econ241-lecture-slides-weeks-1-14.pptx` | Weekly lecture material records |
| `econ241-fall2026-course-reader` | `econ241-course-reader-weeks-1-14.pdf` | Weekly reader material records |
| `econ241-fall2026-data-workbook` | `econ241-data-workbook.xlsx` | Weekly evidence workbook records |
| `econ241-fall2026-pricing-case-pack` | `econ241-pricing-strategy-session-case-pack.docx` | Pricing Strategy Session, Week 7 |
| `econ241-fall2026-exam2-outline` | `econ241-exam2-drafting-outline.docx` | Instructor-only Exam 2 planning, Week 10 |

All paths use the form `/seed-assets/econ-241/fall-2026/<file>`. The seed stores those bytes privately, records the source path and checksum as metadata, and saves AnyDoc's canonical Markdown and structured extraction. Re-ingestion is idempotent and updates only seeded document records.

## Content rules

- Prefer real teaching artifacts: a question, a model, a worked decision, evidence, a likely misconception, and an application. Do not add prose only to make a field longer.
- Keep the pages, material text, assignment descriptions, syllabus, and substantial text submissions long enough for retrieval, citation, review, and comparison workflows.
- Make student records uneven. Scores, feedback, missing work, submission type, confidence, and revisions should not collapse to a template.
- Preserve the professor's active course context. The course should not look fully completed merely because historical feedback is available.
- Use stable `ECON-241`, `fall-2026`, week, and artifact names. A later binary import must be able to match a file to its intended material records without guessing.
- Keep other courses untouched unless a separate request changes their contract.

## Acceptance checks

The fixture test suite must verify substantive descriptions, term coverage, page and material depth, document variety, material asset paths, varied submission shapes, and the existing deterministic scenario aggregates. The seed must remain idempotent for the demo tenant and must not reset unrelated tenants.

Before handoff, verify the TypeScript fixture tests, inspect the generated PDFs, Word documents, deck, and workbook, and confirm every seeded material has an original plus a structured extraction after seeding.
