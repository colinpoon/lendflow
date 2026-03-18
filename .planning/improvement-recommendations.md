# Lendflow — Improvement Recommendations

> Audit date: 2026-03-18 | Overall code health: 6.5/10

---

## Critical (Fix Immediately)

### 1. Database Operations Lack Transaction Atomicity
**Files**: `app/api/extractData/route.ts` (lines 269-290, 345-358)

Extraction insert and project risk-score update are separate Supabase calls. If the update fails, the extraction appears successful but the project never reflects the risk score.

**Fix**: Wrap the insert + update in a Supabase RPC (Postgres function) or use `.rpc()` for a transactional batch. At minimum, check every Supabase response for `.error` before proceeding.

---

### 2. Excel/Word Upload Accepted but Never Parsed
**Files**: `app/api/extractData/route.ts` (lines 60-66), `lib/document-parser.ts` (lines 33-38)

`ALLOWED_MIME_TYPES` includes Excel and Word, but `parseDocument()` only handles PDF and plain text. Users can upload `.xlsx`/`.docx` files that silently fail at the parsing stage.

**Fix**: Either implement parsing for Excel (with the existing `xlsx` dependency) and Word, or remove those MIME types from the allowed list until support is added.

---

### 3. Year-Conflict Detection Runs After Insertion
**Files**: `app/api/extractData/route.ts` (lines 269-340)

`detectYearConflicts()` is called **after** the new extraction is already inserted. If the user cancels due to a conflict, the orphaned extraction record stays in the database.

**Fix**: Run conflict detection before inserting, or implement a cleanup path that deletes the extraction if the conflict is cancelled.

---

### 4. Silent Supabase Failures Throughout the API
**Files**: `app/api/extractData/route.ts` (multiple locations)

Many `.from().update()` / `.insert()` calls log success without checking the `error` field on the response. Example at line 345-358: project risk-score update logs "✅ Project risk score updated" unconditionally.

**Fix**: Check `{ data, error }` on every Supabase call; if `error`, log it, update document status to `'failed'`, and send an error event to the SSE stream.

---

## High Priority (Next Sprint)

### 5. Risk Assessment Has No Partial-Success Path
**Files**: `utils/aiProcessor.ts` (lines 424-436)

`generateRiskAssessment()`, `generateDebtHealthAssessment()`, and `calculateQuantitativeRisk()` run sequentially with no individual try/catch. If any one fails, the entire extraction is marked failed—even though the financial metrics were extracted successfully.

**Fix**: Wrap each call independently. Return extracted metrics with `riskSnapshot: null` (etc.) rather than failing the whole pipeline.

---

### 6. File-Size Limits Are Inconsistent
**Files**: `components/FileUpload.tsx` (line 46), `app/api/extractData/route.ts` (line 59)

Frontend enforces 10 MB; API allows 50 MB. The UI error message references 30 MB. Users get confusing rejections.

**Fix**: Align to a single constant shared between client and server (e.g., a `lib/constants.ts` export), or at least make the messages consistent.

---

### 7. No Rate Limiting on the Upload Endpoint
**Files**: `app/api/extractData/route.ts`

A single authenticated user can spam uploads with no throttling, burning through Anthropic API credits.

**Fix**: Add per-user rate limiting (e.g., Upstash Redis rate limiter, or Clerk-based middleware). Even a simple in-memory token bucket per `userId` helps in the short term.

---

### 8. Negative / Zero Financial Metrics Not Handled
**Files**: `lib/calculations/` (all calculator modules)

Calculations assume positive values. Negative EBITDA, negative equity, or zero debt-service payments produce `Infinity`, `NaN`, or nonsensical ratios.

**Fix**: Guard every division. For negative EBITDA, flag the company as "operating at a loss" rather than computing a misleading DSCR. Clamp ratios or return `null` with an explanation.

---

### 9. No Retry / Backoff on Claude API Calls
**Files**: `lib/chunk-processor.ts`, `lib/risk-generator.ts`

`MAX_RETRIES: 3` is defined in constants but actual retry logic for transient 429/500 errors from the Anthropic API is missing or incomplete.

**Fix**: Implement exponential backoff with jitter for all Claude API calls. The Anthropic SDK supports automatic retries—enable it.

---

## Medium Priority (1-2 Sprints)

### 10. Scale Normalization Can Over-Correct
**Files**: `utils/aiProcessor.ts` (lines 345-385)

Three separate scale-correction passes (detected scale, cross-metric, cross-year) can conflict. A revenue figure could be corrected from raw → thousands → back to raw.

**Fix**: Track which metrics have been corrected and skip subsequent passes for already-corrected values. Add a `scale_correction_applied` flag per metric.

---

### 11. Fiscal Year Format Never Validated
**Files**: `utils/aiProcessor.ts` (lines 204-213)

`primary_fiscal_year` from the AI response could be `"FY2024"`, `"2024/2025"`, `"2024-12"`, etc. No sanitization is applied before it's stored and used as a sort key.

**Fix**: Normalize to a consistent format (e.g., `"2024"` or `"2024-12-31"`) immediately after extraction. Reject unrecognizable formats with a warning.

---

### 12. Debug Logs Leak Sensitive Financial Data
**Files**: `utils/aiProcessor.ts` (lines 661-750)

`DEBUG_FINANCIALS` gates detailed output, but if accidentally enabled in production, full EBITDA breakdowns, interest amounts, and principal payments are logged in plaintext.

**Fix**: Use structured logging (e.g., Pino) with a redaction list for sensitive fields. In production, always redact numeric financial values regardless of the debug flag.

---

### 13. Synchronous File I/O in Risk Cache
**Files**: `lib/risk-generator.ts`

`readFileSync()` / `writeFileSync()` block the Node.js event loop during cache operations. Under concurrent requests this becomes a bottleneck.

**Fix**: Replace with `fs.promises.readFile()` / `fs.promises.writeFile()` or use an in-memory LRU cache.

---

### 14. Warnings Array Grows Unbounded
**Files**: `utils/aiProcessor.ts` (lines 184-253, 310-318)

Every chunk validation warning, merge-conflict warning, and reconciliation warning is appended without a cap. A 100-chunk document could produce hundreds of warnings inflating the response payload.

**Fix**: Cap warnings at ~50 entries; summarize the rest as "...and N more warnings".

---

## Low Priority (Technical Debt)

### 15. Zero Test Coverage
No unit tests, integration tests, or test configuration exist. The calculation modules (`ebitda-calculator`, `dscr-calculator`, `fccr-calculator`, `debt-calculator`) are pure functions—ideal candidates for unit tests.

**Fix**: Add Vitest. Start with the calculation modules (they're pure functions with known inputs/outputs). Then add integration tests for the extraction pipeline using fixture PDFs from `public/financialReports/`.

---

### 16. Type Safety Erosion
**Files**: `utils/aiProcessor.ts` (lines 243, 399), `lib/supabase/types.ts`

Multiple `as unknown as X` casts and `Record<string, unknown>` types bypass TypeScript's safety net. If the AI output schema drifts from the TypeScript types, bugs hide at runtime.

**Fix**: Use Zod schemas to validate AI responses at the boundary. Generate TypeScript types from the Zod schemas so they stay in sync.

---

### 17. Error Boundaries Not Applied to Key Components
**Files**: `components/FileUpload.tsx`, `components/FinancialTable.tsx`, `components/RiskAssessment.tsx`

`ErrorBoundary` component exists but isn't wrapping the data-display components. A malformed extraction result crashes the entire page.

**Fix**: Wrap `FinancialTable`, `RiskAssessment`, and `EBITDA` components with `<ErrorBoundary>`.

---

### 18. AI Model Version Hardcoded
**Files**: `lib/constants.ts` (line 12)

`MODEL: 'claude-sonnet-4-20250514'` requires a code deploy to switch versions.

**Fix**: Move to an environment variable (`ANTHROPIC_MODEL`) with the current value as default. This allows A/B testing and quick rollback.

---

### 19. No `.env.example` File
New developers must guess which environment variables are needed.

**Fix**: Add `.env.example` listing all required keys with placeholder values.

---

### 20. Stale Processing Records After Crashes
**Files**: `app/api/extractData/route.ts`

If the server crashes mid-extraction, documents stay in `processing` status forever with no cleanup mechanism.

**Fix**: Add a background job (or cron via Supabase) that marks documents stuck in `processing` for >15 minutes as `failed`.

---

## Quick Wins (< 1 hour each)

| # | Item | File |
|---|------|------|
| A | Check all Supabase responses for `.error` | `route.ts` |
| B | Remove Excel/Word from `ALLOWED_MIME_TYPES` | `route.ts` |
| C | Add `.env.example` | project root |
| D | Wrap display components in `<ErrorBoundary>` | `upload/page.tsx` |
| E | Add `ANTHROPIC_MODEL` env var | `lib/constants.ts` |
| F | Align file-size limits (frontend ↔ API) | `FileUpload.tsx`, `route.ts` |

---

## Architecture Strengths Worth Preserving

- **Modular calculation pipeline** — each financial ratio has its own module with clear inputs/outputs
- **Conflict-aware extraction** — multi-chunk merging with variance thresholds and AI reconciliation is sophisticated and well-designed
- **SSE progress streaming** — good UX for long-running extractions
- **Confidence scoring** — every extracted value carries confidence + source statement
- **Quantitative risk model** — multi-pillar scoring with health assessments goes beyond basic ratio analysis
