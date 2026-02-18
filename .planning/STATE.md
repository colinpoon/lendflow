# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: 2 of 3 — Vision Extraction Pipeline (COMPLETE)
Plan: 2 of 2 complete
Status: Phase complete
Progress: ██████████ 80%

Last activity: 2026-02-17 — Completed 02-02-PLAN.md (vision API route, human-verified)

## Accumulated Context

### Recent Decisions

| Decision | Date | Impact |
|----------|------|--------|
| Vision over text for tables | 2026-02-15 | Fundamental approach change |
| Claude 3.7 Sonnet Vision | 2026-02-15 | Primary model for PoC |
| PoC-only scope | 2026-02-15 | Validate before full migration |
| Tool calling for structured output | 2026-02-16 | Forces JSON matching ExtractedMetrics |
| claude-sonnet-4-20250514 model ID | 2026-02-16 | Current Claude 3.7 Sonnet model |
| pdf-to-img v4.5.0 for Node 18 | 2026-02-17 | v5.0 requires Node 20+, incompatible |
| Scale factor 4.17 for 300 DPI | 2026-02-17 | High quality for financial tables |
| Sequential page processing | 2026-02-17 | Avoid Claude API rate limits |
| Year-based metric merging | 2026-02-17 | Prefer newer page values for same year |
| Buffer-only input for visionProcessor | 2026-02-17 | API route owns temp file lifecycle, cleaner separation |
| VisionExtractionResult alias | 2026-02-17 | Type alias for callers wanting explicit name without new interface |
| Last-wins year collision merge | 2026-02-17 | Consistent with Phase 1 page merge behavior |
| PDF-only guard before SSE stream | 2026-02-17 | Non-PDF validation returns JSON 400, not SSE error |
| No temp file in vision route | 2026-02-17 | Buffer pipeline: Storage download → arrayBuffer() → Buffer.from() |
| computing event after extractVisionData | 2026-02-17 | Reflects actual ratio computation completion, not anticipatory |

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- None — Phase 2 complete. Vision pipeline verified end-to-end with real financial data.

## Phase 01 Summary

All infrastructure for vision-based extraction is complete:
- **01-01:** PDF-to-image converter (pdf-to-img v4.5.0, 300 DPI)
- **01-02:** Claude Vision client (Anthropic SDK, tool-calling)
- **01-03:** Vision extractor pipeline (end-to-end integration)

Key files delivered:
- `lib/vision/pdf-converter.ts`
- `lib/vision/claude-client.ts`
- `lib/vision/extraction-tool.ts`
- `lib/vision/vision-extractor.ts`
- `lib/vision/index.ts`
- `scripts/test-vision-extraction.mjs`

## Phase 02 Summary — COMPLETE

### 02-01: Create utils/visionProcessor.ts — COMPLETE

Vision extraction processor bridging Phase 1 output to ExtractionResult shape with full ratio and risk assessment computation.

Key file delivered:
- `utils/visionProcessor.ts` — exports `extractVisionData(pdfBuffer: Buffer): Promise<ExtractionResult>`

### 02-02: Create vision API route — COMPLETE (human-verified)

SSE endpoint that uploads PDFs to Supabase Storage, runs vision extraction, saves to DB.

Key file delivered:
- `app/api/extractData/vision/route.ts` — POST SSE endpoint, commit ad10942

Human-verified with `FY2023_Q4_Financial_Statements.pdf`:
- Revenue $1,679,667K, EBITDA $90,055K, Net Income $61,301K
- FCCR 2.85x, DSCR 5.41x, Current Ratio 1.21x, Interest Coverage 39.12x
- All metrics displayed correctly in UI

## Session Continuity

Last session: 2026-02-17T18:43:00Z
Stopped at: Completed 02-02-PLAN.md — Phase 2 complete
Resume file: None (ready for Phase 3 planning)

## Phase 02 Plans

- 02-01-PLAN.md — Create utils/visionProcessor.ts (Wave 1, autonomous) — **COMPLETE**
- 02-02-PLAN.md — Create vision API route (Wave 2, human-verified) — **COMPLETE**
