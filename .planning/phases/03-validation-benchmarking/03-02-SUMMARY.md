---
phase: 03-validation-benchmarking
plan: 02
subsystem: benchmarking
tags: [token-usage, cost-tracking, openai, anthropic, metrics]

# Dependency graph
requires:
  - phase: 01-infrastructure-setup
    provides: Vision extraction pipeline with token usage
  - phase: 02-vision-extraction-pipeline
    provides: visionProcessor with extractFromPdf totalUsage
provides:
  - Token usage tracking in both extraction pipelines
  - Cost calculation utilities for Claude and OpenAI models
  - ExtractionResult.token_usage field with cost_usd
affects: [03-03-PLAN, COST-01, COST-02, benchmark-logging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Token usage accumulation across chunks
    - Cost calculation with pricing constants
    - Unified TokenUsage/CostBreakdown interfaces

key-files:
  created:
    - lib/benchmarks/cost.ts
  modified:
    - utils/aiProcessor.ts
    - utils/visionProcessor.ts
    - lib/chunk-processor.ts

key-decisions:
  - "Claude Sonnet 4 pricing: $3/M input, $15/M output"
  - "GPT-4 Turbo pricing: $10/M input, $30/M output"
  - "Token usage captured even on failed chunks"
  - "ChunkProcessingResult wraps results + aggregated token_usage"

patterns-established:
  - "token_usage field in ExtractionResult for cost tracking"
  - "Cost calculation functions for pipeline comparison"

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 3 Plan 2: Token Usage Threading Summary

**Token usage tracking added to both extraction pipelines with cost calculation utilities**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T01:55:07Z
- **Completed:** 2026-02-18T01:58:37Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created cost calculation utilities with pricing constants for Claude and OpenAI
- Added `token_usage` field to `ExtractionResult` interface
- Vision pipeline now returns token usage with calculated cost in USD
- Text pipeline accumulates token usage across all chunks and returns cost

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cost calculation utilities** - `eea92a4` (feat)
2. **Task 2: Update ExtractionResult and vision token usage** - `909d4ad` (feat)
3. **Task 3: Capture OpenAI token usage in text extraction** - `d7fe025` (feat)

## Files Created/Modified

- `lib/benchmarks/cost.ts` - Pricing constants, TokenUsage/CostBreakdown interfaces, calculateVisionCost, calculateTextCost functions
- `utils/aiProcessor.ts` - Added token_usage to ExtractionResult, imported calculateTextCost, threaded token usage through return
- `utils/visionProcessor.ts` - Imported calculateVisionCost, added token_usage to return with cost_usd
- `lib/chunk-processor.ts` - Added usage to ChunkResult, created ChunkProcessingResult interface, accumulated tokens in processChunksSequentially

## Decisions Made

- Used current pricing as of 2026-02 (Claude Sonnet 4: $3/$15 per M, GPT-4 Turbo: $10/$30 per M)
- Capture token usage even when chunk processing fails (for accurate cost tracking)
- ChunkProcessingResult wrapper type to return both results array and aggregated token_usage

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both pipelines now report token_usage with input/output tokens and cost_usd
- Ready for COST-01 (token usage logging to benchmark output)
- Ready for COST-02 (cost comparison between pipelines)
- Foundation complete for 03-03-PLAN benchmark runner

---
*Phase: 03-validation-benchmarking*
*Completed: 2026-02-18*
