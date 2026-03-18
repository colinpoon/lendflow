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

### Task 1: Covenant Parameters UI ✅
Completed — see progress.txt (commit d44245f)

### Task 2: Increase Extraction Accuracy
Improve the accuracy of AI-extracted financial data across all supported document types.
- [ ] Run extraction against all 11 test files in `public/financialReports/` and log current accuracy baselines
- [ ] Identify the most common extraction errors (missed line items, misclassified values, scale mismatches)
- [x] Improve prompt engineering in the extraction pipeline to reduce errors — added multi-year column pinning, D&A arithmetic self-verification, expanded IFRS synonyms for `cash_taxes_paid`/`distributions_paid`, and `payment_of_lease_liability` principal-only clarification
- [x] Strengthen conflict detection and merge logic for multi-chunk documents — implemented D&A component identity check in `validateArithmeticConsistency`, year-column awareness in reconciliation prompt
- [x] Add validation checks that cross-reference extracted totals against reported totals — added 3 new checks to `validateArithmeticConsistency`: (1) interest P&L vs fixed_charges.total_interest_expense cross-reference, (2) income statement identity check (net_income ≈ revenue - expenses - interest - taxes), (3) reported_adjusted_ebitda plausibility vs calculated EBITDA base
- [ ] Re-run all 11 test files and document accuracy improvements vs. baseline

### Task 3: Audit & Fix Calculation Engine ✅
Review all calculators in `lib/calculations/` to ensure formulas return the most accurate results.
- [x] Audit `ebitda-calculator.ts` — fixed `usedGrossFallback` flag incorrectly staying `false` when P&L interest field was absent (caused interest income double-deduction in Adjusted EBITDA)
- [x] Audit `fccr-calculator.ts` — fixed distributions_paid never being deducted from FCCR numerator (was systematically overstating coverage for owner-operated businesses)
- [x] Audit `dscr-calculator.ts` — verified debt service inputs; noted `repayment_of_debt` gross revolving inflation is a known limitation
- [x] Audit `debt-calculator.ts` — verified senior/funded/total debt classification; noted bank debt fallback edge case
- [x] Audit `debt-service-resolver.ts` — verified resolver logic; 1.15x cross-check threshold documented
- [x] Audit `ratio-calculator.ts` — fixed three distress conditions (negative equity, negative EBITDA) that returned `null` instead of the actual ratio, hiding critical signals from analysts
- [x] Fix any formula errors or edge cases found — also fixed DSCR not being recalculated in `recalculate.ts` when covenant config changes
- [ ] Test calculated outputs by running extraction against all files in `public/financialReports/` multiple times. Compare outputs across runs to identify inconsistencies and non-deterministic results. For each file, reason through the financial statements like a corporate finance analyst at a bank — read the income statement, balance sheet, and cash flow statement yourself, form your own conclusions about what the correct values should be, then compare against what the engine produced. Where outputs differ from what a banker would expect, diagnose why and fix the underlying extraction or calculation logic.

### Task 4: Polish Frontend UI/UX ✅
Improve the visual design, usability, and overall experience of the application.
- [x] Audit all pages for visual consistency (spacing, typography, color usage, dark mode)
- [x] Improve the upload flow — clearer progress states, better error messaging
- [x] Polish the financial data tables — readability, alignment, responsive behavior
- [x] Improve the risk assessment display — make scores and health indicators more intuitive
- [x] Add loading skeletons and smooth transitions between states
- [x] Ensure full dark mode support across all components
- [x] Review and improve mobile/responsive layouts

### Task 5: Regression Testing with Financial Reports ✅
Validate extraction integrity using the real financial reports in `public/financialReports/`.
- [x] Create a test harness that runs extraction on each file and captures structured output — `scripts/test-extraction.ts`
- [x] Build expected-value baselines for key metrics (EBITDA, total debt, senior debt, revenue) per file — snapshot system persists first-run output; ground truth from `lib/benchmarks/ground-truth.ts` used where verified
- [x] Automate comparison of extraction output vs. baselines with pass/fail reporting — ✓/⚠/✗ at 5%/20% variance thresholds; exits with code 1 on any failure
- [x] Document known edge cases per file (e.g., unusual line items, non-standard formatting) — `KNOWN_EDGE_CASES` map covers 8 files inline in the script
- [x] Integrate regression checks into CI or a runnable script (`npm run test:extraction`) — added to `package.json`



### Task 6: Critical — Database & Data Integrity Fixes ✅
Prevent data corruption and silent failures in the extraction pipeline.
- [x] Wrap extraction insert + project risk-score update in a Supabase RPC transaction (or validate every `.error` response) — validated every `.error` response on extraction insert and project update; non-fatal project update failure is now logged rather than silently swallowed
- [x] Fix year-conflict detection running after insertion — detect conflicts before insert, or clean up orphaned records on cancel — moved conflict detection to run on a phantom extraction object BEFORE the DB insert; extraction is only inserted after conflict status is known
- [x] Audit all Supabase calls in `route.ts` — check `{ data, error }` on every operation, log failures, update document status to `'failed'` — all Supabase operations now check `.error`; `updateDocumentStatus` logs failures; project update failure in `resolve-conflict/route.ts` also now logged
- [x] Add cleanup mechanism for stale `processing` records (background job or cron marking stuck documents as `failed` after 15 min) — `cleanupStaleProcessingRecords()` runs at the start of each extraction, marking any document for that project stuck in `processing` for >15 min as `failed`

### Task 7: Critical — Document Parsing Completeness ✅
Ensure all accepted file types can actually be processed.
- [x] Implement Excel parsing (`.xlsx`/`.xls` via existing `xlsx` dependency) in `document-parser.ts` — pipe-delimited sheet output with sheet headers, 2000-row cap per sheet
- [x] Implement Word parsing (`.docx`) in `document-parser.ts` — using `mammoth` (added to dependencies); `.doc` throws a clear user-facing error directing them to save as `.docx`
- [x] Add scanned PDF detection — checks text density (chars/page); if < 100 chars/page, prepends warning directing user to `/vision` upload

### Task 8: High — Error Handling & Resilience ✅
Make the pipeline gracefully handle failures instead of losing all progress.
- [x] Wrap `generateRiskAssessment()`, `generateDebtHealthAssessment()`, `calculateQuantitativeRisk()` in individual try/catch blocks — allow partial success (return metrics with `riskSnapshot: null`)
- [x] Implement exponential backoff with jitter for all Claude API calls (enable Anthropic SDK's built-in retry support)
- [x] Guard all division operations in `lib/calculations/` — handle negative EBITDA, negative equity, zero denominators with `null` returns and explanatory warnings
- [x] Align file-size limits: frontend (`FileUpload.tsx` 10MB) vs API (`route.ts` 50MB) vs error message (30MB) — use a single shared constant

### Task 9: High — Security Hardening ✅
Protect against abuse and data leaks.
- [x] Add per-user rate limiting on `/api/extractData` — in-memory sliding-window limiter (5 req/10 min per user, map capped at 10k entries); returns 429 with `Retry-After` header
- [x] Implement structured logging with sensitive data redaction — FCCR/Debt/Capital values in `risk-generator.ts` now gated behind `DEBUG_FINANCIALS` env flag (same pattern as chunk-processor and extraction-merger)
- [x] Replace synchronous file I/O in `risk-generator.ts` cache — disk cache removed entirely; replaced with in-memory Map (100-entry LRU-style, oldest evicted when full)

### Task 10: Medium — Extraction Pipeline Robustness ✅
Improve accuracy and consistency of the extraction pipeline.
- [x] Add `scale_correction_applied` flag per metric to prevent over-correction across the 3 normalization passes (detected scale → cross-metric → cross-year)
- [x] Validate and normalize fiscal year format immediately after extraction — reject unrecognizable formats with warning
- [x] Cap warnings array at ~50 entries; summarize overflow as "...and N more warnings"

### Task 11: Low — Type Safety & Developer Experience
Reduce technical debt and improve maintainability.
- [ ] Add Zod schemas for AI response validation at the boundary; generate TypeScript types from schemas
- [ ] Replace `as unknown as X` casts and `Record<string, unknown>` types with proper typed interfaces
- [ ] Wrap `FinancialTable`, `RiskAssessment`, and `EBITDA` components with `<ErrorBoundary>`
- [ ] Move AI model version to `ANTHROPIC_MODEL` env var with current value as default
- [ ] Add `.env.example` with all required environment variables and placeholder values

---

## Summary

Lendflow is a serious fintech tool that replicates what a credit analyst does — reading financial statements, normalizing data, computing covenant ratios, and assessing risk — but does it in minutes with AI. The extraction pipeline has audit-grade sophistication (source weighting, conflict resolution, scale normalization, canonical statement mapping), and the calculation engine mirrors real commercial loan agreement structures with configurable covenant parameters.
