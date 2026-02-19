# Lendflow

## What This Is

Lendflow is a Next.js application that uses AI to extract financial metrics from uploaded documents (PDF, Excel, Word) and perform credit risk assessment for bank loan underwriting. It computes key ratios — Adjusted EBITDA, Senior Debt/EBITDA, Total Debt/Total Capital, FCCR, DSCR — and generates AI-powered risk assessments with lending recommendations.

## Core Value

Accurate, consistent AI extraction of financial data from documents — specifically Adjusted EBITDA and downstream ratios — matching the quality of a human financial analyst.

## Current Milestone: v1.0 Vision Extraction PoC

**Goal:** Validate that Claude 3.7 Sonnet Vision can extract financial data from PDFs with >90% accuracy, significantly better than current text-based GPT-4 Turbo approach.

**Target features:**
- PDF-to-image conversion pipeline
- Claude 3.7 Sonnet Vision API integration
- Side-by-side accuracy comparison vs current text extraction
- Benchmark against test documents with known correct values

## Requirements

### Validated

- ✓ Document upload (PDF, Excel, Word) via multipart form — existing
- ✓ PDF text extraction with pdf-parse and pdf2json fallback — existing
- ✓ Text chunking with semantic boundaries and deduplication — existing
- ✓ Sequential OpenAI GPT-4 Turbo extraction with retry logic — existing
- ✓ Conflict-aware extraction merging across chunks — existing
- ✓ EBITDA and Adjusted EBITDA computation with component breakdowns — existing
- ✓ FCCR calculation with configurable CapEx treatment — existing
- ✓ DSCR, Senior Debt/EBITDA, Total Debt/Total Capital ratio computation — existing
- ✓ AI-powered risk assessment (7 pillars) with caching — existing
- ✓ Debt health assessment with weighted scoring and lending recommendation — existing
- ✓ Multi-tab UI: Upload, Extracted Data, Financial Analysis, Credit-Risk Snapshot — existing
- ✓ Zod schema validation for AI extraction responses — existing
- ✓ Negative interest value rejection with fallback — existing (2026-02-15)

### Active

- [ ] PDF-to-image conversion for vision model input
- [ ] Claude 3.7 Sonnet Vision API integration
- [ ] Benchmark framework with ground truth comparison
- [ ] Side-by-side extraction comparison (text vs vision)
- [ ] Document success metrics: >90% EBITDA accuracy, <2x current cost

### Out of Scope

- Authentication/user management — not the current bottleneck, accuracy is
- Persistent database storage — needed eventually but not until extraction is reliable
- New UI features or redesign — current UI is functional
- Mobile app — web-first
- Export to PDF/Excel — downstream of accurate extraction
- Batch processing — single document accuracy must be solved first
- Full production migration to vision — this milestone is PoC only
- Multi-model fallback chains — defer to future milestone if PoC succeeds

## Context

- Existing Next.js 15 codebase with 8-phase extraction pipeline (parse → chunk → dedup → extract → merge → compute → validate → risk assess)
- Current AI model: OpenAI GPT-4 Turbo via openai SDK 4.89.0
- PDF parsing: pdf-parse 1.1.1 (primary) with pdf2json 3.1.6 (fallback) — neither handles tables well
- **Root cause identified:** Text extraction destroys table structure. Financial tables encode meaning through spatial relationships (rows × columns) that become garbled in linear text.
- **Research conclusion:** Vision-based extraction is fundamentally superior for tables. Claude 3.7 Sonnet Vision recommended as primary, GPT-4o Vision as fallback option.
- Test PDFs available in `public/financialReports/` — includes Zedcor, Taiga with known reference values
- Recent fixes (2026-02-15): Negative interest rejection, larger chunk sizes (25k chars)

## Constraints

- **Tech Stack**: Next.js 15 / React 19 / TypeScript — existing codebase, not rewriting
- **AI Provider**: Testing Claude 3.7 Sonnet Vision for this milestone
- **PoC Scope**: Prove the approach works before committing to full migration
- **Accuracy Target**: >90% accuracy on EBITDA components in PoC
- **Cost Target**: <2x current cost per document
- **Time**: Quick validation — if PoC fails, pivot early

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vision over text extraction | Tables are visual; text extraction destroys structure | — Pending (validating in PoC) |
| Claude 3.7 Sonnet Vision first | Best-in-class table understanding, 200K context, competitive pricing | — Pending |
| PoC before full migration | Validate hypothesis before committing engineering effort | — Pending |
| Adjusted EBITDA as priority metric | Foundation for all downstream ratios — if EBITDA is wrong, everything is wrong | ✓ Good |

---
*Last updated: 2026-02-15 after milestone v1.0 initialization*
