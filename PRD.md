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

**From the AI** (raw `ExtractedMetrics`):
- **Income Statement**: revenue, net income, expenses, profit margins, interest (with income), taxes, depreciation/amortization (with granular breakdown: equipment, ROU, intangibles)
- **Balance Sheet**: shareholders' equity, total debt, senior debt, current assets/liabilities, full `DebtComponents` (16 line items: bank debt, term loans, revolving credit, lease liabilities, notes payable, subordinated debt, convertible debt, etc.)
- **Cash Flow**: CapEx, proceeds from LT debt, cash taxes, distributions, principal/interest payments, lease payments, repayment of debt
- **Fixed Charges**: senior/subordinated/lease interest, lease payments (operating + finance), principal payments, preferred dividends
- **Adjusted EBITDA Components**: 25+ adjustment categories (non-cash, one-time expenses/gains, owner adjustments, FX, pro forma)

---

## What It Computes

| Ratio | Formula | Purpose |
|---|---|---|
| **Adjusted EBITDA** | Net Income + Interest + Taxes + D&A +/- adjustments | True operating cash flow |
| **FCCR** (Covenant) | (Adj EBITDA - Unfunded CapEx - Cash Taxes - Distributions) / (Principal + Interest + Leases) | Can the borrower cover fixed obligations? |
| **DSCR** (Banker's) | Adj EBITDA / Total Debt Service | Debt service capacity |
| **Senior Debt/EBITDA** | Senior Debt / Adj EBITDA | Leverage |
| **Funded Debt/EBITDA** | Funded Debt / Adj EBITDA | Bank-specific leverage |
| **Total Debt/Total Capital** | Total Debt / (Total Debt + Equity) | Capital structure |
| **Interest Coverage** | EBITDA / Interest Expense | Interest paying ability |
| **Debt-to-Equity** | Total Debt / Equity | Balance sheet leverage |
| **Current Ratio** | Current Assets / Current Liabilities | Short-term liquidity |

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

### Task 2: Increase Extraction Accuracy
Improve the accuracy of AI-extracted financial data across all supported document types.
<!-- - [ ] Run extraction against all 11 test files in `public/financialReports/` and log current accuracy baselines -->
- [ ] Identify the most common extraction errors (missed line items, misclassified values, scale mismatches)
- [] Improve prompt engineering in the extraction pipeline to reduce errors — added multi-year column pinning, D&A arithmetic self-verification, expanded IFRS synonyms for `cash_taxes_paid`/`distributions_paid`, and `payment_of_lease_liability` principal-only clarification
- [] Strengthen conflict detection and merge logic for multi-chunk documents — implemented D&A component identity check in `validateArithmeticConsistency`, year-column awareness in reconciliation prompt
- [] Add validation checks that cross-reference extracted totals against reported totals — added 3 new checks to `validateArithmeticConsistency`: (1) interest P&L vs fixed_charges.total_interest_expense cross-reference, (2) income statement identity check (net_income ≈ revenue - expenses - interest - taxes), (3) reported_adjusted_ebitda plausibility vs calculated EBITDA base
<!-- - [ ] Re-run all 11 test files and document accuracy improvements vs. baseline -->

### Task 3: Audit & Fix Calculation Engine 
Review all calculators in `lib/calculations/` to ensure formulas return the most accurate results.
- [] Audit `ebitda-calculator.ts` — fixed `usedGrossFallback` flag incorrectly staying `false` when P&L interest field was absent (caused interest income double-deduction in Adjusted EBITDA)
- [] Audit `fccr-calculator.ts` — fixed distributions_paid never being deducted from FCCR numerator (was systematically overstating coverage for owner-operated businesses)
- [] Audit `dscr-calculator.ts` — verified debt service inputs; noted `repayment_of_debt` gross revolving inflation is a known limitation
- [] Audit `debt-calculator.ts` — verified senior/funded/total debt classification; noted bank debt fallback edge case
- [] Audit `debt-service-resolver.ts` — verified resolver logic; 1.15x cross-check threshold documented
- [] Audit `ratio-calculator.ts` — fixed three distress conditions (negative equity, negative EBITDA) that returned `null` instead of the actual ratio, hiding critical signals from analysts
- [] Fix any formula errors or edge cases found — also fixed DSCR not being recalculated in `recalculate.ts` when covenant config changes
<!-- - [ ] Test calculated outputs by running extraction against all files in `public/financialReports/` multiple times. Compare outputs across runs to identify inconsistencies and non-deterministic results. For each file, reason through the financial statements like a corporate finance analyst at a bank — read the income statement, balance sheet, and cash flow statement yourself, form your own conclusions about what the correct values should be, then compare against what the engine produced. Where outputs differ from what a banker would expect, diagnose why and fix the underlying extraction or calculation logic. -->

### Task 4: Polish Frontend UI/UX 
Improve the visual design, usability, and overall experience of the application.
- [] Audit all pages for visual consistency (spacing, typography, color usage, dark mode)
- [] Improve the upload flow — clearer progress states, better error messaging
- [] Polish the financial data tables — readability, alignment, responsive behavior
- [] Improve the risk assessment display — make scores and health indicators more intuitive
- [] Add loading skeletons and smooth transitions between states
- [] Ensure full dark mode support across all components
- [] Review and improve mobile/responsive layouts

<!-- ### Task 5: Regression Testing with Financial Reports 
Validate extraction integrity using the real financial reports in `public/financialReports/`.
- [] Create a test harness that runs extraction on each file and captures structured output — `scripts/test-extraction.ts`
- [] Build expected-value baselines for key metrics (EBITDA, total debt, senior debt, revenue) per file — snapshot system persists first-run output; ground truth from `lib/benchmarks/ground-truth.ts` used where verified
- [] Automate comparison of extraction output vs. baselines with pass/fail reporting — ✓/⚠/✗ at 5%/20% variance thresholds; exits with code 1 on any failure
- [] Document known edge cases per file (e.g., unusual line items, non-standard formatting) — `KNOWN_EDGE_CASES` map covers 8 files inline in the script
- [] Integrate regression checks into CI or a runnable script (`npm run test:extraction`) — added to `package.json` -->

### Task 6: Critical — Database & Data Integrity Fixes 
Prevent data corruption and silent failures in the extraction pipeline.
- [] Wrap extraction insert + project risk-score update in a Supabase RPC transaction (or validate every `.error` response) — validated every `.error` response on extraction insert and project update; non-fatal project update failure is now logged rather than silently swallowed
- [] Fix year-conflict detection running after insertion — detect conflicts before insert, or clean up orphaned records on cancel — moved conflict detection to run on a phantom extraction object BEFORE the DB insert; extraction is only inserted after conflict status is known
- [] Audit all Supabase calls in `route.ts` — check `{ data, error }` on every operation, log failures, update document status to `'failed'` — all Supabase operations now check `.error`; `updateDocumentStatus` logs failures; project update failure in `resolve-conflict/route.ts` also now logged
- [] Add cleanup mechanism for stale `processing` records (background job or cron marking stuck documents as `failed` after 15 min) — `cleanupStaleProcessingRecords()` runs at the start of each extraction, marking any document for that project stuck in `processing` for >15 min as `failed`

### Task 7: Critical — Document Parsing Completeness 
Ensure all accepted file types can actually be processed.
- [] Implement Excel parsing (`.xlsx`/`.xls` via existing `xlsx` dependency) in `document-parser.ts` — pipe-delimited sheet output with sheet headers, 2000-row cap per sheet
- [] Implement Word parsing (`.docx`) in `document-parser.ts` — using `mammoth` (added to dependencies); `.doc` throws a clear user-facing error directing them to save as `.docx`
- [] Add scanned PDF detection — checks text density (chars/page); if < 100 chars/page, prepends warning directing user to `/vision` upload

### Task 8: High — Error Handling & Resilience 
Make the pipeline gracefully handle failures instead of losing all progress.
- [] Wrap `generateRiskAssessment()`, `generateDebtHealthAssessment()`, `calculateQuantitativeRisk()` in individual try/catch blocks — allow partial success (return metrics with `riskSnapshot: null`)
- [] Implement exponential backoff with jitter for all Claude API calls (enable Anthropic SDK's built-in retry support)
- [] Guard all division operations in `lib/calculations/` — handle negative EBITDA, negative equity, zero denominators with `null` returns and explanatory warnings
- [] Align file-size limits: frontend (`FileUpload.tsx` 10MB) vs API (`route.ts` 50MB) vs error message (30MB) — use a single shared constant

### Task 9: High — Security Hardening 
Protect against abuse and data leaks.
- [] Add per-user rate limiting on `/api/extractData` — in-memory sliding-window limiter (5 req/10 min per user, map capped at 10k entries); returns 429 with `Retry-After` header
- [] Implement structured logging with sensitive data redaction — FCCR/Debt/Capital values in `risk-generator.ts` now gated behind `DEBUG_FINANCIALS` env flag (same pattern as chunk-processor and extraction-merger)
- [] Replace synchronous file I/O in `risk-generator.ts` cache — disk cache removed entirely; replaced with in-memory Map (100-entry LRU-style, oldest evicted when full)

### Task 10: Medium — Extraction Pipeline Robustness 
Improve accuracy and consistency of the extraction pipeline.
- [] Add `scale_correction_applied` flag per metric to prevent over-correction across the 3 normalization passes (detected scale → cross-metric → cross-year)
- [] Validate and normalize fiscal year format immediately after extraction — reject unrecognizable formats with warning
- [] Cap warnings array at ~50 entries; summarize overflow as "...and N more warnings"

### Task 12: Critical — Financial Calculation Accuracy Fixes
All three reviewers (senior-engineer, code-approver, financial-director) agree these affect lending decision accuracy.
- [x] Fix revolver gross-draw distortion in DSCR denominator — `repayment_of_debt` can include gross revolving credit draws/repays, severely inflating the denominator. Extract `net_repayment_of_revolving_credit` separately and prefer it, or cap at funded debt total. Surface warnings to UI, not just server logs.
- [x] Add preferred dividends to FCCR denominator — `preferred_dividends` is extracted in fixed charges but excluded from the FCCR denominator. Preferred dividends are a fixed charge by definition in commercial lending.
- [x] Fix cash taxes fallback to zero in FCCR — when `cash_taxes_paid` is null, the numerator defaults to zero tax deduction, inflating FCCR for profitable companies by 10-20+ bps. Fallback should use income statement tax expense.
- [x] Fix ICR to use Adjusted EBITDA — `risk-generator.ts` computes ICR with `m.ebitda` (raw) while DSCR/FCCR use Adjusted EBITDA. Creates inconsistent signals in the AI risk assessment input.
- [x] Surface negative FCCR as a validation issue — negative FCCR (numerator < 0) means cash flow is insufficient for ANY debt service. Currently returned silently as a negative number with no alert.
- [x] Fix `funded_debt_to_ebitda` coerced to 0 in DSCR breakdown — type forces `number` instead of `number | null`, causing the display to show `0x` instead of `N/A` when EBITDA is zero. Misleads analysts.
- [x] Fix bank debt double-counting edge case — when `bank_debt_current` is partially extracted (non-zero) but `bank_debt_long_term` is missing, the fallback to disaggregated fields is skipped. Guard should check both are non-null, not just that their sum is non-zero.
- [x] Add reported vs. calculated Adjusted EBITDA reconciliation — when company discloses its own Adjusted EBITDA, the system uses it without comparing to the lender's calculation. Divergence >5% should surface as a red flag to the analyst.
- [x] Calibrate FCCR Adequate threshold from 1.2x to 1.25x — industry minimum covenant standard is 1.25x. Showing 1.2x as "Adequate" sends a false comfort signal.

### Task 13: Critical — Security & Data Integrity
Consensus across senior-engineer and code-approver; some overlap with financial-director on data correctness.
- [x] Fix path traversal vulnerability in temp file creation — `file.name` is user-controlled and used directly in `path.join()` for temp path. Sanitize with `path.basename()` and strip special characters.
- [ ] Replace in-memory rate limiter with persistent solution — module-level `Map` does not survive serverless cold starts or work across instances. Replace with Redis/Upstash before handling real financial data.
- [ ] Fix Zod validation fallback passing unvalidated risk data — when `riskDataSchema.safeParse()` fails, raw unvalidated AI output is used as `riskSnapshot` and stored in Supabase. Should return `null` (caller already handles it) instead of passing malformed data through.
- [ ] Scope risk cache to userId — module-level `riskCache` uses metrics hash as key without user/document scoping. Two companies with identical metrics would share a cached risk assessment. Include `userId` in cache key.
- [ ] Add server-side magic-byte file type validation — MIME type check uses browser-supplied `Content-Type` which is trivially spoofable. Add `file-type` or similar magic-byte detection for uploaded documents.

### Task 14: High — Pipeline Robustness
Senior-engineer and code-approver agree on extraction pipeline ordering and data flow issues.
- [ ] Normalize year keys BEFORE merge, not after — two chunks producing `"FY2023"` and `"2023"` for the same year are treated as separate years during merge, then one is silently dropped by post-merge normalization. Normalize on each individual extraction result before passing to `mergeExtractionsWithConflicts`.
- [ ] Fix FCCR receiving stale `m` instead of updated `result` in `computeMetrics` — DSCR correctly passes the cloned/updated `result`, but FCCR passes the original `m`. If a future change writes a field to `result` that FCCR reads, it will silently use stale data.
- [ ] Fix `primary_fiscal_year` using first-non-null instead of most-common/latest — chunk 1 may contain only notes pages with a comparative year header. Should pick the most-commonly reported value or the latest year.
- [ ] Add TTM annualization for interim period submissions — if a borrower submits a Q3 report, revenue/EBITDA are 9-month figures but debt balances are point-in-time. Coverage ratios will be distorted without annualization.
- [ ] Fix `JSON.stringify` replacer used incorrectly for risk cache key — second argument to `JSON.stringify` is a replacer/filter, not a key sorter. Nested keys are not sorted, producing unstable cache keys that cause cache misses and waste AI tokens.
- [ ] Implement `isOverlapSource` or remove it — stub always returns `false`, making `SOURCE_WEIGHTS.overlap = 0.68` dead code. Overlap-region values are never downweighted.
- [ ] Fix `principal || null` converting legitimate zero to null — in `debt-service-resolver.ts`, if a company has fully repaid debt and `principal` is legitimately `0`, the audit trail shows `null` instead of `0`.

### Task 15½: High — API Error Resilience & User Feedback
Discovered when Anthropic API returned 400 (insufficient credits) — pipeline silently saved incomplete data with null risk assessment and 0-year quantitative risk.
- [ ] Surface API billing/auth errors to the user — when Claude returns 400 (credit balance, invalid key, etc.), the extraction currently "succeeds" and saves to DB with `riskSnapshot: null` and `quantitativeRisk: null`. The user sees no error. Show a clear toast/banner: "Risk assessment unavailable — API credit issue" with the specific error reason.
- [ ] Distinguish API errors from extraction failures — a 400 billing error is not a transient failure worth retrying. Tag the error class (billing, auth, rate-limit, model error, transient) so the UI can show actionable guidance ("add credits" vs "try again later").
- [ ] Prevent saving extractions with 0-year quantitative risk — `quantitative-risk.ts` computed for "0 years: []" and returned NULL. The extraction was still saved as successful. If both risk assessment AND quantitative risk are null, flag the extraction as `partial` in the DB status rather than letting it appear complete.
- [ ] Fix storage delete error (22P02) — `DELETE /api/documents/[id]` logs `StorageApiError: database error, code: 22P02` (invalid text representation — likely a UUID format issue). The delete returns 200 despite the storage failure, leaving orphaned files.

### Task 15: Medium — Type Safety & UI Consistency
Code-approver and senior-engineer agree on type drift, hardcoded thresholds, and display issues.
- [ ] Eliminate duplicate type definitions — `FCCRBreakdown` is defined in 3 places (`types/financial.ts`, `DebtHealthMeters.tsx`, `FCCRBreakdown.tsx`). `ExtractionResult` has two definitions (`aiProcessor.ts`, `supabase/types.ts`). Use canonical types from `types/` everywhere.
- [ ] Fix FCCRBreakdown component dark mode — entire component uses raw Tailwind colors (`text-gray-800`, `bg-blue-50`) instead of design tokens (`text-foreground`, `bg-card`). Broken in dark mode and visually inconsistent.
- [ ] Import thresholds from `constants.ts` — hero cards in `ProjectDetail` hardcode Sr. Debt/EBITDA "good" at 3.0x when `constants.ts` defines 2.5x. `WeightedRiskGauge` hardcodes weight percentages. `QuantitativeRiskCard` hardcodes arc length. All should read from shared constants.
- [ ] Import `PILLAR_KEYS` from `constants.ts` in `RiskAssessment.tsx` — currently duplicated locally, will drift if pillar set changes.
- [ ] Fix `onDataExtracted` to consume ExtractionResult payload — `ProjectDetail.handleDataUpdate` discards the extraction result and calls `router.refresh()`, forcing an unnecessary server round-trip when the data is already in memory from the SSE stream.
- [ ] Remove dead `riskData` state in `ProjectDetail` — stored, prop-drilled to `WeightedRiskGauge`, but never rendered (pillar observations section is commented out).
- [ ] Fix `as unknown as` cast in `ProjectDetail.tsx:703` — type mismatch between `displayData` and `FinancialTable` props being suppressed with unsafe cast. Align types properly.
- [ ] Fix `getFCCRRiskLevel(null)` defaulting to `'adequate'` — null FCCR (unmeasured) is styled as borderline rather than unknown. Should return a conservative or distinct `'unknown'` state.

---

### Task 16: Critical — Financial Director Methodology Review
Financial Director sign-off on calculation engine (2026-03-17). Core methodology approved — EBITDA formula, FCCR covenant structure, D&A completeness gate, interest fallback chain, distributions deduction, pro forma cap, lease double-count prevention all pass. Five issues found before live credit use. Overlaps with Task 12 on preferred dividends — resolve together.
- [x] Add preferred dividends to FCCR denominator (CRITICAL) — `FixedCharges.preferred_dividends` is extracted and in `CANONICAL_STATEMENT_MAP` but `resolveDebtService()` never includes it in the denominator total. For any borrower with preferred equity, FCCR is overstated. Add `fc.preferred_dividends ?? 0` to `resolveDebtService()` total and expose in `FCCRBreakdown.sources`. Do NOT confuse with `distributions_paid` (common equity, numerator deduction) — preferred dividends are a senior contractual fixed obligation and belong in the denominator. Files: `debt-service-resolver.ts`, `fccr-calculator.ts`
- [ ] Rename or eliminate mislabeled DSCR (SIGNIFICANT) — code labels `Adj EBITDA / Total Debt Service` as "Banker's Covenant DSCR" but true DSCR uses net operating cash flow, not EBITDA before CapEx/taxes/distributions. Creates confusion when analysts compare two coverage numbers side-by-side or reconcile against borrower's own DSCR. Option A (preferred): rename to "EBITDA Coverage Ratio" across `dscr-calculator.ts`, `DSCRBreakdown.calculation_type`, `lib/constants.ts`, and all UI labels. Option B: redefine numerator to match FCCR (Adj EBITDA - CapEx - Cash Taxes - Distributions), eliminating redundancy — keep only FCCR. Files: `dscr-calculator.ts`, `lib/constants.ts`, UI display labels
- [ ] Warn when cash taxes include non-recurring disposal taxes (SIGNIFICANT) — FCCR numerator deducts `cash_taxes_paid` in full, but in years with large asset sales, this includes taxes on the capital gain. Since the gain is already excluded from Adj EBITDA, the tax cost double-penalizes the borrower. Minimum fix: log warning when `cash_taxes_paid` exceeds income statement `taxes` by >25%, flag for analyst review, and document limitation in `FCCRBreakdown` output. Long-term: add `cash_taxes_recurring` to extraction schema. File: `fccr-calculator.ts`
- [ ] Remove Check 1b proportionality heuristic from `deduplicateOtherNonCash` (MODERATE) — zeros `other_non_cash` when it's 30-100% of `non_cash_interest_expense`, but proportion alone is not evidence of duplication. Example: $500K non-cash interest (debt issuance cost amortization) + $200K SBC in `other_non_cash` → 40% match → SBC silently zeroed. Only safe triggers are direct value match (Check 1a) or structural signal (Check 1c `usedGrossFallback`). Remove lines 274-284 entirely. File: `ebitda-calculator.ts`
- [ ] Remove Guard 7 Tier 2 envelope test from `deduplicateFinanceCostExpenses` (MODERATE) — zeros `other_one_time_expenses` when `non_cash_interest + expenses` fits within the interest envelope, but "fits numerically" is not the same as "is a sub-component." Example: $600K amortization (30% of $2M interest) + $500K legitimate restructuring legal fees → $1.1M within $2M → legal fees zeroed. Keep only Tier 1 identity match (`expenses ≈ cashInterestResidual`) which has clear economic rationale. Remove lines 376-398. File: `ebitda-calculator.ts`

**Advisory observations (no code change now):**
- A: Gross revolver repayment in principal — code warns but doesn't correct. Long-term: extract `net_revolver_repayment` separately.
- B: Operating lease default `exclude` is correct post-IFRS 16 — document in analyst-facing output for pre-IFRS 16 comparisons.
- C: Interest income exclusion has no materiality floor — consider suppressing when `interest_income < 0.5% of EBITDA` to reduce noise.

---

### Task 17: High — Revolver Warning & Fatal Error Fixes
Senior-engineer and code-approver review (2026-03-18). Both reviewers converged on the same critical finding: the revolver warning shipped in `9d98846` is invisible to analysts in the most common scenario.
- [ ] **HIGH — Remove `!hasPartialExtraction` gate suppressing extraction warnings** — `ExtractionWarnings.tsx:46` hides all `extractionWarnings` (including revolver distortion warnings) when any chunk fails. The partial extraction banner and extraction warnings are orthogonal concerns — a document with one failed chunk AND suspicious `repayment_of_debt` values is precisely when analysts need both. Remove `&& !hasPartialExtraction` from line 46. File: `components/ExtractionWarnings.tsx`
- [ ] **HIGH — Union extraction_warnings from all documents in multi-doc merge** — `extraction-utils.ts:658-660` copies warnings only from the most-recent-year document. If year 2022 came from Document A (which has a revolver warning) and year 2024 came from Document B (no warning), the 2022 revolver warning is silently dropped. Union all documents' `extraction_warnings` arrays instead of taking only the most recent. File: `lib/extraction-utils.ts`
- [ ] **MEDIUM — Tighten `classifyFatalError` auth check** — `chunk-processor.ts:526` matches `'authentication'` as a substring, which is too broad and could match transient errors unrelated to API key validity. Tighten to `'authentication_error'` to match Anthropic's specific error type string. File: `lib/chunk-processor.ts`
- [ ] **MEDIUM — Distinguish skipped chunks from failed in `chunk_stats`** — When fatal error aborts the pipeline, remaining chunks are filled as `{ result: null }` with no marker. They're counted as failures, making `chunk_stats.failed` misleadingly high (e.g., "8 of 10 sections failed" when only 1 actually failed and 7 were skipped). Add `skipped?: boolean` to `ChunkResult`, set it on fill-in entries, and separate failed vs skipped in stats and warning messages. Files: `lib/chunk-processor.ts`, `utils/aiProcessor.ts`

---

### Task 18: Critical — Database Security & RLS Hardening
Database audit (2026-03-18). RLS policies are effectively disabled — all three tables use `USING (true)` / `WITH CHECK (true)`, meaning any authenticated user can read/write any row. The app relies entirely on application-level `.eq('user_id', userId)` filters. Multiple authorization gaps found in API routes.
- [ ] **CRITICAL — Replace permissive RLS policies with proper user-scoped policies** — `projects`, `documents`, and `extractions` tables all have `USING (true)` / `WITH CHECK (true)` policies that allow any authenticated user full access to all rows. Replace with operation-specific policies: `USING (auth.uid()::text = user_id)` and `WITH CHECK (auth.uid()::text = user_id)` on all three tables. This is the single most important security fix — without it, a compromised or malicious JWT gives access to every user's financial data.
- [ ] **CRITICAL — Add project ownership check on file upload routes** — `/api/extractData/route.ts` and `/api/extractData/vision/route.ts` accept a client-provided `projectId` without verifying the authenticated user owns that project. An attacker who knows a project UUID can upload documents into another user's project. Add `.eq('id', projectId).eq('user_id', userId)` ownership verification before processing. Same issue exists in `/api/resolve-conflict` POST route. Files: `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`, `app/api/resolve-conflict/route.ts`
- [ ] **HIGH — Stop returning raw Supabase error messages to client** — every API route returns `error.message` from Supabase failures directly in the response JSON. This can expose table names, column names, constraint names, and query structure to attackers. Log detailed errors server-side with `console.error()`, return generic messages like `"An error occurred"` to the client. Files: `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/resolve-conflict/route.ts`
- [ ] **HIGH — Eliminate admin client usage for storage operations** — `createAdminClient()` bypasses RLS entirely for storage uploads/downloads, justified by a UUID casting issue in RLS policies. Investigate and fix the casting issue so the authenticated client can handle storage directly, then remove `createAdminClient()` from extraction routes. Files: `utils/supabase/server.ts`, `app/api/extractData/route.ts`, `app/api/extractData/vision/route.ts`
- [ ] **MEDIUM — Add storage bucket RLS policies** — the `financial-documents` storage bucket has no explicit RLS policies configured. Storage paths use `{userId}/{projectId}/{docId}/{filename}` convention but access isn't enforced at the bucket level. Add policies that restrict access to the user's own path prefix.
- [ ] **LOW — Drop unused `profiles` table** — schema defines a `profiles` table with `id`, `email`, `full_name`, `company_name` columns but it's never queried anywhere in the codebase. Dead schema creates confusion and unnecessary attack surface. Either remove it or implement it. File: `lib/supabase/types.ts`
