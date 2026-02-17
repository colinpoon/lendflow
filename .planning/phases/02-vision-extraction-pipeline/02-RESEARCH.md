# Phase 2: Vision Extraction Pipeline - Research

**Researched:** 2026-02-17
**Domain:** Claude Vision API integration with existing Next.js extraction pipeline
**Confidence:** HIGH — all findings sourced directly from reading the actual codebase

## Summary

Phase 2 integrates the Phase 1 vision infrastructure (`lib/vision/`) into the existing
application. The core extraction pipeline (`utils/aiProcessor.ts`) currently uses
OpenAI GPT-4 to extract text from documents. Phase 2 adds a parallel vision pipeline
using Claude (`lib/vision/vision-extractor.ts`) that processes PDFs as images.

The critical finding is that Phase 1 already delivers a fully working `extractFromPdf()`
function that returns `Record<string, ExtractedMetrics>` (metrics keyed by fiscal year).
The gap is that this output shape (`metricsByYear`) does not yet flow through
`computeMetrics()` → `ExtractionResult` → SSE stream → database. Phase 2 bridges
that gap by either: (a) adding a new API endpoint, or (b) wiring the vision path into
the existing `extractData` route behind a flag.

The Phase 1 vision output maps cleanly to `ExtractedMetrics`. The tool schema
(`extraction-tool.ts`) was built to match `types/financial.ts` exactly. No schema
gaps were found.

**Primary recommendation:** Create a new API endpoint `app/api/extractData/vision/route.ts`
that mirrors `extractData/route.ts` but calls `extractFromPdf()` instead of
`extractFinancialData()`. The vision endpoint then feeds raw `ExtractedMetrics` into the
same `computeMetrics()` → risk assessment → SSE stream pipeline already used by the
text path. This avoids modifying working code.

## Standard Stack

Phase 1 established the stack. No new libraries are needed for Phase 2.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | Installed | Claude Vision API calls | Phase 1 uses it |
| `pdf-to-img` | Installed | PDF-to-PNG conversion | Phase 1 uses it |
| `next` | 15.x | API route framework | Existing app |
| `openai` | Installed | Existing text path (unchanged) | Leave alone |

### Already Available in `lib/vision/`
| Export | Source File | Purpose |
|--------|-------------|---------|
| `extractFromPdf()` | `vision-extractor.ts` | Full multi-page extraction |
| `extractFromPdfPage()` | `vision-extractor.ts` | Single page extraction |
| `createVisionClient()` | `claude-client.ts` | Anthropic client factory |
| `EXTRACTION_TOOL` | `extraction-tool.ts` | Tool schema for Claude |
| `convertPdfToImages()` | `pdf-converter.ts` | PDF to image conversion |

**Installation:** Nothing new to install.

## Architecture Patterns

### How the Existing Text Pipeline Works

```
file (temp path)
  → parseDocument()                    # lib/document-parser.ts
  → chunkTextSemantic()               # lib/chunk-processor.ts
  → processChunksSequentially()       # OpenAI GPT-4 per chunk → ExtractedMetrics[]
  → mergeExtractionsWithConflicts()   # lib/extraction-merger.ts
  → computeMetrics() [per year]       # utils/aiProcessor.ts (local fn)
  → generateRiskAssessment()          # lib/risk-generator.ts
  → ExtractionResult { metrics_by_year, riskAssessment, ... }
```

### How the Vision Pipeline Works (Phase 1 output)

```
file (path or Buffer)
  → convertPdfToImages()              # lib/vision/pdf-converter.ts (300 DPI)
  → analyzeFinancialImage() [per page]  # Claude Vision → ExtractedMetrics per year
  → mergeMetrics() [per year]         # lib/vision/vision-extractor.ts (simple merge)
  → PdfExtractionResult { metricsByYear: Record<string, ExtractedMetrics>, ... }
```

### What Phase 2 Must Build

The vision pipeline exits at `PdfExtractionResult.metricsByYear`. The text pipeline
exits at `ExtractionResult` (which includes computed ratios, risk assessment, etc.).
Phase 2 must pipe vision output through the same post-extraction stages:

```
PdfExtractionResult.metricsByYear
  → computeMetrics() [per year]       # already in utils/aiProcessor.ts (local fn)
  → generateRiskAssessment()          # lib/risk-generator.ts
  → generateDebtHealthAssessment()    # lib/risk-generator.ts
  → calculateQuantitativeRisk()       # lib/quantitative-risk.ts
  → ExtractionResult                  # same shape used by existing SSE response
```

### Recommended Project Structure

No new directories needed. New files:

```
app/api/extractData/
├── route.ts                 # EXISTING — text-based pipeline (do not modify)
└── vision/
    └── route.ts             # NEW — vision pipeline, mirrors parent route structure

utils/
├── aiProcessor.ts           # EXISTING — text pipeline (do not modify)
└── visionProcessor.ts       # NEW — vision analog: wraps extractFromPdf() + computeMetrics()
```

### Pattern: New `visionProcessor.ts` as Thin Adapter

The key insight is that `computeMetrics()` is a private function inside `aiProcessor.ts`.
Phase 2 needs to either:
1. Extract `computeMetrics()` into a shared module (cleaner long-term), or
2. Duplicate the post-extraction stages in `visionProcessor.ts` (faster, riskier drift)

**Recommendation:** Extract `computeMetrics()` and related calculation logic into a
shared `lib/metrics-computer.ts` file that both `aiProcessor.ts` and the new
`visionProcessor.ts` import. This avoids duplication and is the correct approach
given the calculations are already well-tested.

Alternatively, `visionProcessor.ts` can import the calculation functions directly
from `lib/calculations.ts` (they are already exported there). The `computeMetrics()`
wrapper in `aiProcessor.ts` is just a thin orchestrator over those exports.

### Pattern: Vision API Route (SSE)

The vision API route must produce the same SSE stream format as the text route.
The existing route sends these event stages:
- `uploading` (5, 8, 10% progress)
- `parsing`, `chunking`, `extracting`, `merging`, `computing`, `validating`, `assessing`
- `saving` (90%)
- `conflict_detected` or `complete` or `error`

The vision route will collapse `parsing/chunking/extracting/merging` into a single
`extracting` stage since page-by-page processing is handled internally.

### Anti-Patterns to Avoid

- **Modifying `extractData/route.ts`:** The existing route is working. Adding a
  vision flag to the same route creates a code branch that's hard to test and
  could break existing extractions. Use a separate endpoint.
- **Calling `extractFinancialData()` from the vision route:** That function
  requires the OpenAI key and runs the full text pipeline. Vision bypasses it entirely.
- **Skipping `computeMetrics()` for vision output:** The vision pipeline returns raw
  `ExtractedMetrics`. All ratios (DSCR, FCCR, Senior Debt/EBITDA, etc.) must be
  computed before saving to the database or returning to the UI.
- **Using `mergeMetrics()` from vision-extractor.ts in production:** The current
  vision merger prefers "incoming" values blindly. The text pipeline's
  `mergeExtractionsWithConflicts()` has conflict detection. For Phase 2 MVP,
  the simple merge is acceptable but should be noted as a limitation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF to image | Custom canvas renderer | `pdf-to-img` (already installed) | Phase 1 validated it |
| Claude tool calling | Custom JSON parsing | `EXTRACTION_TOOL` + `tool_choice` (Phase 1) | Guarantees structured output |
| EBITDA calculation | Inline formula | `calculateEBITDA()` from `lib/calculations.ts` | Already handles edge cases |
| FCCR/DSCR ratio | Inline formula | `calculateFCCR()`, `calculateDSCR()` from `lib/calculations.ts` | Complex multi-mode logic |
| Risk assessment | Custom prompt | `generateRiskAssessment()` from `lib/risk-generator.ts` | 7-pillar analysis already built |
| Conflict detection (doc-level) | Custom logic | `detectYearConflicts()` from `lib/extraction-utils.ts` | Already used by text route |
| SSE streaming | Custom implementation | Copy pattern from `extractData/route.ts` | Identical streaming contract |

**Key insight:** All calculation, risk, and streaming logic is already modular in
`lib/`. Phase 2 is primarily wiring, not building.

## Common Pitfalls

### Pitfall 1: Schema Gap in Test Script vs. Production Tool

**What goes wrong:** `scripts/test-vision-extraction.mjs` uses a simplified schema
(only ~12 fields). `lib/vision/extraction-tool.ts` uses the full schema (30+ fields).
If the test script is used as reference, the production tool looks different.

**Why it happens:** The test script was written for quick validation, not production use.

**How to avoid:** Always reference `lib/vision/extraction-tool.ts` for the production
schema. The test script's schema is intentionally minimal.

**Warning signs:** Null values for fields like `depreciation_equipment`, `current_assets`,
`ttm_principal_payments` that the full tool schema should extract.

### Pitfall 2: fiscal_year Key Format Mismatch

**What goes wrong:** Claude returns `fiscal_year` values like `"FY2023"`, `"2023Q4"`,
or `"December 31, 2023"`. The existing text pipeline normalizes these. The vision
pipeline does not — `metricsByYear` keys are raw Claude output.

**Why it happens:** The vision merger in `vision-extractor.ts` uses `result.fiscalYear`
directly as the dictionary key without normalization.

**How to avoid:** Add year key normalization before calling `computeMetrics()`. Extract
or reuse any existing year normalization logic.

**Warning signs:** Frontend shows years as "FY2023" when existing data shows "2023".

### Pitfall 3: Missing `ANTHROPIC_API_KEY` Check

**What goes wrong:** `createVisionClient()` throws at runtime if `ANTHROPIC_API_KEY`
is not set. The error message is clear but will crash the API route without a graceful
SSE error response.

**Why it happens:** The text route guards against missing `OPENAI_API_KEY` explicitly.
The vision route must do the same for `ANTHROPIC_API_KEY`.

**How to avoid:** Call `validateApiKey()` (exported from `lib/vision/claude-client.ts`)
at the top of the async handler, catch the error, and send an SSE error event before
closing the stream.

### Pitfall 4: Large PDF Memory Usage

**What goes wrong:** Converting a 100-page financial report to 300 DPI images creates
~50-100 MB of image buffers in memory simultaneously. This can exhaust the Node.js
heap in the Next.js API route process.

**Why it happens:** `convertPdfToImages()` returns all pages as an array of buffers.
For large documents, this is held in memory while pages are processed sequentially.

**How to avoid:** Process pages one at a time using `convertPdfPage()` instead of
`convertPdfToImages()`. Convert page N, analyze it, then discard the buffer before
converting page N+1. This trades parallelism for memory safety.

**Warning signs:** OOM crashes or "heap out of memory" errors on large PDFs.

### Pitfall 5: `computeMetrics()` is Private to `aiProcessor.ts`

**What goes wrong:** The function that converts `ExtractedMetrics` → `ComputedMetrics`
(computing EBITDA, FCCR, DSCR, ratios) is not exported from `aiProcessor.ts`.

**Why it happens:** It was designed as an internal implementation detail.

**How to avoid:** Either (a) export `computeMetrics()` from `aiProcessor.ts`, or
(b) call the individual calculation functions from `lib/calculations.ts` directly
in `visionProcessor.ts`. Option (b) is cleaner and does not alter existing API surfaces.

**Warning signs:** TypeScript errors about `computeMetrics` not being exported.

### Pitfall 6: Vision Merge is Simpler Than Text Merge

**What goes wrong:** The vision pipeline uses a simple "prefer non-null incoming"
merge strategy (`mergeMetrics()` in `vision-extractor.ts`). The text pipeline uses
a weighted conflict-detecting merge (`mergeExtractionsWithConflicts()`). Vision results
may silently take a wrong value from a later page when an earlier page was more reliable.

**Why it happens:** Phase 1 vision merger was intentionally simplified for MVP.

**How to avoid:** Document this as a known limitation for Phase 2. In a future phase,
the vision merger can be upgraded to use the same conflict-aware merge from
`lib/extraction-merger.ts`.

**Warning signs:** Inconsistent EBITDA or revenue values across multi-year documents.

## Code Examples

### Calling the Vision Pipeline (from Phase 1)

```typescript
// Source: lib/vision/vision-extractor.ts
import { extractFromPdf } from '@/lib/vision';

const result = await extractFromPdf(tempPath);
// result.metricsByYear: Record<string, ExtractedMetrics>
// result.pagesProcessed: number
// result.totalUsage: { inputTokens, outputTokens }
```

### Computing Derived Metrics (reusing existing lib functions)

```typescript
// Source: lib/calculations.ts + pattern from utils/aiProcessor.ts computeMetrics()
import {
  calculateDebtMetrics,
  calculateEBITDA,
  calculateAdjustedEBITDA,
  calculateFCCR,
  calculateDSCR,
  calculateTotalDebtToCapital,
  calculateSeniorDebtToEBITDA,
  calculateInterestCoverageRatio,
  calculateDebtToEquityRatio,
  calculateCurrentRatio,
} from '@/lib/calculations';
import type { ExtractedMetrics, ComputedMetrics } from '@/types';

function computeVisionMetrics(m: ExtractedMetrics): ComputedMetrics {
  const result = m as ComputedMetrics;
  const debtResult = calculateDebtMetrics(m);
  result.senior_debt = debtResult.senior_debt;
  result.total_debt = debtResult.total_debt;
  result.debt_breakdown = debtResult.debt_breakdown;
  // ... (mirrors computeMetrics() in aiProcessor.ts)
  return result;
}
```

### SSE Stream Pattern (from existing route)

```typescript
// Source: app/api/extractData/route.ts — copy this pattern exactly
const encoder = new TextEncoder();
const stream = new TransformStream();
const writer = stream.writable.getWriter();

// Send progress event
await writer.write(encoder.encode(`data: ${JSON.stringify({
  stage: 'extracting',
  progress: 30,
  message: `Processing page ${n} of ${total}...`,
})}\n\n`));

// Send complete event (same structure as text route)
await writer.write(encoder.encode(`data: ${JSON.stringify({
  stage: 'complete',
  progress: 100,
  message: 'Complete',
  data: {
    message: 'File processed successfully',
    filename: file.name,
    projectId,
    documentId,
    extractionId: extraction?.id,
    financialMetrics: extractedData,  // ExtractionResult shape
  },
})}\n\n`));
```

### Complete `ExtractionResult` Shape (what the route must return)

```typescript
// Source: utils/aiProcessor.ts ExtractionResult interface
interface ExtractionResult {
  metrics_by_year?: Record<string, ComputedMetrics>;
  riskAssessment?: RiskData | null;
  debtHealthAssessment?: DebtHealthAssessment | null;
  quantitativeRiskAssessment?: QuantitativeRiskAssessment | null;
  validation_issues?: Record<string, string[]>;
  extraction_warnings?: string[];
  merge_conflicts?: MetricConflict[];
  chunk_stats?: { total: number; successful: number; failed: number; withWarnings: number; };
}
```

The vision route must populate `metrics_by_year`, `riskAssessment`,
`debtHealthAssessment`, and `quantitativeRiskAssessment` at minimum.
The upload page `handleDataUpdate()` reads these fields directly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text extraction only | Text + Vision (Phase 2) | Phase 2 | Vision handles scanned PDFs and complex tables |
| `formidable` for multipart | Native `req.formData()` | Already done | Simpler, no dependency |
| `bodyParser: false` needed | Not needed | Already done | API route uses Web Streams API |

**Note on model ID:** `claude-client.ts` uses `'claude-sonnet-4-20250514'`. This is
the correct model ID. The comment says "Claude 3.7 Sonnet" but the ID refers to
claude-sonnet-4. This is correct for 2026-02. No change needed.

**Deprecated/outdated:**
- `chunkText()` (non-semantic): Marked `@deprecated` in `chunk-processor.ts`, use
  `chunkTextSemantic()` instead. Not relevant to vision path.

## Open Questions

1. **Year key normalization**
   - What we know: Text pipeline normalizes fiscal year keys before storing.
     Vision pipeline does not — keys come directly from Claude's `fiscal_year` output.
   - What's unclear: Whether the text pipeline has a dedicated normalizer function
     or whether it relies on AI returning consistent formats.
   - Recommendation: Inspect `lib/extraction-merger.ts` during implementation.
     If no normalizer exists, add a simple one in `visionProcessor.ts`.

2. **Page-count threshold for memory**
   - What we know: 300 DPI images are ~1-5 MB each. Documents can be 50+ pages.
   - What's unclear: Exact page count where memory becomes problematic in the
     deployment environment (Vercel function memory limits apply).
   - Recommendation: Default to streaming page-by-page with `convertPdfPage()` to
     be safe. Process one page, discard buffer, proceed to next.

3. **Non-PDF file types**
   - What we know: The existing route accepts PDF, Excel, and Word. The vision
     pipeline only handles PDFs (pdf-to-img). Excel/Word have no image form.
   - What's unclear: Should the vision endpoint reject non-PDFs or fall back to text?
   - Recommendation: The vision endpoint should accept PDFs only and return a 400
     error for other file types. The existing text endpoint handles Excel/Word.

4. **Progress granularity**
   - What we know: Text pipeline sends progress per chunk (20-70%). Vision pipeline
     processes per page. A 50-page document = 50 progress increments.
   - What's unclear: Whether per-page progress (e.g., "Page 3/50") is valuable UX
     or noise for users.
   - Recommendation: Send per-page progress during extraction stage.

## Sources

### Primary (HIGH confidence)
- Direct file reads: `/Users/colinpoon/Dev/lendflow/types/financial.ts` — exact `ExtractedMetrics` and `ComputedMetrics` interfaces
- Direct file reads: `/Users/colinpoon/Dev/lendflow/utils/aiProcessor.ts` — full text pipeline, `computeMetrics()` logic, `ExtractionResult` type
- Direct file reads: `/Users/colinpoon/Dev/lendflow/app/api/extractData/route.ts` — SSE streaming pattern, database schema, progress stages
- Direct file reads: `/Users/colinpoon/Dev/lendflow/lib/vision/vision-extractor.ts` — Phase 1 output shape
- Direct file reads: `/Users/colinpoon/Dev/lendflow/lib/vision/extraction-tool.ts` — Claude tool schema
- Direct file reads: `/Users/colinpoon/Dev/lendflow/lib/vision/claude-client.ts` — Claude model ID, API call pattern
- Direct file reads: `/Users/colinpoon/Dev/lendflow/app/(dashboard)/(routes)/upload/page.tsx` — `handleDataUpdate()` data contract

### Secondary (MEDIUM confidence)
- None needed — all research done against live codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 1 libraries confirmed installed and working
- Architecture: HIGH — read actual source files, no inference needed
- ExtractedMetrics schema: HIGH — read `types/financial.ts` directly
- Pitfalls: HIGH — identified from direct code analysis, not community articles
- Integration approach: HIGH — based on reading both pipelines end to end

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain, 30-day window)
