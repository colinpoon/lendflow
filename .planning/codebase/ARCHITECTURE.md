# Architecture

**Analysis Date:** 2026-02-05

## Pattern Overview

**Overall:** Multi-stage AI extraction pipeline with explicit separation between document parsing, AI processing, financial calculations, and risk assessment generation.

**Key Characteristics:**
- Sequential, deterministic processing (chunks processed in order for consistency)
- Layered computation (parsing → chunking → AI extraction → merging → calculation → risk assessment)
- Type-driven financial calculations (strict TypeScript interfaces for all metrics)
- Cache-enabled risk assessment (hash-based caching to avoid redundant AI calls)
- Client-server separation (Next.js App Router with API route for extraction)

## Layers

**Presentation Layer:**
- Purpose: User interface for document upload and financial analysis visualization
- Location: `app/(dashboard)/(routes)/upload/page.tsx`, `components/`
- Contains: React components, tabs, charts, tables, progress indicators
- Depends on: API endpoints, UI utilities (shadcn/ui), calculations for display
- Used by: End users via Next.js frontend

**API/Orchestration Layer:**
- Purpose: HTTP endpoint orchestrating the entire extraction pipeline
- Location: `app/api/extractData/route.ts`
- Contains: Form parsing (formidable), file handling, response marshaling
- Depends on: `aiProcessor.ts` for extraction pipeline
- Used by: Frontend FileUpload component

**AI Extraction Pipeline:**
- Purpose: Coordinates document parsing, chunking, deduplication, and sequential OpenAI calls
- Location: `utils/aiProcessor.ts`
- Contains: Main orchestrator with 8 phases (parsing → chunking → dedup → extraction → merging → computation → validation → risk assessment)
- Depends on: Document parser, chunk processor, extraction merger, calculators, risk generator
- Used by: API route

**Document Parsing Layer:**
- Purpose: Extract text from PDF and plain text files
- Location: `lib/document-parser.ts`
- Contains: PDF parsing (pdf-parse with pdf2json fallback), text file reading
- Depends on: pdf-parse, pdf2json, Node.js fs
- Used by: AI extraction pipeline

**Chunking & Processing Layer:**
- Purpose: Split text into manageable chunks, deduplicate, and send to OpenAI
- Location: `lib/chunk-processor.ts`
- Contains: Text chunking (4000 char default), SHA256 deduplication, sequential OpenAI calls with retry logic
- Depends on: OpenAI API, constants for configuration
- Used by: AI extraction pipeline

**Extraction & Merging Layer:**
- Purpose: Consolidate partial extractions from multiple chunks using "first non-null wins" strategy
- Location: `lib/extraction-merger.ts`
- Contains: Recursive merging logic for nested objects (debt_components, adjusted_ebitda_components, fixed_charges)
- Depends on: Chunk processor results
- Used by: AI extraction pipeline

**Calculation Layer:**
- Purpose: Compute derived financial metrics and ratios from extracted values
- Location: `lib/calculations/`
- Contains: EBITDA calculation, adjusted EBITDA calculation, debt metrics, FCCR, DSCR, debt-to-equity, interest coverage
- Depends on: Extracted metrics (ExtractedMetrics type)
- Used by: AI processor for post-extraction computation

**Risk Assessment Layer:**
- Purpose: Generate AI-powered risk assessments and debt health evaluations using cached results
- Location: `lib/risk-generator.ts`
- Contains: Risk assessment prompts, debt health assessment, scoring functions, caching logic
- Depends on: OpenAI API, risk-scoring utilities, computed metrics
- Used by: AI extraction pipeline

**Type System:**
- Purpose: Centralized financial metric definitions
- Location: `types/`
- Contains: ExtractedMetrics, ComputedMetrics, DebtComponents, FixedCharges, AdjustedEBITDAComponents, RiskData
- Used by: All layers

## Data Flow

**File Upload → Analysis:**

1. User uploads file (PDF/Excel/Word) via `FileUpload.tsx`
2. File is optionally compressed (pdf-lib) to reduce size
3. FormData sent to `/api/extractData` POST endpoint
4. API receives file, parses with formidable, resolves file path
5. `extractFinancialData()` orchestrates 8-phase pipeline:
   - **Phase 1**: Parse document → extract text from PDF or read text file
   - **Phase 2**: Chunk text into ~4000 char segments
   - **Phase 3**: Deduplicate chunks by SHA256 hash
   - **Phase 4**: Process unique chunks sequentially through OpenAI GPT-4 Turbo (deterministic order)
   - **Phase 5**: Merge all chunk results using "first non-null wins" strategy
   - **Phase 6**: Compute derived metrics (EBITDA, adjusted EBITDA, FCCR, DSCR, ratios)
   - **Phase 7**: Validate computed metrics for anomalies
   - **Phase 8**: Generate risk assessment (AI-powered, cached by metrics hash)
6. API returns `ExtractionResult` with `metrics_by_year`, `riskAssessment`, `debtHealthAssessment`
7. Frontend receives data, displays in tabs: Extracted Data, Financial Analysis, Credit-Risk Snapshot

**State Management:**

- **Frontend State**: React useState hooks in `upload/page.tsx` for `extractedData`, `financialData`, `riskData`, `debtHealthAssessment`
- **Backend State**: Temporary file storage in `/uploads/` (created by formidable), cache in OS temp dir for risk assessments
- **No Persistent Storage**: Currently no database layer; all processing is stateless per request

## Key Abstractions

**ExtractedMetrics:**
- Purpose: Represents raw financial data extracted from document by AI
- Examples: `types/financial.ts` defines fields like `revenue`, `net_income`, `interest`, `depreciation_amortization`, `ebitda`, `shareholders_equity`, `total_debt`, `senior_debt`, debt components, fixed charges, adjusted EBITDA components
- Pattern: Nullable fields (use `| null`) to handle incomplete extractions

**ComputedMetrics:**
- Purpose: Extends ExtractedMetrics with calculated derived values (ratios, debt metrics, EBITDA variants)
- Examples: `senior_debt_to_ebitda`, `total_debt_to_capital`, `dscr`, `fccr`, `interest_coverage_ratio`, `debt_to_equity_ratio`
- Pattern: Contains breakdown objects for transparency (e.g., `fccr_breakdown`, `adjusted_ebitda_breakdown`)

**RiskData:**
- Purpose: AI-generated risk assessment with 7 pillars
- Pattern: Structured JSON with risk scores, recommendations, lending decision

**DebtHealthAssessment:**
- Purpose: High-level debt risk evaluation with weighted score and lending recommendation
- Pattern: Contains `weighted_score`, `risk_band`, `lending_decision`, key risk factors, recommendations

## Entry Points

**Frontend Entry:**
- Location: `app/(dashboard)/(routes)/upload/page.tsx` (main page)
- Triggers: Page load, file upload
- Responsibilities: Display UI tabs, manage extraction state, display results

**API Entry:**
- Location: `app/api/extractData/route.ts`
- Triggers: POST request from FileUpload component
- Responsibilities: Parse form data, invoke extraction pipeline, return JSON response

**Extraction Pipeline Entry:**
- Location: `utils/aiProcessor.ts` - `extractFinancialData(filePath: string)`
- Triggers: API route
- Responsibilities: Orchestrate all 8 phases, return ExtractionResult

## Error Handling

**Strategy:** Try-catch with specific error messages, logging at each phase

**Patterns:**
- Document parsing: File existence checks, fallback to pdf2json if pdf-parse fails
- OpenAI API: Retry logic on 429 (rate limit), immediate fail on other errors
- Calculation: Null checks before arithmetic to prevent NaN propagation
- Validation: Collect issues in `validation_issues` map without stopping processing

**Example Error Flow:**
```typescript
try {
  const fileContent = await parseDocument(filePath);
  // If parsing fails, throw Error with context
} catch (error) {
  console.error('❗ AI processing failed:', error?.message || error);
  throw new Error('AI processing failed: ' + (error?.message || 'Unknown error'));
}
```

## Cross-Cutting Concerns

**Logging:** Console.log with emoji prefixes for visual scanning (📂 file ops, 🤖 AI ops, ✅ success, ❗ error)

**Validation:**
- Post-extraction: Check for expenses > revenue, non-finite ratios
- Pre-calculation: Null checks on divisors to prevent NaN
- Post-calculation: Verify DSCR, FCCR bounds, sanity-check debt components

**Authentication:** Not implemented (no auth layer currently)

**API Key Management:** OpenAI key via `process.env.OPENAI_API_KEY` (required, validated at start of extraction)

**Caching:**
- Risk assessments cached by metrics hash (SHA256) in OS temp directory
- Prevents redundant OpenAI calls for identical metrics

---

*Architecture analysis: 2026-02-05*
