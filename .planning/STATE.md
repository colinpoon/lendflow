# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: 1 of 3 — Infrastructure Setup
Plan: 2 of 3 complete (01-02 Claude Vision Client)
Status: In progress
Progress: ██░░░░░░░░ 20%

Last activity: 2026-02-16 — Completed 01-02-PLAN.md (Claude Vision API client)

## Accumulated Context

### Recent Decisions

| Decision | Date | Impact |
|----------|------|--------|
| Vision over text for tables | 2026-02-15 | Fundamental approach change |
| Claude 3.7 Sonnet Vision | 2026-02-15 | Primary model for PoC |
| PoC-only scope | 2026-02-15 | Validate before full migration |
| Tool calling for structured output | 2026-02-16 | Forces JSON matching ExtractedMetrics |
| claude-sonnet-4-20250514 model ID | 2026-02-16 | Current Claude 3.7 Sonnet model |

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- Need Anthropic API key for Claude Vision testing (user setup required)
- Plan 01-01 PDF converter needs to be committed (files created but not staged)

## Session Continuity

Last session: 2026-02-16 21:06 PST
Stopped at: Completed 01-02-PLAN.md
Resume file: .planning/phases/01-infrastructure-setup/01-03-PLAN.md
