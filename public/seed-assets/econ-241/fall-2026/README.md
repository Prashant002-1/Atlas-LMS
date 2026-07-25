# ECON-241 Fall 2026 Asset Pack

This directory is the canonical static asset pack for the seeded ECON-241 course. It keeps the original documents import-ready even when a local database or document-upload provider is unavailable.

Use `asset-manifest.json` as the import index. Its IDs are stable; material rows in the fixture use the `path` values through `assetPath`. Week-specific material records deliberately share the course-wide deck, reader, and workbook, while their record metadata supplies the week, display name, visibility, extracted text, and expected course context.

Do not rename a file without updating the manifest and `lib/db/fixtures/courses/econ241-course-corpus.ts`.
