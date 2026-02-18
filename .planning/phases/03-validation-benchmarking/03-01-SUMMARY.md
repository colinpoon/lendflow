---
phase: 03-validation-benchmarking
plan: 01
status: complete
completed: 2026-02-17
duration: ~45 minutes
tech-stack:
  added:
    - TypeScript type definitions for ground truth data
  patterns:
    - Utility functions for accuracy calculations
    - Flexible filename matching for ground truth lookup
key-files:
  created:
    - lib/benchmarks/ground-truth.ts
    - lib/benchmarks/accuracy.ts
---

# Plan 03-01: Ground Truth Data and Accuracy Calculation

## Objective

Establish ground truth baseline data and accuracy calculation infrastructure for benchmarking text vs vision extraction pipelines. This foundation enables meaningful accuracy comparisons in subsequent phases (03-02, 03-03) by providing:

1. **Verified baseline values** from three financial documents (Zedcor FY2023/FY2024, Taiga FY2024)
2. **Accuracy calculation utilities** with configurable 10% variance threshold
3. **Flexible lookup functions** for ground truth retrieval by filename and fiscal year
4. **Edge case handling** for zero values and missing metrics

## Deliverables

| File | Purpose | Exports |
|------|---------|---------|
| `lib/benchmarks/ground-truth.ts` | Ground truth values for Zedcor FY2023/FY2024 and Taiga FY2024 | `GROUND_TRUTH`, `GroundTruthEntry`, `getGroundTruth`, `getGroundTruthByDocument`, `isGroundTruthPopulated`, `areAllGroundTruthsPopulated` |
| `lib/benchmarks/accuracy.ts` | Accuracy calculation utilities with 10% threshold | `calculateAccuracy`, `calculateVariance`, `isAccurate`, `AccuracyResult`, `AccuracySummary`, `ACCURACY_THRESHOLD_PCT`, `formatAccuracyResult`, `formatAccuracySummary` |

## Implementation Details

### Ground Truth Structure

Each entry contains:
- **document**: Identifier (e.g., "Zedcor-FY2024")
- **filename**: Exact filename in `public/financialReports/`
- **fiscal_year**: Year as string (e.g., "2024")
- **values**: Financial metrics (revenue, net_income, ebitda, adjusted_ebitda, shareholders_equity, total_debt, senior_debt)
- **source_notes**: Documentation of value sources

Three entries created:
1. Zedcor FY2023 (2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf)
2. Zedcor FY2024 (2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf)
3. Taiga FY2024 (Taiga_-_December_31,_2024_audited_financial_statements.pdf)

### Accuracy Calculation Logic

**Variance Formula:**
```
variance = abs((extracted - truth) / truth) * 100
```

**Edge Cases Handled:**
- **Truth = 0**: Uses absolute difference instead of percentage to avoid division by zero
- **Extracted = null**: Treated as missing extraction (not accurate)
- **Both = 0**: variance = 0% (both correct)

**Accuracy Determination:**
- Metric is accurate if `variance < ACCURACY_THRESHOLD_PCT` (10%)
- Overall accuracy = (accurate_count / total_metrics) × 100%
- Winner = pipeline with higher overall accuracy percentage

### Lookup Functions

1. **`getGroundTruth(filename, fiscalYear)`**: Case-insensitive partial filename match
2. **`getGroundTruthByDocument(documentPrefix)`**: Get all entries for a company (e.g., "Zedcor")
3. **`isGroundTruthPopulated(entry)`**: Check if values are populated (non-zero)
4. **`areAllGroundTruthsPopulated()`**: Verify all entries are populated before benchmarking

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 196a4b0 | feat(03-01): create ground truth data file | lib/benchmarks/ground-truth.ts |
| 4c1df9a | feat(03-01): create accuracy calculation utilities | lib/benchmarks/accuracy.ts |

## Verification

- [x] `lib/benchmarks/ground-truth.ts` exists with `GroundTruthEntry` interface
- [x] `lib/benchmarks/accuracy.ts` exists with accuracy calculation functions
- [x] TypeScript compilation successful (no errors)
- [x] All required exports present and properly typed
- [x] Ground truth entries for all 3 required documents (Zedcor x2, Taiga x1)
- [x] Ground truth values manually verified from source PDFs
- [x] Accuracy threshold configurable at `ACCURACY_THRESHOLD_PCT = 10`
- [x] Edge cases handled (zero truth values, null extractions)
- [x] Helper functions for lookup and validation working correctly

## Decisions Made

1. **Accuracy Threshold**: Set to 10% variance. Within this range, extraction is considered accurate. This aligns with standard financial reporting tolerances.

2. **Ground Truth Matching**: Implemented flexible matching (case-insensitive partial match, document identifier matching) to handle variations in filename references during extraction.

3. **Null/Missing Handling**: Null extracted values automatically fail accuracy check (treated as not extracted), preserving the distinction between "wrong extraction" and "no extraction."

4. **Zero Truth Values**: Edge case where truth = 0 uses absolute difference instead of percentage to avoid division by zero and provide meaningful variance calculation.

## Next Phase Readiness

The ground truth data and accuracy utilities are ready for:
- **03-02**: Use `calculateAccuracy()` to assess token usage impact (before/after text extraction)
- **03-03**: Use same utilities to run full benchmark comparing text vs vision extraction accuracy

**Critical Requirement**: Ground truth values (in `GROUND_TRUTH` constant) have been manually verified from source PDFs by the user. Without this verification, accuracy calculations would be meaningless. The user confirmed completion during the verification checkpoint.

## Deviations from Plan

None - plan executed exactly as written. All tasks completed, ground truth values populated and verified, accuracy utilities fully implemented with edge case handling.

## Files Modified/Created

**Created:**
- `/Users/colinpoon/Dev/lendflow/lib/benchmarks/ground-truth.ts` - 170 lines
- `/Users/colinpoon/Dev/lendflow/lib/benchmarks/accuracy.ts` - 286 lines

**Dependencies:**
- Imports `ComputedMetrics` from `@/types` (existing type)
- Imports `GroundTruthEntry` from ground-truth.ts (new type)
- No external package dependencies added

## Total Implementation

- **2 files created**
- **456 lines of code** (ground-truth + accuracy modules)
- **8 exported types and functions** (ready for consumption in benchmarking tasks)
- **Edge cases fully handled** for production use
