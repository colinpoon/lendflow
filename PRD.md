# Lendflow — Product Requirements Document

## What It Is

Lendflow is an **AI-powered bank loan risk analysis platform** built to compete with the manual processes used by traditional financial institutions. Instead of an analyst spending hours reading through financial statements, Lendflow uses Claude Sonnet 4 to extract, compute, and assess financial data from uploaded documents in minutes.

---

## Mission

Reduce the time and cost of commercial loan underwriting by automating the extraction of financial metrics, calculation of covenant ratios, and generation of risk assessments — while maintaining the accuracy and rigor expected by senior credit officers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **AI Engine** | Anthropic Claude Sonnet 4 (`claude-sonnet-4-20250514`) |
| **Auth** | Clerk |
| **Database** | Supabase (PostgreSQL) |
| **UI** | Shadcn/UI + Radix primitives + Tailwind CSS v4 |
| **Charts** | Recharts |
| **Animations** | Framer Motion |
| **Document Parsing** | pdf-parse, pdfjs-dist, pdf-lib, pdf2json, xlsx |
| **Theme** | next-themes (light/dark mode) |

---

## Core Data Flow

```
Document Upload (PDF/Excel/Word)
  → /api/extractData (multipart form handling)
    → document-parser.ts (parse to text)
    → chunk-processor.ts (semantic chunking, 25k char target, 5% overlap)
    → Sequential AI extraction (Claude Sonnet 4, temp=0 for determinism)
    → extraction-merger.ts (multi-chunk merge with conflict detection)
    → extraction-reconciler.ts (AI-powered resolution for >20% variance)
    → calculations/ (EBITDA, FCCR, DSCR, debt metrics, ratios)
    → risk-generator.ts + quantitative-risk.ts (risk assessment)
  → Frontend Display (tables, gauges, breakdowns, risk cards)
```

---

## What It Extracts (Per Fiscal Year)

**From the AI** (raw `ExtractedMetrics` — raw document values ONLY, no AI computation):
- **Income Statement**: revenue, net income, expenses, interest (with income), taxes, depreciation/amortization (with granular breakdown: equipment, ROU, intangibles)
- **Balance Sheet**: shareholders' equity, current assets/liabilities, full `DebtComponents` (16 line items: bank debt, term loans, revolving credit, lease liabilities, notes payable, subordinated debt, convertible debt, etc.)
- **Cash Flow**: CapEx, proceeds from LT debt, cash taxes, distributions, principal/interest payments, lease payments, repayment of debt
- **Fixed Charges**: senior/subordinated/lease interest, lease payments (operating + finance), principal payments, preferred dividends
- **Adjusted EBITDA Components**: 25+ adjustment categories (non-cash, one-time expenses/gains, owner adjustments, FX, pro forma)

---

## What It Computes

| Ratio | Formula | Purpose |
|---|---|---|
| **EBITDA** | Net Income + Interest + Taxes + D&A | Reported earnings before interest, taxes, depreciation, amortization |
| **Adjusted EBITDA** | EBITDA +/- non-cash, one-time, owner, FX, pro forma adjustments | True operating cash flow |
| **Senior Debt** | Sum of bank debt + term loans + revolving credit + lease liabilities (configurable) | Priority-secured obligations |
| **Total Debt** | Sum of all interest-bearing obligations from `DebtComponents` | Full obligation picture |
| **Total Capital** | Total Debt + Shareholders' Equity | Capital structure base |
| **Profit Margin** | Net Income / Revenue | Profitability ratio |
| **FCCR** (Covenant) | (Adj EBITDA - Unfunded CapEx - Cash Taxes - Distributions) / (Principal + Interest + Leases) | Can the borrower cover fixed obligations? |
| **DSCR** (Banker's) | Adj EBITDA / Total Debt Service | Debt service capacity |
| **Senior Debt/EBITDA** | Senior Debt / Adj EBITDA | Leverage |
| **Funded Debt/EBITDA** | Funded Debt / Adj EBITDA | Bank-specific leverage |
| **Total Debt/Total Capital** | Total Debt / (Total Debt + Equity) | Capital structure |
| **Interest Coverage** | EBITDA / Interest Expense | Interest paying ability |
| **Debt-to-Equity** | Total Debt / Equity | Balance sheet leverage |
| **Current Ratio** | Current Assets / Current Liabilities | Short-term liquidity |

---

## Internal Calculation Principle

**ALL computed metrics must be calculated by the TypeScript application, never by the AI.**

The AI extraction layer exists solely to read raw values from financial documents and return them as-is. The app's `lib/calculations/` engine is the single source of truth for every derived figure. This separation ensures:

1. **Determinism** — TypeScript arithmetic is exact; LLM arithmetic is approximate
2. **Auditability** — every calculation has a code path that can be inspected and tested
3. **Correctness after pipeline corrections** — scale normalization, conflict resolution, and arithmetic validation happen post-extraction; any AI-computed aggregate becomes stale after these corrections
4. **Consistency** — the same formula applies to every document, not whatever the LLM infers

**Gold standard pattern:** The `ebitda` field is present in the extraction schema but the prompt enforces `"ebitda": null` — the app always calculates it from `net_income + interest + taxes + depreciation_amortization`. This pattern must be replicated for all derived metrics.

**What the AI should extract:** Only values that appear verbatim in the document (line items, balances, rates). If a value requires summing, subtracting, dividing, or any arithmetic to derive, it belongs in `lib/calculations/`.

---

## Configurable Covenant Parameters

Lendflow models real loan agreement flexibility:
- **CapEx Treatment**: unfunded (default), all, none, or custom percentage
- **Lease Debt Treatment**: include (IFRS 16 default) or exclude from senior debt
- **Operating Lease Treatment**: include or exclude from FCCR denominator

---

## Risk Assessment

**Quantitative Risk Scoring** — weighted across 3 pillars:
- FCCR: 50% weight
- Senior Debt/EBITDA: 35% weight
- Total Debt/Total Capital: 15% weight

**Qualitative AI Risk Assessment** — 5 pillars:
1. Debt Service Capacity (30%)
2. Leverage & Capital Structure (25%)
3. Profitability (20%)
4. Cash Flow Adequacy (15%)
5. Financial Trajectory (10%)

Health levels: Excellent → Good → Adequate → Weak → Poor (with WCAG AA color coding)

---

## Extraction Quality Pipeline

This is where the real sophistication lives:

1. **Semantic Chunking** — 25k character chunks with 5% overlap, respecting paragraph/table boundaries
2. **Sequential Processing** — deterministic extraction order for reproducibility
3. **Source Tagging** — every value tagged with its source statement (income statement, balance sheet, cash flow, notes)
4. **Canonical Statement Map** — defines which statement is authoritative for each metric (e.g., D&A comes from cash flow statement, not income statement)
5. **Weighted Merge** — table values (0.92) > primary text (0.75) > overlap regions (0.68) > inferred (0.50)
6. **Conflict Detection** — 5% variance threshold (audit materiality standard)
7. **AI Reconciliation** — for conflicts >20% variance, Claude re-evaluates with full context
8. **Scale Normalization** — detects and corrects raw dollars vs. thousands vs. millions mismatches
9. **Arithmetic Validation** — cross-checks metrics for internal consistency

---

## Application Structure

**7 API Routes**:
- `/api/extractData` — main extraction pipeline
- `/api/extractData/vision` — vision-based extraction for scanned PDFs
- `/api/compare` — compare two documents
- `/api/resolve-conflict` — AI conflict resolution
- `/api/projects` + `/api/projects/[id]` — CRUD for projects
- `/api/documents/[id]` — document management

**Key Pages**:
- `/` — landing page
- `/sign-in`, `/sign-up` — Clerk auth
- `/dashboard` — project list (Supabase-backed, per-user)
- `/dashboard/[projectId]` — project detail with full analysis
- `/dashboard/new` — create new project
- `/compare` — side-by-side document comparison
- `/vision` — vision upload for image-based PDFs
- `/instruments` — financial instruments page

**20+ Components** including: FileUpload, FinancialTable, EBITDA, AdjustedEBITDA, FCCRBreakdown, RiskAssessment, QuantitativeRiskCard, WeightedRiskGauge, DebtHealthMeters, ComparisonTable, ExtractionWarnings, AccuracyReport, GroundTruthDebugger, YearConflictDialog, CommandPalette, AppSidebar, ThemeToggle

---

## Test Data

11 real financial reports in `public/financialReports/` from companies like Zedcor, ADEN, KITS, PBHC, Taiga, Parkland, and PetValu — used for accuracy and regression testing.

---

## Calculation Engine (`lib/calculations/`)

7 dedicated calculator modules:
- `ebitda-calculator.ts` — EBITDA and Adjusted EBITDA with full breakdown
- `fccr-calculator.ts` — Covenant FCCR with configurable CapEx/lease treatment
- `dscr-calculator.ts` — Banker's DSCR
- `debt-calculator.ts` — Senior debt, funded debt, debt breakdown
- `debt-service-resolver.ts` — Resolves best source for principal/interest/lease values
- `ratio-calculator.ts` — Leverage, coverage, and liquidity ratios
- `index.ts` — barrel exports

---

### Workflow Orchestration

### 1. Plan Mode Default
	•	Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
	•	If something goes sideways, STOP and re-plan immediately — don’t keep pushing
	•	Use plan mode for verification steps, not just building
	•	Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
	•	Use subagents liberally to keep main context window clean
	•	Offload research, exploration, and parallel analysis to subagents
	•	For complex problems, throw more compute at it via subagents
	•	One task per subagent for focused execution

### 3. Self-Improvement Loop
	•	After ANY correction from the user: update tasks/lessons.md with the pattern
	•	Write rules for yourself that prevent the same mistake
	•	Ruthlessly iterate on these lessons until mistake rate drops
	•	Review lessons at session start for relevant project

### 4. Verification Before Done
	•	Never mark a task complete without proving it works
	•	Diff behavior between main and your changes when relevant
	•	Ask yourself: “would a staff engineer approve this?”
	•	Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
	•	For non-trivial changes: pause and ask “is there a more elegant way?”
	•	If a fix feels hacky: “Knowing everything I know now, implement the elegant solution”
	•	Skip this for simple, obvious fixes — don’t over-engineer
	•	Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
	•	When given a bug report: just fix it. Don’t ask for hand-holding
	•	Point at logs, errors, failing tests — then resolve them
	•	Zero context switching required from the user
	•	Go fix failing CI tests without being told how

### 7. Commit Discipline
	•	**Test before committing** — run `npm run build` (includes TypeScript + ESLint checks) before every commit. If it fails, fix it before committing.
	•	Commit after every completed subtask — never batch unrelated changes
	•	Write clear, concise commit messages that explain the **why**, not just the what
	•	Format: `type: short description` (e.g., `fix: correct FCCR denominator to include lease payments`)
	•	Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
	•	If a commit touches multiple areas, keep the message focused on the primary change
	•	Document what changed and why in the commit body when the diff isn’t self-explanatory

### 8. Rollback Awareness
	•	If a change breaks the build or introduces regressions, revert it immediately — don’t layer fixes on top of broken code
	•	Use `git diff` to review your own changes before committing — catch accidental deletions, debug logs, or unintended side effects

### 9. Context Preservation
	•	Never remove or overwrite existing code without understanding what it does first
	•	Read the file before editing — don’t assume structure based on file name alone
	•	When modifying shared utilities, check all call sites for downstream impact

### 10. Financial Accuracy Standards
	•	All financial calculations must match standard commercial banking methodology
	•	Never silently swallow missing data — log warnings when required inputs are absent and explain how the output is affected
	•	Sign conventions matter: expenses should be positive, gains should be clearly distinguished from operating income
	•	When in doubt, favor conservative (lender-protective) interpretations

### Task Management
	1.	Plan First: Write plan to tasks/todo.md with checkable items
	2.	Verify Plan: Check in before starting implementation
	3.	Track Progress: Mark items complete as you go
	4.	Explain Changes: High-level summary at each step
	5.	Document Results: Add review section to tasks/todo.md
	6.	Capture Lessons: Update tasks/lessons.md after corrections

###  Core Principles
	•	Simplicity First: Make every change as simple as possible. Impact minimal code.
	•	No Laziness: Find root causes. No temporary fixes. Senior developer standards.
	•	Minimal Impact: Changes should only touch what’s necessary. Avoid introducing bugs.

---

## Tasks

<!-- ### Task 2: Increase Extraction Accuracy
Improve the accuracy of AI-extracted financial data across all supported document types.
- [ ] Run extraction against all 11 test files in `public/financialReports/` and log current accuracy baselines
- [] Identify the most common extraction errors (missed line items, misclassified values, scale mismatches) — documented 15 error patterns in `tasks/extraction-error-analysis.md` across 5 categories: null defaults inflating covenant ratios (P0), mixed-scale within documents (P0), missing cross-field validators (P1), lease/facility classification ambiguity (P2), deduplication false positives (P3). Key findings: FCCR can be inflated 2x when debt service fields are null; uniform scale correction can corrupt mixed-scale documents; no balance sheet identity or cash flow reconciliation checks exist; drawn vs undrawn credit facility amounts not distinguished in prompt
- [] Improve prompt engineering in the extraction pipeline to reduce errors — added multi-year column pinning, D&A arithmetic self-verification, expanded IFRS synonyms for `cash_taxes_paid`/`distributions_paid`, and `payment_of_lease_liability` principal-only clarification
- [] Strengthen conflict detection and merge logic for multi-chunk documents — implemented D&A component identity check in `validateArithmeticConsistency`, year-column awareness in reconciliation prompt
- [] Add validation checks that cross-reference extracted totals against reported totals — added 3 new checks to `validateArithmeticConsistency`: (1) interest P&L vs fixed_charges.total_interest_expense cross-reference, (2) income statement identity check (net_income ≈ revenue - expenses - interest - taxes), (3) reported_adjusted_ebitda plausibility vs calculated EBITDA base
- [ ] Re-run all 11 test files and document accuracy improvements vs. baseline -->

<!-- ### Task 3: Audit & Fix Calculation Engine 
Review all calculators in `lib/calculations/` to ensure formulas return the most accurate results.
- [] Audit `ebitda-calculator.ts` — fixed `usedGrossFallback` flag incorrectly staying `false` when P&L interest field was absent (caused interest income double-deduction in Adjusted EBITDA)
- [] Audit `fccr-calculator.ts` — fixed distributions_paid never being deducted from FCCR numerator (was systematically overstating coverage for owner-operated businesses)
- [] Audit `dscr-calculator.ts` — verified debt service inputs; noted `repayment_of_debt` gross revolving inflation is a known limitation
- [] Audit `debt-calculator.ts` — verified senior/funded/total debt classification; noted bank debt fallback edge case
- [] Audit `debt-service-resolver.ts` — verified resolver logic; 1.15x cross-check threshold documented
- [] Audit `ratio-calculator.ts` — fixed three distress conditions (negative equity, negative EBITDA) that returned `null` instead of the actual ratio, hiding critical signals from analysts
- [] Fix any formula errors or edge cases found — also fixed DSCR not being recalculated in `recalculate.ts` when covenant config changes
- [ ] Test calculated outputs by running extraction against all files in `public/financialReports/` multiple times. Compare outputs across runs to identify inconsistencies and non-deterministic results. For each file, reason through the financial statements like a corporate finance analyst at a bank — read the income statement, balance sheet, and cash flow statement yourself, form your own conclusions about what the correct values should be, then compare against what the engine produced. Where outputs differ from what a banker would expect, diagnose why and fix the underlying extraction or calculation logic. -->

<!-- ### Task 5: Regression Testing with Financial Reports
Validate extraction integrity using the real financial reports in `public/financialReports/`.
- [] Create a test harness that runs extraction on each file and captures structured output — `scripts/test-extraction.ts`
- [] Build expected-value baselines for key metrics (EBITDA, total debt, senior debt, revenue) per file — snapshot system persists first-run output; ground truth from `lib/benchmarks/ground-truth.ts` used where verified
- [] Automate comparison of extraction output vs. baselines with pass/fail reporting — ✓/⚠/✗ at 5%/20% variance thresholds; exits with code 1 on any failure
- [] Document known edge cases per file (e.g., unusual line items, non-standard formatting) — `KNOWN_EDGE_CASES` map covers 8 files inline in the script
- [] Integrate regression checks into CI or a runnable script (`npm run test:extraction`) — added to `package.json` -->

### Task 6: Critical — Database & Data Integrity Fixes 
Prevent data corruption and silent failures in the extraction pipeline.
- [x] Wrap extraction insert + project risk-score update in a Supabase RPC transaction (or validate every `.error` response) — validated every `.error` response on extraction insert and project update; non-fatal project update failure is now logged rather than silently swallowed
- [x] Fix year-conflict detection running after insertion — detect conflicts before insert, or clean up orphaned records on cancel — moved conflict detection to run on a phantom extraction object BEFORE the DB insert; extraction is only inserted after conflict status is known
- [x] Audit all Supabase calls in `route.ts` — check `{ data, error }` on every operation, log failures, update document status to `'failed'` — all Supabase operations now check `.error`; `updateDocumentStatus` logs failures; project update failure in `resolve-conflict/route.ts` also now logged
- [x] Add cleanup mechanism for stale `processing` records (background job or cron marking stuck documents as `failed` after 15 min) — `cleanupStaleProcessingRecords()` runs at the start of each extraction, marking any document for that project stuck in `processing` for >15 min as `failed`

### Task 7: Critical — Document Parsing Completeness 
Ensure all accepted file types can actually be processed.
- [x] Implement Excel parsing (`.xlsx`/`.xls` via existing `xlsx` dependency) in `document-parser.ts` — pipe-delimited sheet output with sheet headers, 2000-row cap per sheet
- [x] Implement Word parsing (`.docx`) in `document-parser.ts` — using `mammoth` (added to dependencies); `.doc` throws a clear user-facing error directing them to save as `.docx`
- [x] Add scanned PDF detection — checks text density (chars/page); if < 100 chars/page, prepends warning directing user to `/vision` upload

### Task 9: High — Security Hardening 
Protect against abuse and data leaks.
- [x] Add per-user rate limiting on `/api/extractData` — in-memory sliding-window limiter (5 req/10 min per user, map capped at 10k entries); returns 429 with `Retry-After` header
- [x] Implement structured logging with sensitive data redaction — FCCR/Debt/Capital values in `risk-generator.ts` now gated behind `DEBUG_FINANCIALS` env flag (same pattern as chunk-processor and extraction-merger)
- [x] Replace synchronous file I/O in `risk-generator.ts` cache — disk cache removed entirely; replaced with in-memory Map (100-entry LRU-style, oldest evicted when full)

### Task 13: Critical — Security & Data Integrity
Consensus across senior-engineer and code-approver; some overlap with financial-director on data correctness.
- [x] Fix path traversal vulnerability in temp file creation — `file.name` is user-controlled and used directly in `path.join()` for temp path. Sanitize with `path.basename()` and strip special characters.
- [ ] Replace in-memory rate limiter with persistent solution — module-level `Map` does not survive serverless cold starts or work across instances. Replace with Redis/Upstash before handling real financial data.
- [x] Fix Zod validation fallback passing unvalidated risk data — when `riskDataSchema.safeParse()` fails, raw unvalidated AI output is used as `riskSnapshot` and stored in Supabase. Should return `null` (caller already handles it) instead of passing malformed data through.
- [x] Scope risk cache to userId — module-level `riskCache` uses metrics hash as key without user/document scoping. Two companies with identical metrics would share a cached risk assessment. Include `userId` in cache key.
- [x] Add server-side magic-byte file type validation — MIME type check uses browser-supplied `Content-Type` which is trivially spoofable. Add `file-type` or similar magic-byte detection for uploaded documents.

### Task 14: High — Pipeline Robustness
Senior-engineer and code-approver agree on extraction pipeline ordering and data flow issues.
- [x] Normalize year keys BEFORE merge, not after — now normalizes each extraction's `metrics_by_year` keys before passing to `mergeExtractionsWithConflicts`; post-merge pass kept as safety net
- [x] Fix FCCR receiving stale `m` instead of updated `result` in `computeMetrics` — now passes `result` to both FCCR and DSCR consistently
- [x] Fix `primary_fiscal_year` using first-non-null instead of most-common/latest — now uses most commonly reported value across chunks; ties broken by latest year
- [ ] Add TTM annualization for interim period submissions *(DEFERRED: requires extraction schema changes to detect interim periods, prompt modifications, and annualization logic across flow metrics. Better scoped as a separate feature task.)* — if a borrower submits a Q3 report, revenue/EBITDA are 9-month figures but debt balances are point-in-time. Coverage ratios will be distorted without annualization.
- [x] Fix `JSON.stringify` replacer used incorrectly for risk cache key — replaced with recursive key-sorted replacer function for stable cache keys
- [x] Implement `isOverlapSource` or remove it — removed dead stub from `validation.ts`; actual overlap detection is implemented in `extraction-merger.ts` with proper pattern matching
- [x] Fix `principal || null` converting legitimate zero to null — changed all source value fields from `|| null` to `?? null` to preserve legitimate zeros

### Task 18: Critical — Database Security & RLS Hardening
Database audit (2026-03-18). RLS policies are effectively disabled — all three tables use `USING (true)` / `WITH CHECK (true)`, meaning any authenticated user can read/write any row. The app relies entirely on application-level `.eq('user_id', userId)` filters. Multiple authorization gaps found in API routes.
- [ ] **CRITICAL — Replace permissive RLS policies with proper user-scoped policies** *(BLOCKED: Clerk user IDs are strings like `user_xxx`, not UUIDs — `auth.uid()::text` won't match. Requires verifying Clerk JWT template structure to determine correct RLS approach: likely `auth.jwt() ->> 'sub' = user_id`. Needs DB migration + live testing with Clerk auth session.)* — `projects`, `documents`, and `extractions` tables all have `USING (true)` / `WITH CHECK (true)` policies that allow any authenticated user full access to all rows. Replace with operation-specific policies: `USING (auth.uid()::text = user_id)` and `WITH CHECK (auth.uid()::text = user_id)` on all three tables. This is the single most important security fix — without it, a compromised or malicious JWT gives access to every user's financial data.
- [x] **CRITICAL — Add project ownership check on file upload routes** — `/api/extractData/route.ts` and `/api/extractData/vision/route.ts` accept a client-provided `projectId` without verifying the authenticated user owns that project. An attacker who knows a project UUID can upload documents into another user's project. Add `.eq('id', projectId).eq('user_id', userId)` ownership verification before processing. Same issue exists in `/api/resolve-conflict` POST route. Files: `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`, `app/api/resolve-conflict/route.ts`
- [x] **HIGH — Stop returning raw Supabase error messages to client** — replaced 8 instances of `error.message` in responses with generic user-facing messages; detailed errors logged server-side via `console.error()`; `resolve-conflict` already handled this properly
- [ ] **HIGH — Eliminate admin client usage for storage operations** *(BLOCKED: same Clerk JWT UUID mismatch as RLS task — `auth.uid()` returns a UUID that doesn't match Clerk's `user_xxx` string IDs. Requires verifying Clerk JWT template claims and live auth session testing.)* — `createAdminClient()` bypasses RLS entirely for storage uploads/downloads, justified by a UUID casting issue in RLS policies. Investigate and fix the casting issue so the authenticated client can handle storage directly, then remove `createAdminClient()` from extraction routes. Files: `utils/supabase/server.ts`, `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`
- [ ] **MEDIUM — Add storage bucket RLS policies** *(BLOCKED: depends on resolving Clerk JWT UUID mismatch first — storage RLS policies need to reference the correct user identity claim.)* — the `financial-documents` storage bucket has no explicit RLS policies configured. Storage paths use `{userId}/{projectId}/{docId}/{filename}` convention but access isn't enforced at the bucket level. Add policies that restrict access to the user's own path prefix.
- [x] **LOW — Drop unused `profiles` table** — removed `profiles` type definition from `lib/supabase/types.ts` and the unused `Profile` type export

---

### Task 22: High — Commit Audit Bug Fixes (2026-03-18)
Code-approver audit of ~60 commits since 2pm. 8 confirmed bugs across financial calculations, security, and pipeline logic. These are regressions or gaps introduced by today's commits.
- [x] **CRITICAL — Move vision route magic-byte validation before storage upload** — `vision/route.ts` uploads file to Supabase (line 188) and creates document record (line 209) BEFORE magic-byte validation at line 262. A spoofed file gets stored before content is checked. The non-vision route (`extractData/route.ts`) correctly validates before upload. Move validation to run on `fileBuffer` before the storage upload call; on failure return error without uploading. File: `app/api/extractData/vision/route.ts`
- [x] **HIGH — Fix `getRiskBand` threshold scale mismatch in ProjectDetail** — uses `<= 30, <= 50, <= 70` thresholds but `lib/quantitative-risk.ts` produces scores on 0-100 scale with bands at `0-20, 20-40, 40-60, 60-80, 80-100`. A score of 25 (Moderate Risk) displays as "Low Risk" in the hero card. Align thresholds with `RISK_BANDS` from `quantitative-risk.ts`. File: `components/ProjectDetail.tsx`
- [x] **HIGH — Fix `getBaseScore` boundary for higher-is-better metrics** — `quantitative-risk.ts:168` uses `value > band.min && value <= band.max` (half-open `(min, max]`). For FCCR with `higher_is_better: true`, exactly 1.25 gets score 4 (weak) instead of score 3 (adequate) because `1.25 > 1.25` is false. Pass `higher_is_better` flag and use `>=` on min when true. File: `lib/quantitative-risk.ts`
- [x] **HIGH — Fix `getFccrBarColor` stale 1.2 threshold** — `WeightedRiskGauge.tsx:119` uses `>= 1.2` for green but FCCR adequate threshold was calibrated to 1.25x in the same commit batch. Change to `1.25` or import from `constants.ts`. File: `components/WeightedRiskGauge.tsx`
- [x] **HIGH — Remove duplicate `unionMergeWarnings` append in multi-doc merge** — `extraction-utils.ts:674` pushes `unionMergeWarnings` into `allWarnings` (deduped at line 677). Then lines 733-738 append `unionMergeWarnings` again to `merged.extraction_warnings`, bypassing the Set dedup. Every union merge warning is doubled. Remove lines 733-738. File: `lib/extraction-utils.ts`
- [x] **HIGH — Add `skipped` and `withWarnings` to `MergedExtraction.chunk_stats` type** — `extraction-utils.ts:12` defines `chunk_stats` as `{ total; successful; failed }` but `ExtractionResult` in `aiProcessor.ts` includes `skipped` and `withWarnings`. The skipped count can't surface through the merge path due to the type mismatch. File: `lib/extraction-utils.ts`
- [x] **MEDIUM — Fix `resolve-conflict` DELETE using wrong client for storage deletion** — `resolve-conflict/route.ts:214` uses RLS-scoped `supabase` client for `storage.remove()`. Other delete routes use `createAdminClient()` to bypass UUID casting issues. This storage delete likely fails silently, leaving orphaned files. File: `app/api/resolve-conflict/route.ts`
- [x] **MEDIUM — Fix FCCRBreakdown distributions tooltip contradiction** — `FCCRBreakdown.tsx:300` says "Distributions are excluded" but `fccr-calculator.ts:284-285` deducts `distributionsPaid` from the FCCR numerator. The tooltip misleads analysts about what the formula actually does. File: `components/FCCRBreakdown.tsx`

### Task 23: Medium — Duplicate Document Upload Prevention
Prevent wasted API credits and data clutter from accidental duplicate uploads.
- [x] **Add SHA-256 content hashing before extraction** — compute a hash of the uploaded file buffer in `/api/extractData/route.ts` before calling the AI pipeline. Store the hash in the `documents` table (new `content_hash` column). Before processing, query existing documents in the same project for a matching hash. If found, return an error with the original document's name and upload date so the user knows it's already been processed. This is the optimal approach because: (1) it catches exact duplicates regardless of filename, (2) it's cheap (hashing is ~1ms even for large files), (3) it runs before any AI extraction so zero credits are wasted, and (4) it doesn't block legitimate re-uploads of updated versions of the same file (different content = different hash). Files: `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`, Supabase migration for `documents.content_hash`

---

## Full Application Audit (2026-03-19)

Cross-validated by 4 agents: **Senior Engineer**, **Code Improver**, **Financial Director**, **UI/UX Designer**. Issues marked with agent count (e.g., `[4 agents]`) were independently flagged by multiple auditors — highest confidence. Issues from a single domain expert (e.g., Financial Director on banking methodology) are included when the finding is clearly valid within that domain.

### Task 24: Critical — Financial Calculation Bugs
Bugs that produce incorrect financial outputs or misleading risk scores. Must fix before any live credit use.

- [x] **CRITICAL — Prompt-code contradiction on `loss_on_disposal` silently overstates EBITDA** `[Financial Director]` — Extraction prompt said "calculator does NOT add loss_on_disposal back" but code does. Code behavior is correct per banking standards (non-recurring, non-cash disposal losses are legitimate add-backs). Updated prompt to match code and reinforce that only non-recurring events should populate this field. File: `lib/prompts/extraction-prompt.ts`
- [x] **CRITICAL — Negative Debt/EBITDA scored as "excellent" instead of maximum risk** `[Financial Director, Senior Engineer]` — Added `if (value < 0) return 10` guard to `getDebtEBITDARiskScore`. Also patched `getSeniorDebtEBITDAHealth` which had the same bug (negative values returned "excellent" health with green color). Code-approver confirmed `getFCCRRiskScore` and `getDebtCapitalRiskScore` already handle negatives correctly. File: `lib/risk-scoring.ts`
- [x] **HIGH — Pro forma cap applied against abs(negative EBITDA) credits distressed borrowers** `[Financial Director]` — `ebitda-calculator.ts` caps pro forma adjustments at `abs(ebitda) * 0.15`. When base EBITDA is negative (company is losing money), this still allows up to 15% of the loss amount as pro forma credit. A company losing $10M/year gets $1.5M synergy credit. Cap pro forma at zero when base EBITDA is negative. File: `lib/calculations/ebitda-calculator.ts`
- [x] **HIGH — Debt/Capital ratio returns misleading values for negative equity** `[Senior Engineer, Financial Director]` — When `shareholdersEquity` is large and negative, `totalCapital` becomes negative. The ratio can flip sign or exceed 1.0, but downstream threshold comparisons in `risk-scoring.ts` produce misleading health ratings. Return a `warning` flag when `totalCapital <= 0`. File: `lib/calculations/ratio-calculator.ts`
- [x] **HIGH — `calculateAvgAnnualChange` doesn't account for year gaps** `[Financial Director]` — If years 2021, 2022, 2024 are available but 2023 is missing, the function treats 2022→2024 as a one-year change instead of two years, overstating/understating the average change rate. Align with year keys. File: `lib/quantitative-risk.ts`
- [x] **MEDIUM — Missing metrics default to middle score (3/5) instead of excluding from weighted average** `[Financial Director]` — When a quantitative risk metric has no data, `getBaseScore` returns 3 (adequate). This anchors the assessment with phantom data. Exclude unavailable metrics and redistribute weight. File: `lib/quantitative-risk.ts`
- [x] **MEDIUM — Revolver cap threshold (1.5x) too permissive; cap assignment uses full balance** `[Financial Director]` — `debt-service-resolver.ts` allows repayments up to 50% over funded debt before capping. More conservative: use `Math.min(principal, fundedDebt)` with 1.1x tolerance. File: `lib/calculations/debt-service-resolver.ts`
- [x] **MEDIUM — No analyst warning when unfunded CapEx floor fires** `[Financial Director]` — When `unfundedCapex < 0` (debt proceeds > CapEx), the floor at zero fires silently. Analyst doesn't know that new borrowing is masking future debt service. Surface a warning. File: `lib/calculations/fccr-calculator.ts`

### Task 24b: Proceeds from LT Debt Prompt — Edge Cases (2026-03-19)
Financial Director review of the revolving exclusion and net issuance prompt changes. These edge cases stem from the updated `proceeds_from_long_term_debt` extraction instructions.

- [x] **CRITICAL — Net figure + separate repayment line from different instrument treated as gross** `[Financial Director]` — IFRS filers may show "Net issuances of long-term debt: 4,200" alongside "Repayment of debentures: (1,800)" for a different instrument. The proximity heuristic ("repayment line exists nearby → gross") causes the AI to treat the net 4,200 as gross proceeds, overstating `proceedsFromLTDebt` and inflating FCCR. Fix: replace proximity heuristic with instrument-level matching — only interpret as gross when the repayment line references the same instrument class. File: `lib/prompts/extraction-prompt.ts`
- [x] **HIGH — Net negative = null creates silent year-over-year FCCR volatility** `[Financial Director]` — Extracting negative net issuances as null (→ defaults to 0 in calculator) causes full CapEx to be treated as unfunded in paydown years with no analyst warning. A company refinancing at lower balance shows dramatically different unfunded CapEx vs. prior year for invisible reasons. Fix: extract negative net as-is instead of null; add analyst warning in `fccr_breakdown.warnings` when proceeds are negative. Files: `lib/prompts/extraction-prompt.ts`, `lib/calculations/fccr-calculator.ts`
- [x] **HIGH — "New borrowings" blanket exclusion causes systematic under-extraction for Canadian ASPE private companies** `[Financial Director]` — Canadian private companies frequently label their sole long-term facility as "Proceeds from new borrowings" or "New bank borrowing." The blanket exclusion zeros out CapEx offset for these borrowers. Fix: add contextual instruction — if "New borrowings" appears alongside a balance sheet long-term debt balance, include it. File: `lib/prompts/extraction-prompt.ts`
- [x] **MEDIUM — Net issuance extraction creates inconsistency with `repayment_of_debt` fallback chain** `[Financial Director]` — When a document uses net presentation, `repayment_of_debt` may be null (no separate line) while `proceeds_from_long_term_debt` reflects a net figure. FCCR numerator and denominator are sourced from structurally different data points. Fix: add note to `repayment_of_debt` instructions — when net issuance presentation is used, explicitly set `repayment_of_debt = null` and flag that repayments are embedded in the net figure. Files: `lib/prompts/extraction-prompt.ts`, `lib/calculations/debt-service-resolver.ts`
- [x] **MEDIUM — REITs, fleet companies, and equipment lessors use unrecognized but legitimate label variants** `[Financial Director]` — "Proceeds from mortgage financing", "Proceeds from equipment financing", "Proceeds from vehicle loans", "Advance from related party" are all legitimate LT debt but fail the label test. Fix: add cross-reference instruction — when a financing line doesn't match accepted labels, check balance sheet for a new/increased long-term liability that ties to the cash inflow. File: `lib/prompts/extraction-prompt.ts`

### Task 25: Critical — Portfolio Display & Formatting
Display bugs that misrepresent financial data to analysts.

- [x] **~~CRITICAL~~ FALSE POSITIVE — `fmtCurrency` scale bug on instruments page** `[4 agents]` — Verified correct: thresholds work correctly for thousands-denominated data. `>= 1_000_000` thousands = $1B (not $1T as reported); `>= 1_000` thousands = $1M (not $1B). Confirmed with ground truth: Zedcor revenue 24,889K → `$24.9M` ✓, ADEN revenue 1,634,382K → `$1.6B` ✓. The 4 auditors' arithmetic was incorrect.
- [x] **HIGH — 6 duplicate `formatCurrency` implementations with inconsistent behavior** `[Code Improver, Senior Engineer]` — `utils/format.ts`, `utils/formatters.ts`, `AdjustedEBITDA.tsx`, `DebtHealthMeters.tsx`, `FCCRBreakdown.tsx`, and `instruments/page.tsx` all have separate formatters producing different output for the same value (`$1,500.00` vs `$1,500K` vs `$1.5M`). Consolidate to single canonical function in `utils/format.ts` with K/M/B scaling. Delete `utils/formatters.ts` and all local copies.
- [x] **HIGH — Senior Debt/EBITDA labeled "EBITDA" but uses Adjusted EBITDA** `[Financial Director]` — Column header says "Sr Debt / EBITDA" with no qualifier. Code uses `adjusted_ebitda` as denominator. For companies with large adjustments, displayed ratio can differ 40%+ from base EBITDA leverage. Label as "Sr Debt / Adj. EBITDA" everywhere. Files: `app/instruments/page.tsx`, `components/FinancialTable.tsx`
- [x] **HIGH — DSCR/FCCR definitional difference (preferred dividends) undisclosed** `[Financial Director]` — DSCR excludes preferred dividends while FCCR includes them. Both displayed side-by-side with no notation. Analyst can't reconcile the divergence. Add definitional footnote or standardize. Files: `lib/calculations/dscr-calculator.ts`, `lib/calculations/fccr-calculator.ts`

### Task 26: Critical — Risk Scoring Consolidation
Three independent risk systems produce contradictory recommendations for the same borrower.

- [x] **CRITICAL — Triple risk scoring with contradictory results** `[Financial Director, UI/UX Designer]` — Three separate systems: (1) AI-generated 5-pillar 1–10 scale, (2) deterministic weighted 0–10 debt health score, (3) quantitative 5-metric 0–100 normalized score. Different methodologies, band vocabularies, and weights. An analyst can see "Moderate-Low" / "Elevated Risk" / "High Risk" simultaneously. Designate ONE authoritative score for lending decisions. Label each system's methodology. AI risk narrative should be advisory only, not scored.
- [x] **CRITICAL — FCCR covenant threshold labeled 1.0x; commercial standard is 1.25x** `[Financial Director]` — Portfolio view labels FCCR < 1.0x as "below covenant." Banking practice treats 1.0x as technical default (zero cushion). OCC/FDIC consider 1.25x the minimum for non-criticized loans. Replace 1.0x with 1.25x as the covenant threshold. The amber zone should cover 1.25x–1.5x. Files: `app/instruments/page.tsx`, `lib/constants.ts`
- [x] **HIGH — `getRiskBand` still defined in two places with different return types** `[Code Improver, Senior Engineer]` — `lib/risk-scoring.ts` returns a string on 0–10 scale. `components/ProjectDetail.tsx` returns `{ label, color }` on 0–100 scale. Task 22 aligned thresholds but the functions remain duplicated. Unify into shared import. Files: `lib/risk-scoring.ts`, `components/ProjectDetail.tsx`

### Task 27: High — Security Hardening II
New security findings not covered by Tasks 13/18.

- [x] **HIGH — No HTTP security headers (CSP, X-Frame-Options, HSTS)** `[Senior Engineer]` — `next.config.ts` has no `headers()`. No XSS mitigation, clickjacking protection, or transport security. Table stakes for a financial app. Add CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS. File: `next.config.ts`
- [x] **HIGH — `/instruments` not in Clerk middleware protected routes** `[Senior Engineer]` — `middleware.ts` protects `/dashboard(.*)` but not `/instruments`. Page-level `auth()` redirect exists but Clerk JWKS verification and session refresh don't run. Add `/instruments(.*)` to `isProtectedRoute`. File: `middleware.ts`
- [x] **HIGH — SSE stream not cancelled on client disconnect** `[Senior Engineer]` — When user cancels upload mid-processing, server-side AI extraction continues, consuming Anthropic API credits. Pass `req.signal` into the processing pipeline and check `signal.aborted` before each AI call. Files: `app/api/extractData/route.ts`, `lib/chunk-processor.ts`
- [x] **HIGH — Supabase admin client created without env var validation** `[Senior Engineer]` — `createAdminClient()` uses `process.env.SUPABASE_SERVICE_ROLE_KEY!` (non-null assertion). Missing key → cryptic runtime errors. Add explicit guard. File: `utils/supabase/server.ts`
- [x] **MEDIUM — No `server-only` guard on admin Supabase client** `[Senior Engineer]` — If `createAdminClient` is accidentally imported in a Client Component, the service-role key gets bundled to browser. Add `import 'server-only'`. File: `utils/supabase/server.ts`
- [x] **MEDIUM — Vision route inserts extraction before conflict detection** `[Senior Engineer]` — Vision route writes to DB before checking conflicts (opposite of main route). Creates records that may need cleanup. Mirror pre-insertion pattern from main route. File: `app/api/extractData/vision/route.ts`
- [x] **MEDIUM — Storage not cleaned up on extraction insert failure** `[Senior Engineer]` — If extraction DB insert fails after file is uploaded to storage, the storage object is orphaned. Call `storage.remove()` on extraction insert failure. Files: `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`

### Task 28: High — Testing Infrastructure
Zero automated tests on a system that makes lending recommendations.

- [x] **CRITICAL — Add automated test framework** `[Senior Engineer]` — No test framework configured. Zero unit/integration/e2e tests. EBITDA dedup rules, FCCR resolution, merger conflict logic, and risk scoring all untested. Add `vitest`. Start with pure-function unit tests for `lib/calculations/` — highest-value coverage. Use test PDFs in `public/financialReports/` and ground truth in `lib/benchmarks/ground-truth.ts` as regression fixtures.
- [x] **HIGH — Wire ground truth benchmarks into CI** `[Senior Engineer]` — `scripts/regression-check.ts` and `lib/benchmarks/ground-truth.ts` exist but never run automatically. Add `npm run test:regression` and GitHub Actions workflow. Failing regression should block merge.
- [x] **HIGH — Add `zod` as explicit dependency** `[Senior Engineer]` — `zod` is imported in `lib/validation.ts`, `api/projects/route.ts`, `api/resolve-conflict/route.ts` but not in `package.json`. Resolved transitively through another package. If that dep updates, validation breaks. Run `npm install zod`. File: `package.json`

### Task 29: High — UI/UX & Design System
Issues impacting analyst trust and usability.

- [x] **HIGH — Token cost and AI model details shown to end users** `[UI/UX Designer]` — Project detail page unconditionally renders input/output token counts, model name, and estimated API cost. Reads as dev scaffolding in a financial tool. Gate behind env var or admin role. File: `components/ProjectDetail.tsx`
- [x] **HIGH — Compare/Vision debug tools exposed in primary nav** `[UI/UX Designer]` — Sidebar shows "Compare" (renders as "Extraction Debugger" with Bug icon) and "Vision" as first-class nav items. Gate behind `?debug=true` or admin role. File: `components/AppSidebar.tsx`
- [x] **HIGH — Color system fork: hardcoded values bypass design tokens** `[UI/UX Designer]` — Landing page uses raw OKLCH values instead of CSS custom properties. `MetricCard` uses `bg-white`, `border-gray-200` instead of `bg-card`, `border-border`. Changes to `globals.css` tokens have no effect on these surfaces. Files: `app/page.tsx`, `components/ProjectDetail.tsx`
- [x] **HIGH — Lending decision text truncated by `truncate` class** `[UI/UX Designer]` — Decision banner uses `truncate` which can cut off critical words like "Conditional" at smaller viewports. Replace with `break-words` or `line-clamp-2` with tooltip. File: `components/ProjectDetail.tsx`
- [x] **HIGH — Section nav doesn't reflect actual content structure** `[UI/UX Designer]` — Nav has 4 items (Upload/Analysis/Risk/Decision) but "Risk" contains 5 distinct cards. No way to jump to Covenant Parameters or Debt Health directly. Expand nav or add sub-navigation. File: `components/ProjectDetail.tsx`
- [x] **MEDIUM — Two competing dashboard layouts with inconsistent headers** `[UI/UX Designer]` — `app/dashboard/layout.tsx` has sidebar toggle; `app/(dashboard)/layout.tsx` does not. Routes under `(dashboard)` can't toggle sidebar. Consolidate to single layout. Files: `app/dashboard/layout.tsx`, `app/(dashboard)/layout.tsx`
- [x] **MEDIUM — FCCRBreakdown uses raw color classes, not semantic tokens** `[UI/UX Designer]` — `text-emerald-600`, `text-lime-600` instead of `text-success`, `text-warning`. `text-lime-600` has no dark mode variant. File: `components/FCCRBreakdown.tsx`
- [x] **MEDIUM — FCCR bar chart missing axis labels and threshold reference line** `[UI/UX Designer]` — Custom CSS bar chart has no y-axis scale or covenant threshold line. Replace with Recharts `BarChart` using existing `ChartContainer` pattern, add reference lines at 1.0x and 1.25x. File: `app/instruments/page.tsx`
- [x] **MEDIUM — Empty decision state is too sparse** `[UI/UX Designer]` — When no data exists, Decision card shows one line of text. Add skeleton placeholder showing what populated state looks like, with a direct action button to Upload section. File: `components/ProjectDetail.tsx`
- [x] **LOW — Sign-in page has no brand identity** `[UI/UX Designer]` — Renders only Clerk's default `<SignIn />` on a plain background. Add Lendflow logo, product name, one-line descriptor. File: `app/sign-in/[[...sign-in]]/page.tsx`
- [x] **LOW — Missing `focus-visible` ring on custom buttons** `[UI/UX Designer]` — Several custom `<button>` elements outside Shadcn `Button` have no visible focus indicator. Fails WCAG 2.4.7. Files: `components/ProjectDetail.tsx`, `app/dashboard/layout.tsx`
- [x] **LOW — Covenant Parameters panel positioned in Risk section, not Analysis** `[UI/UX Designer]` — Covenant params directly affect Financial Summary ratios but are placed below them. Analyst must scroll up to see the effect of changes. Move to top of Analysis section. File: `components/ProjectDetail.tsx`

### Task 30: Medium — Code Quality & Performance
Tech debt that affects maintainability and page performance.

- [x] **HIGH — N+1 query on instruments page** `[Code Improver, Senior Engineer]` — Fires one Supabase query per project inside `Promise.all`. 20 projects = 21 round-trips. Replace with single query using `IN` clause and client-side grouping. Then wrap in `unstable_cache` with short TTL. File: `app/instruments/page.tsx`
- [x] **MEDIUM — `process.noDeprecation = true` silences all deprecation warnings** `[Code Improver, Senior Engineer]` — Module-level statement in `document-parser.ts` permanently disables all Node.js deprecation warnings. Replace with scoped workaround or upgrade `pdf-parse`. File: `lib/document-parser.ts`
- [x] **MEDIUM — Large monolithic components (1000+ lines)** `[Code Improver, Senior Engineer]` — `FinancialTable.tsx` (1704 lines), `ProjectDetail.tsx` (1247 lines), `extraction-merger.ts` (1588 lines), `aiProcessor.ts` (1128 lines). Split `ProjectDetail` into sub-components. Extract skeleton components.
- [x] **MEDIUM — Sequential 3-second inter-chunk delay adds guaranteed latency** `[Code Improver]` — `chunk-processor.ts` waits 3s between every chunk regardless of rate limit status. A 5-chunk doc adds 12s of pure idle time. Remove fixed delay; rely on existing retry logic for actual 429s. File: `lib/chunk-processor.ts`
- [x] **MEDIUM — ErrorBoundary exists but rarely applied** `[Senior Engineer]` — Top-level pages have no error boundary. A single failing metric calculation crashes the entire view. Wrap Financial Table, EBITDA, and Risk sections with `ErrorBoundary`. File: `components/ProjectDetail.tsx`
- [x] **MEDIUM — PDF compression blocks main thread** `[Senior Engineer]` — `compressPDF()` using `pdf-lib` runs synchronously in browser. For 30MB PDFs, freezes the UI for seconds. Move to Web Worker or skip client-side compression. File: `components/FileUpload.tsx`
- [x] **MEDIUM — Synchronous file I/O in async API route** `[Senior Engineer]` — `fs.writeFileSync` and `fs.unlinkSync` block the Node.js event loop. Replace with `fs.promises.writeFile()` and `fs.promises.unlink()`. File: `app/api/extractData/route.ts`
- [x] **MEDIUM — `as unknown as` type assertions mask structural type mismatches** `[Code Improver]` — Unified duplicate ExtractionResult types into single canonical definition in aiProcessor.ts (re-exported from supabase/types.ts). Made unionMergeMetrics generic to eliminate 6 call-site casts. Phantom extraction now directly typed as ExtractionWithDocument. Files: `app/api/extractData/route.ts`, `lib/extraction-utils.ts`, `lib/supabase/types.ts`
- [x] **MEDIUM — `detectYearConflicts` has excessive cyclomatic complexity (181 lines, 4 levels deep)** `[Code Improver]` — Primary-year tiebreaker logic copy-pasted 4 times. Extract into named helper. File: `lib/extraction-utils.ts`
- [x] **LOW — Debug flags duplicated across 4 modules** `[Code Improver, Senior Engineer]` — `DEBUG_FINANCIALS` and `DEBUG_FINANCE` declared independently in `aiProcessor.ts`, `chunk-processor.ts`, `extraction-merger.ts`, `risk-generator.ts`. Centralize to `lib/debug-flags.ts`. Add to `.env.example`.
- [x] **LOW — Dead code: deprecated `chunkText` and `processChunksInBatches`** `[Code Improver, Senior Engineer]` — 70+ lines of dead exports marked `@deprecated`, not called anywhere. Delete them. File: `lib/chunk-processor.ts`
- [x] **LOW — Full `framer-motion` (87KB gzipped) imported for basic fade animations** `[Senior Engineer]` — Replaced all framer-motion usages across 5 components (ProjectDetail, WeightedRiskGauge, AdjustedEBITDA, DebtHealthMeters, FinancialAnalysisDashboard) with tw-animate-css classes and CSS transitions. Removed dependency entirely.

### Task 31: Medium — Financial Methodology Enhancements
Improvements to align with commercial banking standards. Not bugs, but gaps.

- [x] **MEDIUM — No stress testing or sensitivity analysis** `[Financial Director]` — System produces point-in-time ratios with no downside scenarios. Standard credit underwriting requires base/moderate/severe stress. Add a deterministic sensitivity panel showing FCCR and Sr Debt/EBITDA at base, -10%, and -20% EBITDA.
- [x] **MEDIUM — ICR includes lease interest but FCCR handles leases separately** `[Financial Director]` — ICR uses raw P&L interest (including IFRS 16 lease interest). FCCR isolates lease components. AI prompt receives both as separate data points and may produce contradictory narrative. Standardize or label clearly. File: `lib/risk-generator.ts`
- [x] **MEDIUM — `bad_debt_provision` extracted but never processed or monitored** `[Financial Director]` — AI extracts the field but no calculator references it. No warning when provision as % of revenue spikes year-over-year (early credit deterioration signal). Add materiality check. Files: `lib/calculations/ebitda-calculator.ts`, `lib/prompts/extraction-prompt.ts`
- [x] **LOW — `EBITDA.tsx` displays base EBITDA, not Adjusted EBITDA used in ratios** `[Financial Director]` — *(Resolved: EBITDA.tsx is unused dead code — ProjectDetail.tsx imports AdjustedEBITDA.tsx instead, which correctly shows the adjusted figure with component breakdown.)*
- [x] **LOW — Quick ratio not computed; current ratio misleading for inventory-heavy businesses** `[Financial Director]` — Added `inventory` to extraction schema, types, and Zod validation. `calculateQuickRatio()` in ratio-calculator.ts. Wired into both text and vision pipelines. Analyst warning surfaces when inventory >30% of current assets and quick ratio <70% of current ratio. 6 unit tests added.
- [x] **LOW — RiskAssessment.tsx pillar score normalization heuristic is unvalidated** `[Financial Director]` — *(Resolved: component no longer displays numeric pillar scores — purely qualitative observations + impact. No normalization heuristic exists in current code.)*


### Task 32: Long-Term — Regulatory & Compliance Infrastructure
Architectural gaps for regulated lending use. Required before supporting actual credit decisions at a regulated institution.

- [x] **CRITICAL — No regulatory audit trail** `[Financial Director]` — No immutable record of which analysis, model version, input document hash, and computed metrics were used for each lending decision. Required for regulatory exams and litigation.
- [x] **CRITICAL — No fair lending controls** `[Financial Director]` — ECOA/Reg B compliance: no monitoring for disparate impact from AI-generated recommendations. No disparity analysis mechanism.
- [ ] **CRITICAL — No data retention policy** `[Financial Director]` — Financial records require 5–7 year retention per OCC/FDIC. No formal retention schedule for documents or extractions.
- [ ] **CRITICAL — Lending recommendations lack required adverse action notices** `[Financial Director]` — System outputs "Decline" with no mechanism to generate required regulatory notices.
- [ ] **CRITICAL — No model risk management framework** `[Financial Director]` — OCC Bulletin 2011-12 / Fed SR 11-7 require model validation, backtesting, and ongoing monitoring for AI credit models.

*Note: Until Task 32 items are addressed, Lendflow should be positioned as an analytical decision-support tool, not a decision-making system.*

### Task 33: Critical — Enforce Internal Calculation Principle
All derived metrics must be computed by the TypeScript calculation engine (`lib/calculations/`), not by the AI. The AI prompt must only instruct Claude to extract raw document values. Any field that requires arithmetic (summing, subtracting, dividing) belongs in app code. See **Internal Calculation Principle** section above.

- [x] **CRITICAL — Remove `profit_margins` AI computation; calculate in-app** — Extraction prompt (`lib/prompts/extraction-prompt.ts` line 436) explicitly instructs Claude: "Calculate as net_income / revenue." This is computation, not extraction. The AI-computed ratio becomes stale after scale normalization and arithmetic corrections are applied to `net_income` or `revenue`. Fix: (1) Set `"profit_margins": null` in the extraction schema (same pattern as `ebitda: null`), (2) Add `calculateProfitMargin(net_income, revenue)` to `lib/calculations/ratio-calculator.ts`, (3) Call it in `computeMetrics()` in `utils/aiProcessor.ts` after all pipeline corrections. Files: `lib/prompts/extraction-prompt.ts`, `lib/calculations/ratio-calculator.ts`, `utils/aiProcessor.ts`, `types/financial.ts`
- [x] **CRITICAL — Remove `total_debt` AI aggregation; compute from `debt_components` only** — Prompt (line 497) instructs Claude to sum: "total_debt = bank_debt + lease_liabilities + notes_payable + subordinated_debt + all other interest-bearing obligations." This is arithmetic the app should perform. `calculateDebtMetrics()` in `debt-calculator.ts` already computes total debt from `debt_components`, but falls back to the AI-aggregated `metrics.total_debt` when the computed value is zero (line 117). Fix: (1) Remove the aggregation formula from the prompt — instruct Claude to extract `total_debt` ONLY if the document explicitly states a labelled total, (2) Enforce `"total_debt": null` in the schema (same as `ebitda`), (3) Remove the `metrics.total_debt` fallback in `calculateDebtMetrics()` — if `debt_components` are all null, total debt is null (not silently populated from an AI sum). Files: `lib/prompts/extraction-prompt.ts`, `lib/calculations/debt-calculator.ts`
- [x] **CRITICAL — Remove `senior_debt` AI aggregation; compute from `debt_components` only** — Prompt (line 493) instructs Claude: "senior_debt = funded bank debt ONLY: bank_debt_current + bank_debt_long_term." Same issue as total_debt — the AI performs addition that the app should handle. `calculateDebtMetrics()` already computes senior debt from components but falls back to `metrics.senior_debt` when the computed value is zero (line 113). Fix: (1) Remove the sum instruction from the prompt, (2) Enforce `"senior_debt": null` in the schema, (3) Remove the `metrics.senior_debt` fallback in `calculateDebtMetrics()`. Files: `lib/prompts/extraction-prompt.ts`, `lib/calculations/debt-calculator.ts`
- [x] **HIGH — Remove `senior_debt_interest` AI subtraction from prompt** — Prompt (line 544) instructs Claude: "If only total interest shown AND you found subordinated debt interest separately, calculate: total_interest - subordinated_debt_interest." This asks Claude to perform arithmetic. The FCCR debt service resolver (`debt-service-resolver.ts`) already handles missing `senior_debt_interest` gracefully through its fallback chain. Fix: Remove the subtraction instruction — if `senior_debt_interest` cannot be found as a labelled line item in the document, it should be null. File: `lib/prompts/extraction-prompt.ts`
- [x] **HIGH — Remove D&A self-verification loop from AI prompt; rely on in-app completeness gate** — Prompt (lines 601-611) runs a full D&A self-verification inside Claude: "depreciation_amortization MUST equal the SUM of ALL depreciation and amortization lines... If it doesn't, recalculate." The in-app `calculateEBITDA()` in `ebitda-calculator.ts` (lines 140-201) already implements the identical completeness gate in deterministic TypeScript. Fix: Simplify prompt to instruct Claude to extract both the CF aggregate (`depreciation_amortization`) and the sub-components (`depreciation_equipment`, `depreciation_rou`, `depreciation_other`, `amortization_intangibles`) independently. Remove the "if mismatch, use X" decision logic — that resolution belongs in the TypeScript pipeline. File: `lib/prompts/extraction-prompt.ts`

### Task 34: High — Frontend Audit: Design System Consistency & Polish (2026-03-20)
Frontend audit found adoption gaps where components bypass the design token system with hardcoded hex colors, duplicate formatters, and inconsistent labels. The design system itself is solid — the issue is enforcement.

- [x] **HIGH — Consolidate `formatCurrency` to single canonical function (always thousands)** — 6 duplicate `formatCurrency`/`fmtCurrency` implementations with inconsistent behavior. Consolidated to canonical function in `utils/format.ts` that always displays in thousands with comma-separated K suffix (e.g., `$24,889K`). Auto-scaling to M/B was intentionally removed — analysts need consistent thousands-level precision for comparing figures. See `tasks/lessons.md` for rationale. Files: `utils/format.ts`, `components/DebtHealthMeters.tsx`, `app/instruments/page.tsx`, `components/ComparisonTable.tsx`
- [x] **HIGH — Centralize 43 hardcoded risk gauge hex colors into shared constant** — SVG gauge and Recharts components use hardcoded hex values (`#22c55e`, `#84cc16`, `#eab308`, `#f97316`, `#ef4444`) scattered across 4 components instead of referencing a shared constant. These are the 500-shade equivalents used for SVG fills on dark backgrounds — distinct from the 600-shade `HEALTH_COLORS` used for text/borders. Fix: (1) Add `RISK_GAUGE_COLORS` constant to `lib/constants.ts` alongside existing `HEALTH_COLORS`, (2) Replace all hardcoded hex in `QuantitativeRiskCard.tsx` (5 SVG gradient stops), `WeightedRiskGauge.tsx` (~20 hex values across risk config, bar color functions, and SVG zone bands), `DebtHealthMeters.tsx` (15 hex returns in 3 health functions), `FinancialAnalysisDashboard.tsx` (3 SVG arc gradient stops). Files: `lib/constants.ts`, `components/QuantitativeRiskCard.tsx`, `components/WeightedRiskGauge.tsx`, `components/DebtHealthMeters.tsx`, `components/FinancialAnalysisDashboard.tsx`
- [x] **HIGH — Fix "Sr Debt / EBITDA" labels that omit "Adj."** — The ratio uses Adjusted EBITDA as the denominator, but 6 UI instances label it as plain "EBITDA" without the "Adj." qualifier. For companies with large adjustments, the displayed ratio can differ 40%+ from base EBITDA leverage — an analyst seeing "EBITDA" would expect the unadjusted figure. Fix: Standardize all labels to "Sr. Debt / Adj. EBITDA". Instances: `ComparisonTable.tsx:24`, `ProjectDetail.tsx:761`, `FinancialAnalysisDashboard.tsx:180,342`, `SensitivityPanel.tsx:71`, `app/page.tsx:31`. Already correct (no change): `FinancialTable.tsx`, `WeightedRiskGauge.tsx`, `CovenantParametersPanel.tsx`, `instruments/page.tsx`, `DebtHealthMeters.tsx` accordion headers.
- [x] **MEDIUM — Replace inline OKLCH values and raw Tailwind palette classes with semantic tokens** — `FileUpload.tsx` uses raw OKLCH values (`bg-[oklch(0.68_0.19_155/0.20)]`, `text-[oklch(0.68_0.19_155)]`) that are the `emerald-brand-glow` and `emerald-brand` tokens. `FCCRBreakdown.tsx` interpretation guide uses `bg-emerald-500`, `bg-lime-500`, `bg-amber-500`, `bg-red-500` instead of `bg-success`/`bg-warning`/`bg-error`, and focus rings use `focus:ring-emerald-500` instead of `focus-visible:ring-ring`. Files: `components/FileUpload.tsx`, `components/FCCRBreakdown.tsx`
- [x] **MEDIUM — Add SVG aria labels and focus-visible rings for accessibility** — SVG gauges in `QuantitativeRiskCard.tsx`, `WeightedRiskGauge.tsx`, and `DebtHealthMeters.tsx` lack `role="img"` and `aria-label` attributes. Custom buttons in `FCCRBreakdown.tsx` (CapEx treatment toggles, "Add" button) and `DebtHealthMeters.tsx` custom inputs use `focus:outline-none focus:ring-1` instead of the Shadcn standard `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`. `FileUpload.tsx` drop zone has no `aria-describedby` for keyboard users. Files: `components/QuantitativeRiskCard.tsx`, `components/WeightedRiskGauge.tsx`, `components/DebtHealthMeters.tsx`, `components/FCCRBreakdown.tsx`, `components/FileUpload.tsx`

### Task 35: High — Code Review Fixes: Type Safety, Rate Limiting, Ground Truth Auditability (2026-03-20)
Code review (2026-03-20) identified 4 important issues across type safety, infrastructure, and financial data integrity. These span the vision extraction pipeline, rate limiting, deep clone patterns, and ground truth documentation.

- [x] **HIGH — Update stale ground truth derivation comments** — After multiple rounds of calculator corrections (revolver cap, interest cross-check, D&A completeness gate, lease priority swap), the inline arithmetic comments in `lib/benchmarks/ground-truth.ts` no longer match the expected values. For example, Taiga-FY2024 comment says `fccr = 60,778 / 7,497 = 8.10` but the expected value is `8.11`; Zedcor-FY2023 comment says `FCCR = 2,752 / 6,118 = 0.45` but the value is `0.47`; PetValu-FY2024 adjusted_ebitda derivation produces `225,618` but the value is `223,782`. When comments and values disagree, it is impossible to audit the ground truth — a reviewer cannot tell whether the value or the comment is correct. Fix: Re-derive all inline arithmetic comments for the 8 companies that had expected values updated (Zedcor FY2023/FY2024, Taiga FY2023/FY2024, KITS FY2024, PetValu FY2024, ADEN FY2024, PBHC FY2024, Parkland FY2024). Each comment should show the actual formula with the actual numbers producing the actual expected value. File: `lib/benchmarks/ground-truth.ts`
- [x] **HIGH — Replace in-memory rate limiter with Upstash Redis** — The rate limiter in `lib/rate-limiter.ts` uses a module-level `Map` that does not survive serverless cold starts and provides no cross-instance enforcement. `@upstash/ratelimit` and `@upstash/redis` are already in `package.json` (installed but unused). On Vercel or any multi-instance deployment, a user can bypass the rate limiter by hitting different instances — for a financial API consuming Anthropic credits, this is a real cost and abuse risk. Fix: Replace the in-memory `Map` implementation with `@upstash/ratelimit` sliding window. Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` env vars. Keep the tier-based structure (free/pro/enterprise) and per-endpoint configuration. File: `lib/rate-limiter.ts`
- [x] **MEDIUM — Eliminate 6 remaining `as unknown as` casts in vision pipeline** — The text extraction pipeline was cleaned up (Task 30), but the vision pipeline still has 6 `as unknown as` casts that mask type mismatches between the vision extraction response format and the canonical `ExtractedMetrics` type. These bypass TypeScript's type checker and can hide real bugs if the response shape changes. Instances: `vision-extractor.ts:243,244,287,398` (4 casts converting between `Record<string, Record<string, number | null>>` and `ExtractedMetrics`), `claude-client.ts:158` (1 cast on metrics destructuring), `app/api/extractData/vision/route.ts:380` (1 cast constructing phantom `ExtractionWithDocument`). Fix: Define proper intermediate types for the vision response format and use type-safe transformation functions, mirroring the approach used in the text extraction pipeline. Files: `lib/vision/vision-extractor.ts`, `lib/vision/claude-client.ts`, `app/api/extractData/vision/route.ts`
- [x] **LOW — Replace JSON.parse(JSON.stringify(...)) with structuredClone()** — `lib/calculations/recalculate.ts:74` uses `JSON.parse(JSON.stringify(metricsMap))` for deep cloning. This drops `undefined` values, `Date` objects, and function references. For the current `ComputedMetrics` structure (all numbers/strings/nulls) this works, but it is fragile if the type gains non-JSON-safe fields. `structuredClone()` is available in all supported browsers and Node 17+ and handles these edge cases correctly. Fix: Replace `JSON.parse(JSON.stringify(metricsMap))` with `structuredClone(metricsMap)`. File: `lib/calculations/recalculate.ts`

### Task 36: High — FCCR Calculation & Display Accuracy Fixes (2026-03-20)
Discovered via Taiga FY2024 extraction review. Lease priority bug in denominator and formula display gaps hiding deduction terms.

- [x] **HIGH — Lease priority: balance sheet position used instead of actual cash payment in FCCR denominator** — `debt-service-resolver.ts` lease resolution chain prioritized `lease_liabilities_current` (balance sheet — what's DUE next 12 months) over `payment_of_lease_liability` (cash flow — what was actually PAID). For Taiga FY2024, this pulled 6,015 (BS current) instead of 6,425 (actual payment). FCCR measures coverage of actual fixed charge outflows, not future obligations. Fix: Swapped priority 2 and 3 in the lease chain. New order: `finance_lease_payments` > `payment_of_lease_liability` > `lease_liabilities_current`. Updated stale comment in `fccr-calculator.ts`. Added tests for new priority and zero-value fallthrough. Files: `lib/calculations/debt-service-resolver.ts`, `lib/calculations/fccr-calculator.ts`, `lib/calculations/__tests__/debt-service-resolver.test.ts`
- [x] **HIGH — FCCR numerator formula hides distributions_paid deduction** — `FCCRBreakdown.tsx` formula displayed `Numerator = Adj EBITDA - CapEx - Cash Taxes = X` but omitted `distributions_paid` when non-zero. For Taiga FY2023 (25,002 dividend), the shown math didn't add up: `92,682 - 4,746 - 13,119 ≠ 49,815`. Same inconsistency in `DebtHealthMeters.tsx` which always showed the term (including `- 0`). Fix: Both components now conditionally render `distributions_paid` only when > 0. Files: `components/FCCRBreakdown.tsx`, `components/DebtHealthMeters.tsx`
- [ ] **MEDIUM — FCCR denominator formula hides operating_lease_payments and preferred_dividends** — The denominator formula in both `FCCRBreakdown.tsx` (line 500) and `DebtHealthMeters.tsx` (lines 941-948) shows `Principal + Interest + Leases = Denominator` but does not render `operating_lease_payments` or `preferred_dividends` when those terms are non-zero. Same class of bug as the distributions fix — displayed math won't add up when these terms contribute to the denominator. Currently latent because these fields are rarely non-zero, but will mislead analysts when they are. Fix: Add conditional rendering for both terms in both components. Files: `components/FCCRBreakdown.tsx`, `components/DebtHealthMeters.tsx`
