# Lendflow

## What This Is

Lendflow is a Next.js application that uses AI to extract financial metrics from uploaded documents (PDF, Excel, Word) and perform credit risk assessment for bank loan underwriting. It computes key ratios — Adjusted EBITDA, Senior Debt/EBITDA, Total Debt/Total Capital, FCCR, DSCR — and generates AI-powered risk assessments with lending recommendations.

## Core Value

Accurate, consistent AI extraction of financial data from documents — specifically Adjusted EBITDA and downstream ratios — matching the quality of a human financial analyst.

## Requirements

### Validated

- ✓ Document upload (PDF, Excel, Word) via multipart form — existing
- ✓ PDF text extraction with pdf-parse and pdf2json fallback — existing
- ✓ Text chunking (4000 char segments) with SHA256 deduplication — existing
- ✓ Sequential OpenAI GPT-4 Turbo extraction with retry logic — existing
- ✓ Extraction merging across chunks (first non-null wins) — existing
- ✓ EBITDA and Adjusted EBITDA computation with component breakdowns — existing
- ✓ FCCR calculation with configurable CapEx treatment — existing
- ✓ DSCR, Senior Debt/EBITDA, Total Debt/Total Capital ratio computation — existing
- ✓ AI-powered risk assessment (7 pillars) with caching — existing
- ✓ Debt health assessment with weighted scoring and lending recommendation — existing
- ✓ Multi-tab UI: Upload, Extracted Data, Financial Analysis, Credit-Risk Snapshot — existing

### Active

- [ ] Diagnose extraction pipeline to identify where errors originate (PDF parsing vs AI interpretation)
- [ ] Overhaul PDF table extraction for reliable structured data capture
- [ ] Improve AI extraction accuracy to ~95%+ matching human analyst review
- [ ] Prioritize Adjusted EBITDA accuracy as the foundation metric
- [ ] Add schema validation for AI extraction output (reject malformed responses)
- [ ] Replace first-wins merge strategy with accuracy-focused approach (consensus or confidence-weighted)
- [ ] Reduce token consumption for large documents
- [ ] Add automated validation against known test documents (reference benchmarks)
- [ ] Evaluate alternative AI models/providers for better accuracy-to-cost ratio
- [ ] Add unit tests for financial calculators (EBITDA, FCCR, DSCR) with known reference values

### Out of Scope

- Authentication/user management — not the current bottleneck, accuracy is
- Persistent database storage — needed eventually but not until extraction is reliable
- New UI features or redesign — current UI is functional
- Mobile app — web-first
- Export to PDF/Excel — downstream of accurate extraction
- Batch processing — single document accuracy must be solved first
- Speed optimization beyond what accuracy improvements provide — current speed is acceptable
- Scenario/sensitivity analysis — add-on after core extraction is reliable

## Context

- Existing Next.js 15 codebase with 8-phase extraction pipeline (parse → chunk → dedup → extract → merge → compute → validate → risk assess)
- Current AI model: OpenAI GPT-4 Turbo via openai SDK 4.89.0
- PDF parsing: pdf-parse 1.1.1 (primary) with pdf2json 3.1.6 (fallback) — neither handles tables well
- Extraction results are inconsistent: sometimes correct, sometimes wildly wrong, no predictable pattern
- Wrong numbers are the primary issue (not missing fields or misclassification)
- PDFs with financial tables are the most problematic document type
- Errors caught by manual comparison against source documents — no automated validation
- Root cause not yet diagnosed: could be PDF text extraction garbling table structure, AI misinterpreting garbled text, or both
- "First non-null wins" merge strategy means if the first chunk extracts a wrong number, it propagates
- No test coverage on any calculation or extraction logic
- Token volume is the primary cost concern — large documents generate many chunks
- Currently low volume (~1-10 docs/day) but needs to scale
- Test PDFs available in `public/financialReports/` for benchmarking

## Constraints

- **Tech Stack**: Next.js 15 / React 19 / TypeScript — existing codebase, not rewriting
- **AI Provider**: Open to any model or provider — whatever delivers accuracy
- **PDF Pipeline**: Open to full overhaul — table extraction must work reliably
- **Accuracy Target**: ~95%+ match with human analyst extraction, especially Adjusted EBITDA
- **Cost**: Token reduction is a goal, not a hard constraint — accuracy comes first
- **Scalability**: Design for future growth but don't over-engineer for current low volume

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Open to any AI model/provider | Accuracy is the priority, not vendor loyalty | — Pending |
| Open to full PDF pipeline overhaul | Current pdf-parse can't reliably extract tables | — Pending |
| Accuracy over speed | Current speed is acceptable; extraction reliability is the bottleneck | — Pending |
| Adjusted EBITDA as priority metric | Foundation for all downstream ratios — if EBITDA is wrong, everything is wrong | — Pending |

---
*Last updated: 2026-02-05 after initialization*
