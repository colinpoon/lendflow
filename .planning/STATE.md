# Project State: Lendflow

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios
**Current focus:** v1.0 Vision Extraction PoC

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Progress: ░░░░░░░░░░ 0%

Last activity: 2026-02-15 — Milestone v1.0 started

## Accumulated Context

### Recent Decisions

| Decision | Date | Impact |
|----------|------|--------|
| Vision over text for tables | 2026-02-15 | Fundamental approach change |
| Claude 3.7 Sonnet Vision | 2026-02-15 | Primary model for PoC |
| PoC-only scope | 2026-02-15 | Validate before full migration |

### Recent Fixes (Pre-Milestone)

- **Negative interest rejection** (ebitda-calculator.ts): AI was extracting -261 instead of 5,375. Now rejects negative values and falls back to total_interest_expense/ttm_interest_expense/cash_interest_paid.
- **Larger chunk sizes** (constants.ts): Increased from 4k to 25k chars, reduced overlap from 15% to 5%. Should reduce API calls by ~80%.

### Blockers/Concerns

- Need Anthropic API key for Claude Vision testing
- Need to verify Claude 3.7 Sonnet current capabilities and pricing
- PDF-to-image library selection (pdf-lib + Canvas vs pdf2image)

## Session Continuity

Last session: 2026-02-15
Stopped at: Creating milestone roadmap
Resume file: None
