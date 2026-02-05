# Testing Patterns

**Analysis Date:** 2026-02-05

## Test Framework

**Status:** Not configured

No testing framework is currently set up in this project. There are no test files (`.test.ts`, `.spec.ts`), no test runner configuration (`jest.config.js`, `vitest.config.ts`), and no test dependencies in `package.json`.

**Implications:**
- No automated test suite runs during build
- Manual testing only (via dev server and browser)
- Future testing will need to introduce a framework

## Test File Organization

**Recommended Structure (not currently in use):**
- Location: Co-located with source files
- Naming: `[filename].test.ts` or `[filename].spec.ts`
- Pattern: `utils/aiProcessor.ts` → `utils/aiProcessor.test.ts`
- Fixtures: Separate `__fixtures__` or `__mocks__` directories per domain

**Current Reality:**
- No test files exist in the codebase
- No test fixtures or mock data files present
- Manual testing via public test PDFs in `public/financialReports`

## Test Coverage Gaps

**Critical Areas Without Tests:**

**AI Extraction Pipeline** (`utils/aiProcessor.ts`):
- What's not tested: Document parsing, chunking, deduplication, sequential processing, metric computation, validation, financial calculations
- Files: `utils/aiProcessor.ts`, `lib/chunk-processor.ts`, `lib/document-parser.ts`
- Risk: Bugs in AI extraction go undetected until manual testing with real documents
- Priority: High - core business logic

**Financial Calculations** (`lib/calculations/`):
- What's not tested: EBITDA calculation, adjusted EBITDA adjustments, FCCR computation, debt ratios, DSCR calculation
- Files: `lib/calculations/ebitda-calculator.ts`, `lib/calculations/fccr-calculator.ts`, `lib/calculations/dscr-calculator.ts`, `lib/calculations/ratio-calculator.ts`, `lib/calculations/debt-calculator.ts`
- Risk: Incorrect ratio calculations could lead to wrong lending decisions
- Priority: Critical - financial accuracy is paramount

**Risk Assessment Generation** (`lib/risk-generator.ts`):
- What's not tested: AI-powered risk scoring, credit assessment logic, caching behavior, edge cases in pillar analysis
- Files: `lib/risk-generator.ts`, `lib/risk-scoring.ts`
- Risk: Flawed risk bands could mislead lending decisions
- Priority: Critical

**File Upload & Compression** (`components/FileUpload.tsx`):
- What's not tested: PDF compression logic, file size validation, progress simulation, error states
- Files: `components/FileUpload.tsx`
- Risk: File handling edge cases (corrupted PDFs, size boundary conditions) could crash or silently fail
- Priority: High

**API Route** (`app/api/extractData/route.ts`):
- What's not tested: Form parsing, file validation, path resolution, error responses, timeout handling
- Files: `app/api/extractData/route.ts`
- Risk: Malformed requests or missing files could return unhelpful errors or hang
- Priority: High

**Data Merging & Reconciliation** (`lib/extraction-merger.ts`, `lib/extraction-reconciler.ts`):
- What's not tested: Conflict resolution, metric merging from multiple chunks, deterministic ordering
- Files: `lib/extraction-merger.ts`, `lib/extraction-reconciler.ts`
- Risk: Duplicate or contradictory metrics could silently produce wrong consolidated results
- Priority: High

**UI Components** (`components/`):
- What's not tested: Rendering, formatting, conditional display, data flow through tabs
- Files: All components in `components/`
- Risk: Display bugs could mislead analysts
- Priority: Medium - less critical than calculations

## Manual Testing Evidence

**Current Testing Approach:**
- Dev server: `npm run dev` runs app locally with Turbopack
- Test PDFs: `public/financialReports/` contains financial documents used for manual verification
- Console logging: Extensive debug logging with emojis shows developers what's happening
- Browser testing: Visual inspection of results through UI tabs

**Known Test Cases (documented in console):**
- Reference document: Zedcor FY2024 with expected values documented in code comments
  - Expected Adjusted EBITDA: $7,541K
  - Expected FCCR: 0.44x
  - Expected Senior Debt/EBITDA: 3.2x
  - Expected Total Debt/Total Cap: 69.5%

## Recommended Testing Strategy

**Phase 1: Unit Tests (Critical Path)**
1. Financial calculators: Test EBITDA, adjusted EBITDA, ratios with known inputs/outputs
2. Text chunking: Test deduplication, deterministic ordering
3. Data merging: Test conflict resolution logic

**Phase 2: Integration Tests**
1. End-to-end extraction: Upload test PDF → extract → validate output
2. API route: Mock file upload → validation → response structure
3. Calculation pipeline: Extracted metrics → computed ratios → risk assessment

**Phase 3: Component Tests**
1. FileUpload: File selection, compression, progress states
2. Display components: Correct formatting, null handling, empty states

**Framework Recommendation:**
- Use Vitest (fast, ESM-native, Vite integration)
- Or Jest (familiar ecosystem, good Next.js integration)
- Assertion library: chai or built-in expect

---

*Testing analysis: 2026-02-05*
