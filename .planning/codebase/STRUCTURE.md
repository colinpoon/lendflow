# Codebase Structure

**Analysis Date:** 2026-02-05

## Directory Layout

```
lendflow/
├── app/                           # Next.js 15 App Router pages
│   ├── api/                       # API routes
│   │   └── extractData/
│   │       └── route.ts           # POST endpoint for file extraction
│   ├── (dashboard)/               # Route group (not in URL)
│   │   └── (routes)/
│   │       └── upload/
│   │           └── page.tsx       # Main dashboard upload page
│   ├── dashboard/                 # Dashboard pages (alternative routes)
│   ├── page.tsx                   # Root page
│   └── layout.tsx                 # Root layout
├── components/                    # React components
│   ├── ui/                        # shadcn/ui components (Button, Card, Tabs, etc.)
│   ├── FileUpload.tsx             # File upload form with progress
│   ├── FinancialTable.tsx         # Metrics table by year
│   ├── EBITDA.tsx                 # EBITDA display
│   ├── AdjustedEBITDA.tsx         # Adjusted EBITDA display
│   ├── RiskAssessment.tsx         # Risk pillars visualization
│   ├── WeightedRiskGauge.tsx      # Risk gauge chart
│   ├── DebtHealthMeters.tsx       # Debt health visualization
│   ├── FCCRBreakdown.tsx          # FCCR components breakdown
│   ├── ExtractedData.tsx          # Raw extracted metrics display
│   └── AppSidebar.tsx             # Navigation sidebar
├── lib/                           # Core business logic
│   ├── document-parser.ts         # PDF/text parsing
│   ├── chunk-processor.ts         # Chunking, dedup, OpenAI calls
│   ├── extraction-merger.ts       # Merge multiple extractions
│   ├── extraction-reconciler.ts   # Conflict resolution (unused)
│   ├── risk-generator.ts          # Risk assessment generation
│   ├── risk-scoring.ts            # Risk score calculations
│   ├── constants.ts               # AI config (chunk size, retries)
│   ├── utils.ts                   # Helper functions
│   ├── calculations/              # Financial metric calculations
│   │   ├── index.ts               # Export all calculators
│   │   ├── ebitda-calculator.ts   # EBITDA & adjusted EBITDA
│   │   ├── debt-calculator.ts     # Senior/total debt calculation
│   │   ├── fccr-calculator.ts     # Fixed charge coverage ratio
│   │   ├── dscr-calculator.ts     # Debt service coverage ratio
│   │   └── ratio-calculator.ts    # Interest coverage, debt-to-equity
│   ├── prompts/                   # AI extraction prompts
│   │   ├── extraction-prompt.ts   # System prompts for metrics & risk
│   │   └── reconciliation-prompt.ts # Conflict resolution prompt
│   └── index.ts                   # Barrel export
├── types/                         # TypeScript type definitions
│   ├── index.ts                   # Centralized exports
│   ├── financial.ts               # Financial metric types
│   ├── extraction.ts              # Extraction result types
│   ├── risk.ts                    # Risk assessment types
│   └── pdf-parse.d.ts             # PDF parser type shim
├── utils/                         # Utilities
│   ├── aiProcessor.ts             # Main extraction pipeline orchestrator
│   └── supabase/                  # Supabase integration (not active)
├── hooks/                         # React hooks
│   └── use-mobile.ts              # Mobile detection hook
├── public/                        # Static assets
│   └── financialReports/          # Test PDFs for validation
├── scripts/                       # Build/utility scripts
├── .planning/                     # Planning documents
│   └── codebase/                  # Architecture documents (this dir)
├── uploads/                       # Temporary file storage (created at runtime)
├── package.json                   # Node dependencies
├── tsconfig.json                  # TypeScript config with @ path alias
├── next.config.ts                 # Next.js config
├── tailwind.config.ts             # Tailwind CSS v4 config
└── eslint.config.mjs              # ESLint config
```

## Directory Purposes

**`app/`**
- Purpose: Next.js 15 App Router pages and API routes
- Contains: Page components, API endpoints, layouts
- Key files: `page.tsx` (upload page), `api/extractData/route.ts` (extraction endpoint)

**`components/`**
- Purpose: Reusable React components for UI
- Contains: Display components, UI primitives, tabs, charts
- Key files: `FileUpload.tsx` (upload form), `FinancialTable.tsx` (metrics display), `RiskAssessment.tsx` (risk pillars)

**`lib/`**
- Purpose: Core business logic, calculations, AI integration
- Contains: Document parsing, chunk processing, metric calculations, risk assessment
- Key files: `document-parser.ts`, `chunk-processor.ts`, `calculations/index.ts`, `risk-generator.ts`

**`lib/calculations/`**
- Purpose: Financial metric computation
- Contains: EBITDA, adjusted EBITDA, debt metrics, ratios, FCCR, DSCR
- Key files: `ebitda-calculator.ts`, `debt-calculator.ts`, `fccr-calculator.ts`, `dscr-calculator.ts`

**`lib/prompts/`**
- Purpose: AI extraction system prompts
- Contains: Financial metrics extraction prompt, risk assessment prompt, debt health prompt
- Key files: `extraction-prompt.ts` (main prompts)

**`types/`**
- Purpose: Centralized TypeScript type definitions
- Contains: Financial types, risk types, extraction result types
- Key files: `financial.ts` (main metrics), `risk.ts` (risk assessment), `extraction.ts` (result types)

**`utils/`**
- Purpose: Utility functions and integration code
- Contains: Main extraction pipeline orchestrator, Supabase client
- Key files: `aiProcessor.ts` (extraction orchestrator)

**`public/`**
- Purpose: Static assets
- Contains: Test financial reports for validation
- Key files: PDFs in `financialReports/`

**`uploads/`**
- Purpose: Temporary file storage
- Generated: Yes (created by formidable at runtime)
- Committed: No (should be in .gitignore)

**`.planning/codebase/`**
- Purpose: Architecture and structure documentation
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Committed: Yes

## Key File Locations

**Entry Points:**
- `app/(dashboard)/(routes)/upload/page.tsx`: Main dashboard UI
- `app/api/extractData/route.ts`: File extraction API endpoint
- `utils/aiProcessor.ts`: Extraction pipeline orchestrator

**Configuration:**
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript config with `@/*` path alias pointing to root
- `next.config.ts`: Next.js configuration
- `tailwind.config.ts`: Tailwind CSS configuration

**Core Logic:**
- `utils/aiProcessor.ts`: 8-phase extraction pipeline
- `lib/document-parser.ts`: PDF/text parsing
- `lib/chunk-processor.ts`: Chunking and OpenAI calls
- `lib/extraction-merger.ts`: Merge multiple chunk results
- `lib/calculations/index.ts`: All financial calculators

**Type Definitions:**
- `types/financial.ts`: ExtractedMetrics, ComputedMetrics
- `types/risk.ts`: RiskData, DebtHealthAssessment
- `types/extraction.ts`: ExtractionResult

**UI Components:**
- `components/FileUpload.tsx`: File upload with progress simulation
- `components/FinancialTable.tsx`: Metrics display
- `components/RiskAssessment.tsx`: Risk pillars
- `components/WeightedRiskGauge.tsx`: Risk gauge chart
- `components/FCCRBreakdown.tsx`: FCCR details with custom adjustments

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (e.g., `FileUpload.tsx`, `FinancialTable.tsx`)
- Utilities: kebab-case.ts (e.g., `document-parser.ts`, `chunk-processor.ts`)
- API routes: `route.ts` (Next.js convention)
- Types: Singular noun in filename (e.g., `financial.ts` exports types, `risk.ts` for risk types)

**Directories:**
- Lowercase, descriptive (e.g., `components/`, `lib/`, `utils/`, `types/`)
- Grouped by domain: `lib/calculations/`, `lib/prompts/`, `app/api/`

**Functions/Variables:**
- Camel case (e.g., `extractFinancialData`, `mergeExtractions`, `calculateDSCR`)
- Descriptive names with action verbs (parse, extract, calculate, merge, generate)

**React Components:**
- Export as default function with PascalCase name
- Props interface named `{ComponentName}Props`

**Types:**
- Interfaces for object shapes
- Use nullability (`| null`) for optional extracted metrics
- Exported from centralized `types/` directory

## Where to Add New Code

**New Feature (e.g., export to Excel):**
- Primary code: Create utility in `lib/export-handler.ts`
- Components: Add export button to `components/FinancialTable.tsx`
- Tests: Create `lib/export-handler.test.ts` (if testing implemented)

**New Display Component (e.g., new chart):**
- Implementation: `components/NewChartName.tsx` (PascalCase)
- Integration: Import into `app/(dashboard)/(routes)/upload/page.tsx`
- Styling: Use Tailwind CSS and shadcn/ui components
- Props: Define `interface NewChartNameProps` at top of file

**New Calculation Type (e.g., leverage ratio):**
- Implementation: `lib/calculations/leverage-calculator.ts`
- Export: Add to `lib/calculations/index.ts`
- Types: Add fields to `ComputedMetrics` in `types/financial.ts`
- Integration: Call in `aiProcessor.ts` during `computeMetrics()` phase

**New Metric Field (e.g., cash_position):**
- Types: Add to `ExtractedMetrics` interface in `types/financial.ts`
- Extraction Prompt: Update `FINANCIAL_EXTRACTION_PROMPT` in `lib/prompts/extraction-prompt.ts`
- Merging: Update merge logic in `lib/extraction-merger.ts` if nested object
- Calculation: Add to `ComputedMetrics` if derived metric

**Utilities/Helpers:**
- Shared helpers: `lib/utils.ts`
- Domain-specific: Create `lib/{domain}-utils.ts`

## Special Directories

**`app/`**
- Purpose: Next.js App Router
- Generated: No (source code)
- Committed: Yes
- Special: Follows Next.js conventions for pages, layouts, API routes

**`lib/calculations/`**
- Purpose: Isolated financial calculation logic
- Generated: No
- Committed: Yes
- Special: Each calculator is self-contained with internal helper functions

**`types/`**
- Purpose: Single source of truth for TypeScript types
- Generated: No
- Committed: Yes
- Special: Import all types from `types/` not from individual modules

**`uploads/`**
- Purpose: Temporary file storage during processing
- Generated: Yes (created by formidable at POST time)
- Committed: No (add to .gitignore)
- Cleanup: Files should be deleted after API response, currently may accumulate

**`.planning/codebase/`**
- Purpose: Architecture documentation for future phases
- Generated: No
- Committed: Yes
- Notes: Consumed by `/gsd:plan-phase` and `/gsd:execute-phase` commands

---

*Structure analysis: 2026-02-05*
