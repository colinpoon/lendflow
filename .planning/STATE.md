# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: 2 of 3 — Vision Extraction Pipeline (In progress)
Plan: 1 of 2 complete
Status: In progress
Progress: ████░░░░░░ 40%

Last activity: 2026-02-17 — Completed 02-01-PLAN.md (Create utils/visionProcessor.ts)

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

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- None currently - 02-01 complete, ready for 02-02 (vision API route with human checkpoint)

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

## Phase 02 Summary (In Progress)

### 02-01: Create utils/visionProcessor.ts — COMPLETE

Vision extraction processor bridging Phase 1 output to ExtractionResult shape with full ratio and risk assessment computation.

Key file delivered:
- `utils/visionProcessor.ts` — exports `extractVisionData(pdfBuffer: Buffer): Promise<ExtractionResult>`

## Session Continuity

Last session: 2026-02-17T18:30:14Z
Stopped at: Completed 02-01-PLAN.md
Resume file: .planning/phases/02-vision-extraction-pipeline/02-02-PLAN.md

## Phase 02 Plans

- 02-01-PLAN.md — Create utils/visionProcessor.ts (Wave 1, autonomous) — **COMPLETE**
- 02-02-PLAN.md — Create vision API route (Wave 2, has human checkpoint)
