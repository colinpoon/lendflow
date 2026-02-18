# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: 3 of 3 — Validation & Benchmarking
Plan: 2 of 3 complete
Status: In progress
Progress: ████████░░ 80%

Last activity: 2026-02-18 — Completed 03-02-PLAN.md (Token Usage Threading)

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
| Buffer-only visionProcessor input | 2026-02-17 | Route owns temp file lifecycle |
| Proceed to Phase 3 despite gaps | 2026-02-17 | Use benchmarking to quantify and fix |
| Claude Sonnet 4 pricing: $3/$15 per M | 2026-02-18 | Cost calculation for vision pipeline |
| GPT-4 Turbo pricing: $10/$30 per M | 2026-02-18 | Cost calculation for text pipeline |

### Known Issues (from Phase 2 testing)

| Issue | Observation | Priority |
|-------|-------------|----------|
| Shareholders' equity mismatch | Vision: $114M vs Text: $12M on test.pdf | High |
| Debt underreporting | Vision missed debt components | High |
| Single-year extraction | Vision found 1 year, Text found 2 | Medium |
| Missing breakdowns | Vision lacks debt/EBITDA component detail | Medium |

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- Vision extraction accuracy gaps need quantification in Phase 3
- May need to enhance extraction tool schema to capture debt breakdowns

## Phase 01 Summary

All infrastructure for vision-based extraction is complete:
- **01-01:** PDF-to-image converter (pdf-to-img v4.5.0, 300 DPI)
- **01-02:** Claude Vision client (Anthropic SDK, tool-calling)
- **01-03:** Vision extractor pipeline (end-to-end integration)

## Phase 02 Summary

Vision extraction pipeline is complete but with accuracy gaps:
- **02-01:** Vision processor (utils/visionProcessor.ts)
- **02-02:** Vision API route (app/api/extractData/vision/route.ts)

Key files delivered:
- `utils/visionProcessor.ts` — extractVisionData() with all ratios
- `app/api/extractData/vision/route.ts` — SSE endpoint
- `components/VisionFileUpload.tsx` — PDF-only upload component
- `app/(dashboard)/(routes)/vision/page.tsx` — Vision upload page

Tested with real PDFs:
- FY2023_Q4_Financial_Statements.pdf — extracted successfully
- test.pdf — showed accuracy gaps vs text extraction

## Phase 03 Summary (In Progress)

Validation & Benchmarking infrastructure:
- **03-01:** Accuracy calculation utilities (lib/benchmarks/accuracy.ts)
- **03-02:** Token usage threading (ExtractionResult.token_usage, cost.ts)
- **03-03:** Benchmark runner (pending)

Key files delivered:
- `lib/benchmarks/accuracy.ts` — Accuracy metrics calculation
- `lib/benchmarks/cost.ts` — Token pricing and cost calculation
- `utils/aiProcessor.ts` — ExtractionResult.token_usage field
- `utils/visionProcessor.ts` — token_usage with cost_usd
- `lib/chunk-processor.ts` — ChunkProcessingResult with aggregated token_usage

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 03-02-PLAN.md
Resume file: .planning/phases/03-validation-benchmarking/03-03-PLAN.md
