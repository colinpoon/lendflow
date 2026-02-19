# Roadmap: Lendflow v1.0 Vision Extraction PoC

**Created:** 2026-02-15
**Milestone:** v1.0 — Validate Claude Vision extracts financial data with >90% accuracy

## Overview

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Infrastructure Setup | Set up PDF-to-image and Claude Vision API | INFRA-01, INFRA-02, INFRA-03 |
| 2 | Vision Extraction Pipeline | Build extraction using Claude Vision | EXTR-01, EXTR-02, EXTR-03 |
| 3 | Validation & Benchmarking | Prove vision > text with measurable results | VAL-01, VAL-02, VAL-03, COST-01, COST-02 |

**Total:** 3 phases | 11 requirements | 100% coverage

---

## Phase 1: Infrastructure Setup ✓

**Status:** Complete (2026-02-17)

**Goal:** Set up the foundational infrastructure for vision-based extraction — PDF-to-image conversion and Claude API integration.

**Requirements:**
- ✓ INFRA-01: PDF-to-image conversion pipeline (300 DPI minimum quality)
- ✓ INFRA-02: Claude 3.7 Sonnet Vision API integration via Anthropic SDK
- ✓ INFRA-03: Structured output via tool calling (same JSON schema as current extraction)

**Success Criteria:**
1. ✓ Can convert any PDF page to a high-quality PNG image (300 DPI)
2. ✓ Can send an image to Claude Vision API and receive a response
3. ✓ Claude returns structured JSON matching the existing extraction schema
4. ✓ API key and SDK are properly configured in environment

**Dependencies:** None (first phase)

**Plans:** 3 plans (all complete)

Plans:
- [x] 01-01-PLAN.md — PDF-to-image converter with pdf-to-img
- [x] 01-02-PLAN.md — Claude Vision client with tool calling
- [x] 01-03-PLAN.md — Integration test and end-to-end verification

**Key Decisions:**
- pdf-to-img v4.5.0 (Node 18 compatible)
- Scale factor 4.17 for 300 DPI equivalent
- claude-sonnet-4-20250514 model ID

---

## Phase 2: Vision Extraction Pipeline ✓

**Status:** Complete (2026-02-17)

**Goal:** Build a complete extraction pipeline that processes PDFs through Claude Vision and returns the same metrics structure as the current text-based system.

**Requirements:**
- ✓ EXTR-01: Process PDF pages as images through Claude Vision
- ✓ EXTR-02: Extract same financial metrics schema as current text extraction
- ✓ EXTR-03: Handle multi-page documents (process page-by-page, merge results)

**Success Criteria:**
1. ✓ Can upload a PDF and get extracted metrics via vision pipeline
2. ✓ Output schema matches current `ExtractedMetrics` type exactly
3. ✓ Multi-page PDFs are processed page-by-page and results are merged
4. ✓ Pipeline handles errors gracefully (API failures, malformed responses)

**Dependencies:** Phase 1 (infrastructure must be working)

**Plans:** 2 plans (all complete)

Plans:
- [x] 02-01-PLAN.md — Vision processor: extractVisionData() with computed ratios and risk assessments
- [x] 02-02-PLAN.md — Vision API route: SSE endpoint at /api/extractData/vision

**Key Decisions:**
- Page-by-page Buffer processing (avoid loading all pages into memory simultaneously)
- Fiscal year key normalization before computeMetrics (strips FY prefix, date suffixes)
- Separate API endpoint (do not modify existing /api/extractData route)
- lib/calculations.ts functions called directly (computeMetrics is private in aiProcessor)

**Known Issues (to address in Phase 3):**
- Vision extraction shows accuracy gaps vs text extraction on some documents
- Shareholders' equity extraction inconsistent
- Debt component breakdown less detailed than text extraction
- Single-year extraction where text found multiple years

---

## Phase 3: Validation & Benchmarking

**Goal:** Prove that vision extraction is significantly more accurate than text extraction with measurable, reproducible results.

**Requirements:**
- VAL-01: Side-by-side comparison UI showing text vs vision extraction results
- VAL-02: Benchmark against test documents with known correct values (Zedcor, Taiga)
- VAL-03: Accuracy metrics calculation (% match on EBITDA, revenue, debt components)
- COST-01: Token usage logging per extraction (input/output tokens)
- COST-02: Cost comparison report (vision cost vs current text cost per document)

**Success Criteria:**
1. UI shows text extraction results next to vision extraction results
2. Differences between methods are highlighted
3. Accuracy report shows % match against ground truth for key metrics
4. Vision achieves >90% accuracy on EBITDA components (vs ~70-80% current)
5. Cost per document is logged and reported (<2x current cost target)
6. Clear recommendation: proceed to full migration or pivot

**Dependencies:** Phase 2 (need working extraction to validate)

**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Ground truth data and accuracy calculation utilities (VAL-02, VAL-03 foundation)
- [ ] 03-02-PLAN.md — Token usage threading through both pipelines (COST-01)
- [ ] 03-03-PLAN.md — Comparison API endpoint and UI (VAL-01, COST-02)

**Wave Structure:**
- Wave 1 (parallel): 03-01 + 03-02
- Wave 2: 03-03 (depends on Wave 1)

**Key Decisions:**
- Ground truth source: Manual verification from source PDFs (placeholder values until human review)
- Accuracy threshold: 10% variance = accurate
- Cost target: Vision < 2x text extraction cost

---

## Milestone Success Criteria

**PoC is successful if:**
- [ ] Vision extraction achieves >90% accuracy on EBITDA components
- [ ] Vision extraction achieves >90% accuracy on total debt / senior debt
- [ ] Cost is <2x current text extraction cost per document
- [ ] Processing time is acceptable (<60 seconds for 20-page PDF)
- [ ] Results are reproducible (same PDF → same extraction)

**If successful:** Proceed to v1.1 Full Migration
**If not successful:** Analyze failure modes, consider GPT-4o Vision or Azure Document Intelligence

---

## Phase Ordering Rationale

```
Phase 1 (Infrastructure) → Phase 2 (Extraction) → Phase 3 (Validation)
```

**Why this order:**
1. **Infrastructure first** — Can't build extraction without API access and image conversion
2. **Extraction before validation** — Need working extraction to have something to validate
3. **Validation last** — Measures success of the whole PoC

**No parallelization** — Each phase depends on the previous. Sequential execution is required.

---
*Roadmap created: 2026-02-15*
*Last updated: 2026-02-17 — Phase 3 plans created*
