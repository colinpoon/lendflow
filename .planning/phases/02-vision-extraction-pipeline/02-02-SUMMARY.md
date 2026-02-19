---
phase: 02-vision-extraction-pipeline
plan: 02
subsystem: api
tags: [nextjs, sse, supabase, clerk, vision, pdf, claude]

# Dependency graph
requires:
  - phase: 02-01
    provides: extractVisionData(pdfBuffer) from utils/visionProcessor.ts
  - phase: 01-infrastructure-setup
    provides: lib/vision pipeline (pdf-converter, claude-client, vision-extractor)
provides:
  - POST /api/extractData/vision SSE endpoint for vision-based PDF extraction
  - PDF-only validation (400 rejection before SSE stream opens)
  - Buffer-based processing (no temp file writes)
  - SSE progress stages: uploading → extracting → computing → saving → complete
  - Year conflict detection emitting conflict_detected SSE event
  - Extraction record written to Supabase extractions table
  - Human-verified end-to-end with FY2023_Q4_Financial_Statements.pdf
affects:
  - 03-frontend-integration (frontend calling vision endpoint)
  - any future A/B testing between text and vision routes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSE TransformStream pattern (mirrored from text route)
    - Buffer-only processor input (route owns memory lifecycle, no temp files)
    - Fresh Supabase client after long-running async op (token expiry prevention)
    - PDF-only guard before stream open (validation errors as JSON, not SSE)

key-files:
  created:
    - app/api/extractData/vision/route.ts
  modified: []

key-decisions:
  - "PDF-only check returns JSON 400 before SSE stream is opened (not an SSE error event)"
  - "No temp file — Buffer downloaded from Storage passed directly to extractVisionData()"
  - "sendProgress is not passed to extractVisionData() (vision processor handles per-page progress internally)"
  - "computing (75%) event sent after extractVisionData() returns, not before"

patterns-established:
  - "PDF guard pattern: file type check before TransformStream construction returns plain JSON"
  - "Buffer pipeline: Storage.download() → arrayBuffer() → Buffer.from() → processor"

# Metrics
duration: 10min
completed: 2026-02-17
---

# Phase 2 Plan 02: Vision API Route Summary

**SSE POST endpoint at /api/extractData/vision that uploads PDFs to Supabase Storage, runs Claude Vision extraction via extractVisionData(Buffer), streams five-stage progress events with conflict detection and database persistence — human-verified with FY2023 financials showing Revenue $1.68B, EBITDA $90M, FCCR 2.85x**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-17T18:33:23Z
- **Completed:** 2026-02-17T18:43:00Z
- **Tasks:** 2 of 2 complete
- **Files modified:** 1 created

## Accomplishments

- Created `app/api/extractData/vision/route.ts` with identical auth, storage, and DB patterns as the text route
- PDF-only enforcement: non-PDF files receive a JSON 400 response before the SSE stream opens
- Buffer-based processing pipeline: downloads from Supabase Storage into memory, passes directly to `extractVisionData()` — no temp files written
- Five SSE stages (uploading 5/8/10%, extracting 20%, computing 75%, saving 90%, complete 100%) with conflict_detected event when year overlaps exist
- Human-verified end-to-end with `FY2023_Q4_Financial_Statements.pdf`: Revenue $1,679,667K, EBITDA $90,055K, Net Income $61,301K, FCCR 2.85x, DSCR 5.41x, Current Ratio 1.21x, Interest Coverage 39.12x — all metrics displayed correctly in UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Create app/api/extractData/vision/route.ts** - `ad10942` (feat)
2. **Task 2: Human verify end-to-end pipeline** - approved (no code commit — checkpoint)

**Plan metadata:** `87b8504` (docs: partial), updated in final commit

## Files Created/Modified

- `app/api/extractData/vision/route.ts` — POST SSE endpoint for vision-based PDF extraction (420 lines)

## Decisions Made

- PDF-only check returns a plain JSON 400 **before** opening the SSE stream. Consistent with the other synchronous validation errors (no file, invalid projectId) which also return JSON — the SSE stream is only opened after all synchronous validation passes.
- `extractVisionData(pdfBuffer)` takes only a Buffer with no ProgressCallback. The vision processor handles per-page console logging internally. The route sends manual progress events before and after the awaited call.
- The `computing (75%)` SSE event is emitted **after** `extractVisionData()` returns (not before), since the function computes ratios internally — this reflects actual completion state rather than an anticipatory event.
- `updateDocumentStatus()` helper copied inline from the text route to avoid cross-file import coupling.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors were present in the codebase (`components/FileUpload.tsx`, `components/FinancialTable.tsx`, `next.config.ts`, `scripts/debug-extraction.ts`, `utils/aiProcessor.ts`). None are in the new file. `app/api/extractData/vision/route.ts` compiles cleanly with zero errors.

## User Setup Required

None — no external service configuration required beyond what was set up in prior phases.

## Next Phase Readiness

- `POST /api/extractData/vision` is complete and human-verified with a real financial PDF
- Vision pipeline delivers accurate financial metrics end-to-end (Revenue, EBITDA, FCCR, DSCR confirmed)
- Phase 3 (frontend integration) can begin: wiring the upload UI to call `/api/extractData/vision` and rendering vision-extracted results alongside or instead of the text route

---
*Phase: 02-vision-extraction-pipeline*
*Completed: 2026-02-17*
