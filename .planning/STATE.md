# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: 2 of 3 — Vision Extraction Pipeline (PLANNED)
Plan: 0 of 2 complete
Status: Ready for execution
Progress: ███░░░░░░░ 30%

Last activity: 2026-02-17 — Phase 2 plans created and verified

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

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- None currently - Phase 01 complete, ready for Phase 02

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

## Session Continuity

Last session: 2026-02-17
Stopped at: Phase 2 planning complete
Resume file: .planning/phases/02-vision-extraction-pipeline/02-01-PLAN.md

## Phase 02 Plans

- 02-01-PLAN.md — Create utils/visionProcessor.ts (Wave 1, autonomous)
- 02-02-PLAN.md — Create vision API route (Wave 2, has human checkpoint)
