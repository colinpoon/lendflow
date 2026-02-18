# Phase 3: Validation & Benchmarking - Research

**Researched:** 2026-02-17
**Domain:** Accuracy benchmarking, cost tracking, side-by-side comparison UI
**Confidence:** HIGH (codebase verified), MEDIUM (cost estimates), LOW (GPT-4 Turbo token counts)

---

## Summary

Phase 3 requires three independent deliverables: a side-by-side comparison UI (VAL-01), accuracy benchmarking against known-good values from Zedcor and Taiga documents (VAL-02/VAL-03), and token usage/cost logging per extraction (COST-01/COST-02).

The existing codebase is already well-positioned for this phase. Both `ExtractionResult` types (text and vision) are structurally identical, both pipelines return `metrics_by_year` keyed by fiscal year with `ComputedMetrics`, and token usage is already captured per-page in `lib/vision/vision-extractor.ts` (via `response.usage.input_tokens` / `response.usage.output_tokens`). The vision pipeline does NOT currently surface token usage to the API response or the database — that must be added. The text pipeline (OpenAI) does not log token usage at all — that must also be added.

The ground truth documents available in `public/financialReports/` are Zedcor (two annual reports: FY2023 and FY2024) and Taiga (FY2024). Ground truth values must be established manually by reading the source PDFs, not extracted by AI.

**Primary recommendation:** Build the comparison infrastructure around the shared `ComputedMetrics` type. Run both pipelines against the same file, store token usage in the `extractions` table (new columns), and display diffs in a new `/compare` page using the existing Shadcn/Tailwind component system.

---

## Standard Stack

No new libraries needed. All required functionality exists in the current stack.

### Core (existing)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.74.0 | Claude Vision token usage is in `response.usage` | Already integrated |
| `openai` | ^4.89.0 | GPT-4 Turbo token usage is in `response.usage` | Already integrated |
| `@supabase/supabase-js` | ^2.95.3 | Persisting token counts alongside extractions | Already integrated |
| `@radix-ui/react-tabs` | ^1.1.3 | Side-by-side tab layout | Already used on upload/vision pages |
| Tailwind CSS v4 | ^4 | Diff highlighting via conditional classes | Already configured |

### Supporting (existing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.484.0 | Delta/diff icons in comparison table | Already used |
| `framer-motion` | ^12.29.0 | Highlight animation on changed cells | Already installed, use sparingly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase columns for token counts | Separate `token_logs` table | Separate table adds a join; columns are simpler given low cardinality |
| New `/compare` page | Modal on existing `/vision` page | Page is cleaner — comparison is a first-class workflow |
| JSON file for ground truth | Hardcoded constants | JSON file in `lib/benchmarks/` is easier to update without code change |

**Installation:** None required. No new packages.

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── benchmarks/
│   ├── ground-truth.ts         # Ground truth values for Zedcor and Taiga
│   └── accuracy.ts             # Accuracy calculation functions
app/
├── (dashboard)/(routes)/
│   └── compare/
│       └── page.tsx            # Side-by-side comparison UI (VAL-01)
app/api/
└── compare/
    └── route.ts                # Runs both extractions, returns results + token counts
```

### Pattern 1: Ground Truth as Typed Constants

**What:** Store known-correct values as a TypeScript object keyed by `document_name -> fiscal_year -> metric_name -> number`.

**When to use:** Source of truth for accuracy calculations. Never let AI generate ground truth — read values from the source PDF manually.

**Example:**
```typescript
// lib/benchmarks/ground-truth.ts
export interface GroundTruthEntry {
  document: string;
  fiscal_year: string;
  values: Partial<Record<keyof ExtractedMetrics, number>>;
  notes?: string; // e.g., "from Note 12, consolidated basis"
}

export const GROUND_TRUTH: GroundTruthEntry[] = [
  {
    document: 'Zedcor-FY2024',
    fiscal_year: '2024',
    values: {
      revenue: 12345,         // $000s — read from income statement
      net_income: 1234,
      ebitda: 3456,
      adjusted_ebitda: 3800,
      shareholders_equity: 8900,
      total_debt: 15000,
    },
    notes: 'Values from 2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf'
  },
  // Taiga FY2024, Zedcor FY2023...
];
```

### Pattern 2: Accuracy Metric as % Variance

**What:** For each extracted value, compute `abs((extracted - truth) / truth) * 100`. A value is "accurate" if variance < threshold (recommend 10% for financial data — tighter than the 20% conflict threshold in the existing merger).

**When to use:** VAL-03. Report per-metric accuracy and aggregate accuracy for EBITDA components.

**Example:**
```typescript
// lib/benchmarks/accuracy.ts
export interface AccuracyResult {
  metric: string;
  truth: number;
  text_extracted: number | null;
  vision_extracted: number | null;
  text_variance_pct: number | null;    // null if extracted is null
  vision_variance_pct: number | null;
  text_accurate: boolean;              // variance < ACCURACY_THRESHOLD
  vision_accurate: boolean;
}

const ACCURACY_THRESHOLD_PCT = 10;    // within 10% = accurate

export function calculateAccuracy(
  truth: GroundTruthEntry,
  textMetrics: ComputedMetrics | null,
  visionMetrics: ComputedMetrics | null
): AccuracyResult[] {
  const results: AccuracyResult[] = [];
  for (const [metric, truthValue] of Object.entries(truth.values)) {
    if (truthValue == null) continue;
    const textVal = textMetrics?.[metric as keyof ComputedMetrics] as number | null ?? null;
    const visionVal = visionMetrics?.[metric as keyof ComputedMetrics] as number | null ?? null;
    results.push({
      metric,
      truth: truthValue,
      text_extracted: textVal,
      vision_extracted: visionVal,
      text_variance_pct: textVal != null ? Math.abs((textVal - truthValue) / truthValue) * 100 : null,
      vision_variance_pct: visionVal != null ? Math.abs((visionVal - truthValue) / truthValue) * 100 : null,
      text_accurate: textVal != null && Math.abs((textVal - truthValue) / truthValue) * 100 < ACCURACY_THRESHOLD_PCT,
      vision_accurate: visionVal != null && Math.abs((visionVal - truthValue) / truthValue) * 100 < ACCURACY_THRESHOLD_PCT,
    });
  }
  return results;
}
```

### Pattern 3: Token Usage Threading Through Vision Pipeline

**What:** The token usage data already exists in `lib/vision/vision-extractor.ts` as `PdfExtractionResult.totalUsage`. It is currently discarded by `utils/visionProcessor.ts` (not included in the returned `ExtractionResult`). Thread it through by adding optional fields to `ExtractionResult`.

**When to use:** COST-01. Add to the `ExtractionResult` type so the API route can persist it.

**Example:**
```typescript
// In utils/aiProcessor.ts ExtractionResult interface (add optional fields)
export interface ExtractionResult {
  // existing fields...
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
    model: string;
    cost_usd?: number;
  };
}

// In utils/visionProcessor.ts extractVisionData()
// visionResult already has totalUsage — add to return:
return {
  metrics_by_year: computed,
  riskAssessment,
  // ...
  token_usage: {
    input_tokens: visionResult.totalUsage.inputTokens,
    output_tokens: visionResult.totalUsage.outputTokens,
    model: 'claude-sonnet-4-20250514',
    cost_usd: calculateVisionCost(visionResult.totalUsage),
  },
};
```

### Pattern 4: Database Schema — Add Token Columns

**What:** Add `token_input`, `token_output`, `token_model`, `cost_usd` columns to the `extractions` table. This avoids a separate log table and keeps cost data co-located with extraction results.

**When to use:** COST-01 and COST-02 persistence. Supabase migration required.

```sql
-- Migration: add token tracking to extractions
ALTER TABLE extractions
  ADD COLUMN IF NOT EXISTS token_input INTEGER,
  ADD COLUMN IF NOT EXISTS token_output INTEGER,
  ADD COLUMN IF NOT EXISTS token_model TEXT,
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6);
```

### Pattern 5: Side-by-Side Comparison Page

**What:** A new `/compare` page with a split panel. Left shows text extraction results; right shows vision extraction results. Differences between corresponding metric values are highlighted. The page accepts a file upload and runs both extractions simultaneously (or sequentially to avoid rate limits).

**When to use:** VAL-01. Follow the established page pattern from `/upload/page.tsx` and `/vision/page.tsx`.

**Architecture decision:** Run both extractions server-side via a single `/api/compare` POST endpoint. The endpoint returns `{ text: ExtractionResult, vision: ExtractionResult }`. The frontend renders a diff table from this response. Do NOT run two separate SSE streams — a single JSON response is simpler for a comparison workflow.

```typescript
// app/api/compare/route.ts
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Run both extractions concurrently (if both support same format)
  // Vision only supports PDF; text supports PDF/Excel/Word
  const [textResult, visionResult] = await Promise.allSettled([
    extractFinancialData(tempFilePath),
    extractVisionData(pdfBuffer),
  ]);

  return NextResponse.json({
    text: textResult.status === 'fulfilled' ? textResult.value : null,
    text_error: textResult.status === 'rejected' ? textResult.reason.message : null,
    vision: visionResult.status === 'fulfilled' ? visionResult.value : null,
    vision_error: visionResult.status === 'rejected' ? visionResult.reason.message : null,
  });
}
```

### Anti-Patterns to Avoid

- **Using AI to generate ground truth:** Ground truth values must come from reading the source PDFs manually. If the AI read them, they would reflect the AI's extraction quality, not the document's ground truth.
- **Computing accuracy using adjusted/calculated EBITDA for the threshold:** Use the raw extracted metric values before downstream calculation, to isolate the extraction quality. Compare `ebitda` (as extracted), not `adjusted_ebitda` (which involves computation).
- **Running both extractions in the comparison page via SSE:** SSE adds complexity for a comparison workflow where both results are needed before rendering. Use a regular JSON response.
- **Storing token usage only in-memory:** The cost comparison report (COST-02) requires persistent data. Always write to the database, even during benchmarking.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentage variance calculation | Custom formula | `Math.abs((extracted - truth) / truth) * 100` | Trivial, but keep it in a utility function so the threshold is centralized |
| Cost calculation | Ad-hoc arithmetic | Typed `calculateCost(usage, model)` function | Pricing changes; centralize the rate constants |
| Metric diff highlighting | Custom CSS | Tailwind conditional classes (`text-red-600`, `text-green-600`) | Already installed, sufficient for a PoC |
| Comparison state management | Redux/Zustand | `useState` in the compare page | PoC scope doesn't require shared state across pages |

**Key insight:** The comparison phase is data plumbing and display logic. The heavy lifting (extraction, computation, risk assessment) is already done. Don't overbuild — this is a PoC validation exercise, not a production analytics platform.

---

## Common Pitfalls

### Pitfall 1: Ground Truth Documents Have Multiple Annual Reports

**What goes wrong:** The `public/financialReports/` directory has two Zedcor files: `2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf` (FY2023) and `2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf` (FY2024). If you run both through the same extraction without specifying the ground truth year, accuracy calculations will match the wrong year.

**Why it happens:** Year normalization in the vision pipeline uses regex to detect `20\d{2}` — both documents will produce year keys like `2023` or `2024`. Running FY2024 Zedcor against FY2023 ground truth produces spurious "inaccurate" results.

**How to avoid:** Ground truth entries must specify both document file name AND fiscal year. Always match `ExtractedMetrics` keyed by `fiscal_year` string against the correct `GroundTruthEntry`.

**Warning signs:** Accuracy report shows 0% match on all metrics for a known document.

---

### Pitfall 2: Token Cost Comparison Is Not Apples-to-Apples

**What goes wrong:** Vision uses Claude Sonnet 4 at $3/$15 per million tokens. Text uses GPT-4 Turbo at $10/$30 per million tokens. A naive "vision costs more per token" conclusion ignores that the models are different and that vision's per-document token count may be lower than GPT-4 Turbo's because vision processes images directly while text extraction first parses the PDF into text (which GPT-4 Turbo then processes in multiple chunks).

**Why it happens:** The text pipeline processes 25,000-character semantic chunks of extracted text through GPT-4 Turbo. A 20-page financial PDF might extract 60,000-80,000 characters of text, requiring 3 chunks, each consuming 4,000 GPT-4 Turbo output tokens. Vision processes all 20 pages as images, each image costing ~1,600 image tokens plus text tokens.

**How to avoid:** Report cost per document as the primary comparison unit, not cost per token. The planner should create a cost logging utility that calculates total cost per extraction run (not per chunk).

**Warning signs:** Vision "costs more" per extraction even though it uses a cheaper model — suggests image token count is inflating the calculation incorrectly.

---

### Pitfall 3: Known Phase 2 Issues Will Skew Accuracy Results

**What goes wrong:** Phase 2 testing revealed: (a) shareholders' equity mismatch ($114M vision vs $12M text on test.pdf), (b) debt underreporting by vision, (c) vision finding only 1 fiscal year vs 2 from text. These are real accuracy gaps. The benchmarking must surface and document these gaps, not hide them.

**Why it happens:** Vision is processing a new format (images) and may struggle with multi-column layouts, page-spanning tables, or notes that span multiple pages. These are prompt engineering problems, not fundamental vision limitations.

**How to avoid:** The accuracy report should distinguish between "extraction failure" (metric is null) and "extraction error" (metric present but wrong). Both are accuracy failures but require different fixes.

**Warning signs:** 100% accuracy on all metrics — this is impossible given Phase 2 observations. If you see this, the ground truth values are wrong or the comparison is matching incorrect years.

---

### Pitfall 4: The `/api/compare` Endpoint May Time Out

**What goes wrong:** Running both text and vision extractions for a 20-page PDF concurrently could take 3-5 minutes total. Next.js API routes default to 30-second timeout on Vercel. Local dev has no timeout but production deployments do.

**Why it happens:** Vision processes each page sequentially (Phase 2 decision: avoid Claude rate limits). Text processes chunks sequentially too. Running both concurrently doubles CPU time but still hits the sequential bottleneck within each pipeline.

**How to avoid:** For the PoC, add `export const maxDuration = 300;` to the compare API route (Next.js 15 supports this for Fluid compute). Alternatively, use the existing SSE pattern from `/api/extractData/vision/route.ts` and stream progress. The SSE approach is more robust but adds complexity.

**Warning signs:** Extraction starts but frontend times out waiting for comparison response.

---

### Pitfall 5: Shadcn Tabs Cannot Handle Two Independent SSE Streams Well

**What goes wrong:** If you try to run two concurrent SSE streams (one for text, one for vision) and display progress in a tab panel, the React state management becomes complex — each stream has its own progress, and the UI must handle one completing before the other.

**Why it happens:** SSE is designed for one-directional push from server to client. Two simultaneous SSE connections from one page is browser-supported but requires two `EventSource` objects or two `fetch` with streaming, each managed independently.

**How to avoid:** Use a single `/api/compare` endpoint that returns a plain JSON response. Accept the latency trade-off for the PoC. Mark this as a known limitation in the comparison report.

**Warning signs:** Frontend shows comparison results for text but not vision (or vice versa) due to race condition in SSE handlers.

---

## Code Examples

Verified patterns from existing codebase:

### Token Usage Already Captured in Vision Extractor

```typescript
// Source: /lib/vision/vision-extractor.ts lines 122-124
totalInputTokens += result.usage.inputTokens;
totalOutputTokens += result.usage.outputTokens;

// Returned at line 131-138:
return {
  metricsByYear,
  pageResults,
  totalUsage: {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  },
  pagesProcessed: pageResults.length,
};
```

This data exists in `visionResult.totalUsage` inside `extractVisionData()` but is currently discarded when building the return object.

### Cost Calculation Function (to build)

```typescript
// Pricing as of 2026-02-17 (from platform.claude.com/docs/en/about-claude/pricing)
// claude-sonnet-4-20250514 = Claude Sonnet 4 = $3/MTok input, $15/MTok output
const VISION_COST_PER_M_INPUT = 3.00;   // USD per million input tokens
const VISION_COST_PER_M_OUTPUT = 15.00; // USD per million output tokens

// GPT-4 Turbo (gpt-4-turbo-2024-04-09) = $10/MTok input, $30/MTok output
const TEXT_COST_PER_M_INPUT = 10.00;    // USD per million input tokens
const TEXT_COST_PER_M_OUTPUT = 30.00;   // USD per million output tokens

export function calculateVisionCostUsd(usage: { inputTokens: number; outputTokens: number }): number {
  return (
    (usage.inputTokens / 1_000_000) * VISION_COST_PER_M_INPUT +
    (usage.outputTokens / 1_000_000) * VISION_COST_PER_M_OUTPUT
  );
}
```

### Image Token Estimation

```typescript
// Source: platform.claude.com/docs/en/build-with-claude/vision
// Formula (when image does NOT need resizing): tokens = (width * height) / 750
// API auto-resizes images > 1568px on long edge to fit
// At 300 DPI (scale 4.17), a US Letter page (8.5" x 11") = 2550 x 3300 px
// After resize to 1568px long edge: 1568 x 1209 px (preserving aspect ratio)
// Tokens: (1568 * 1209) / 750 = ~2529 tokens per page (after resize)
// But official docs show max ~1600 tokens for max-size images — use 1600 as upper bound

// Estimated vision cost for a 20-page PDF:
// Input: 20 pages * ~1600 image tokens + text tokens per page (~400)
// Total input: ~40,000 tokens = $0.12 per 20-page doc
// Plus output (tool_use response): ~20 pages * 400 output tokens = ~8,000 tokens = $0.12
// Estimated vision total: ~$0.24 per 20-page document

// Estimated text cost for a 20-page PDF (GPT-4 Turbo):
// Assumes 3 chunks at 25,000 chars (~6,250 tokens each) = ~18,750 input tokens
// Plus system prompt overhead (~2,000 tokens per chunk) = ~24,750 input tokens total
// Total output: ~3 chunks * 2,000 output tokens = ~6,000 tokens
// Estimated text total: (24,750/1M * $10) + (6,000/1M * $30) = $0.248 + $0.18 = ~$0.43 per doc
// Vision target: < 2x text cost = must stay below ~$0.86 per doc — well within range
```

### Metric Diff Rendering Pattern

```typescript
// Follow the existing FinancialTable.tsx rendering pattern
// Use Tailwind conditional classes for diff highlighting

function MetricRow({ label, textValue, visionValue, truthValue }: MetricRowProps) {
  const diff = textValue != null && visionValue != null
    ? Math.abs(textValue - visionValue) / Math.max(Math.abs(textValue), Math.abs(visionValue))
    : null;

  const hasDiff = diff != null && diff > 0.10; // >10% variance = highlight

  return (
    <tr>
      <td className="text-sm text-muted-foreground">{label}</td>
      <td className={cn('tabular-nums', hasDiff && 'text-amber-600 font-medium')}>
        {formatCurrency(textValue)}
      </td>
      <td className={cn('tabular-nums', hasDiff && 'text-amber-600 font-medium')}>
        {formatCurrency(visionValue)}
      </td>
    </tr>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Text-only extraction (GPT-4 Turbo) | Vision extraction (Claude Sonnet 4) | Phase 2 (2026-02) | Vision preserves table structure; text misses multi-column layouts |
| No token tracking | Token usage in `response.usage` (both APIs) | Always existed | Just not plumbed through to DB — needs connecting |
| Manual accuracy checking | Structured ground truth + accuracy function | Phase 3 (now) | Enables reproducible benchmarks |

**Deprecated/outdated:**
- `chunk-processor.ts#chunkText()`: Marked `@deprecated` in the codebase, replaced by `chunkTextSemantic()`. Do not reference in new code.

---

## Open Questions

1. **Ground truth values for Zedcor and Taiga**
   - What we know: The PDFs exist in `public/financialReports/`. The Phase 2 test showed Vision found $114M equity on test.pdf vs Text's $12M — one is wrong.
   - What's unclear: What are the actual correct values? Need manual human review of each PDF to establish ground truth before any accuracy calculation is meaningful.
   - Recommendation: Make establishing ground truth the FIRST task in Phase 3, before any code is written. Planner should create a manual review task gated on human completion.

2. **Token count for text extraction (OpenAI GPT-4 Turbo)**
   - What we know: The text pipeline (`lib/chunk-processor.ts`) calls OpenAI but the API response's `usage` field is not captured anywhere in the current code.
   - What's unclear: Whether `openai` SDK's `ChatCompletion` response includes usage. It does — `response.usage.prompt_tokens` and `response.usage.completion_tokens` — but the call site in `chunk-processor.ts` needs to be checked.
   - Recommendation: Read `lib/chunk-processor.ts` fully before planning COST-01 for the text pipeline. The planner should verify the OpenAI response shape before estimating task size.

3. **Whether `/api/compare` should use SSE or plain JSON**
   - What we know: Both existing extraction endpoints use SSE (for progress updates). A comparison endpoint needs both results before rendering.
   - What's unclear: Whether users need live progress on the compare page, or whether they can wait for a single response.
   - Recommendation: Start with plain JSON + loading spinner. SSE is a Phase 3+ enhancement if needed.

4. **Test.pdf document identity**
   - What we know: Phase 2 testing used `test.pdf` (not in the named financialReports) and found a $114M vs $12M equity discrepancy. The planner should clarify which document `test.pdf` refers to and whether it has ground truth available.
   - What's unclear: Is `test.pdf` one of the named documents (Zedcor, Taiga, KITS, PBHC, etc.) or a separate file?
   - Recommendation: Benchmark against Zedcor and Taiga only (as specified in requirements). Skip `test.pdf` unless it can be identified.

---

## Sources

### Primary (HIGH confidence)
- `/Users/colinpoon/Dev/lendflow/lib/vision/vision-extractor.ts` — Token usage already captured in `PdfExtractionResult.totalUsage`
- `/Users/colinpoon/Dev/lendflow/utils/visionProcessor.ts` — Shows where token data is discarded (not in return object)
- `/Users/colinpoon/Dev/lendflow/lib/constants.ts` — Confirms `gpt-4-turbo-2024-04-09` is the text extraction model
- `platform.claude.com/docs/en/about-claude/pricing` — Claude Sonnet 4: $3/MTok input, $15/MTok output (fetched 2026-02-17)
- `platform.claude.com/docs/en/build-with-claude/vision` — Image token formula: `tokens = (width * height) / 750`, max ~1600 tokens after auto-resize (fetched 2026-02-17)
- `/Users/colinpoon/Dev/lendflow/.planning/phases/02-vision-extraction-pipeline/02-VERIFICATION.md` — Known Phase 2 issues and gaps

### Secondary (MEDIUM confidence)
- WebSearch verified: GPT-4 Turbo `gpt-4-turbo-2024-04-09` = $10/MTok input, $30/MTok output (multiple search results consistent; OpenAI pricing page returned 403)

### Tertiary (LOW confidence)
- Estimated token counts per document (20-page PDF): ~40,000 vision input tokens, ~24,750 text input tokens. These are estimates based on formula calculations; actual counts will vary by document density.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from `package.json` and existing component usage
- Architecture: HIGH — patterns derived directly from existing `/upload/page.tsx` and `/vision/page.tsx`
- Cost estimates: MEDIUM — pricing verified from official docs; token counts are estimates
- Pitfalls: HIGH for code pitfalls (verified against codebase); MEDIUM for cost comparison pitfalls (estimates)
- Ground truth: LOW — actual values not yet known; must be established manually

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (pricing changes; re-verify model costs before implementing COST-02)
