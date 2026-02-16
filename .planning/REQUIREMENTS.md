# Requirements: Lendflow

**Defined:** 2026-02-15
**Core Value:** Accurate, consistent AI extraction of financial data — specifically Adjusted EBITDA and downstream ratios

## v1.0 Requirements — Vision Extraction PoC

Requirements for proving Claude Vision extracts financial data more accurately than text-based extraction.

### Infrastructure

- [ ] **INFRA-01**: PDF-to-image conversion pipeline (300 DPI minimum quality)
- [ ] **INFRA-02**: Claude 3.7 Sonnet Vision API integration via Anthropic SDK
- [ ] **INFRA-03**: Structured output via tool calling (same JSON schema as current extraction)

### Extraction

- [ ] **EXTR-01**: Process PDF pages as images through Claude Vision
- [ ] **EXTR-02**: Extract same financial metrics schema as current text extraction
- [ ] **EXTR-03**: Handle multi-page documents (process page-by-page, merge results)

### Validation

- [ ] **VAL-01**: Side-by-side comparison UI showing text vs vision extraction results
- [ ] **VAL-02**: Benchmark against test documents with known correct values (Zedcor, Taiga)
- [ ] **VAL-03**: Accuracy metrics calculation (% match on EBITDA, revenue, debt components)

### Cost Tracking

- [ ] **COST-01**: Token usage logging per extraction (input/output tokens)
- [ ] **COST-02**: Cost comparison report (vision cost vs current text cost per document)

## Future Requirements

Deferred until PoC validates vision approach.

### Full Migration (v1.1)
- **MIG-01**: Replace text extraction with vision as primary pipeline
- **MIG-02**: GPT-4o Vision as fallback if Claude fails
- **MIG-03**: Remove pdf-parse/pdf2json dependencies
- **MIG-04**: Production cost monitoring and alerting

### Optimization (v1.2)
- **OPT-01**: Result caching for repeated extractions
- **OPT-02**: Per-field confidence scoring
- **OPT-03**: Document type classification (10-K, annual report, etc.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full production migration | PoC first — validate before committing |
| Multi-model fallback chains | Defer to v1.1 if PoC succeeds |
| Fine-tuning or custom models | Overkill for current volume |
| Real-time processing optimizations | Speed is acceptable; accuracy is the goal |
| UI redesign | Current UI is functional for comparison |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| EXTR-01 | Phase 2 | Pending |
| EXTR-02 | Phase 2 | Pending |
| EXTR-03 | Phase 2 | Pending |
| VAL-01 | Phase 3 | Pending |
| VAL-02 | Phase 3 | Pending |
| VAL-03 | Phase 3 | Pending |
| COST-01 | Phase 3 | Pending |
| COST-02 | Phase 3 | Pending |

**Coverage:**
- v1.0 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after initial definition*
