# Financial Document AI Extraction Pitfalls

**Domain:** AI-powered financial statement extraction and credit risk analysis
**Research Date:** 2026-02-05
**Confidence Level:** HIGH (based on codebase analysis + domain knowledge)

## Executive Summary

Improving AI financial extraction accuracy from 70% to 95%+ is a **fundamentally different problem** than getting to 70%. Teams commonly fail because they treat it as "do more of the same" rather than recognizing it requires systemic architectural changes.

**Critical insight:** The final 25% of accuracy improvement requires 80% of the effort. Why? Because:
- The remaining errors are **systematic**, not random (e.g., parentheses convention, table boundary detection)
- LLM temperature=0 doesn't eliminate variance — you need architectural determinism
- Without ground truth datasets, you're flying blind
- Validation logic is harder to write than extraction logic

---

## Critical Pitfalls

These mistakes cause rewrites, missed deadlines, or fundamentally broken systems.

### Pitfall 1: No Ground Truth Dataset = No Measurable Progress

**What goes wrong:**
Teams claim "accuracy is improving" based on vibes, manual spot checks, or comparing one run to another. Without a ground truth dataset of known-correct extractions, you cannot:
- Measure actual accuracy (you're guessing)
- Detect regressions when you make changes
- Know when you've hit 95% (or if you're at 72% or 88%)
- Compare different approaches objectively

**Why it happens:**
Creating ground truth is tedious. Manually extracting 20-50 financial statements and validating every field takes 40-100 hours. Teams skip it hoping "the LLM will just work."

**Consequences:**
- You deploy changes that reduce accuracy without knowing
- Optimization is random walk, not directed improvement
- No way to prove accuracy to stakeholders/regulators
- End up with "it works on the CEO's demo PDF" syndrome

**Current system exposure:**
CRITICAL. Codebase has no test coverage (`Glob **/*test*.ts` returned only node_modules). No benchmark PDFs with validated extractions. No accuracy measurement infrastructure.

**Prevention:**
1. **Build ground truth FIRST** (before any extraction work):
   - Select 20-30 representative financial statements covering:
     - Multiple industries (manufacturing, services, tech)
     - Multiple accounting standards (US GAAP, IFRS)
     - Multiple formats (10-K, audited statements, MD&A)
     - Edge cases (negative equity, zero revenue startups, loss-making companies)
   - Manually extract ALL metrics into JSON (expect 60-80 hours)
   - Have second person validate (catch 15-20% errors in manual extraction)
   - Store as `/test-data/ground-truth/{company-name}.json`

2. **Create accuracy measurement harness**:
   ```typescript
   interface AccuracyReport {
     overall_accuracy: number; // % of fields correct
     field_accuracy: Record<string, number>; // per-field accuracy
     critical_field_accuracy: number; // EBITDA, debt, equity only
     false_positives: number; // extracted wrong value
     false_negatives: number; // missed value that exists
   }
   ```

3. **Run benchmark on EVERY code change**:
   - Fail CI if critical field accuracy drops below threshold
   - Track accuracy trend over time
   - Identify which PDFs regress

**Detection:**
- Ask: "What's your current accuracy?" If answer is vague ("pretty good", "90%ish"), no ground truth exists
- Ask: "Show me your test suite." If no integration tests with real PDFs, problem exists
- Check for `/test-data/` or `/benchmarks/` directory with validated extractions

**Phase mapping:**
- Phase 1 (Foundation): Build ground truth dataset (MUST be first, blocks everything else)
- Phase 2+: Run benchmarks as regression tests

---

### Pitfall 2: Treating LLM as "Smart Parser" Instead of "Fuzzy Guesser"

**What goes wrong:**
Teams assume GPT-4's high intelligence means it will reliably extract exact values from tables. In reality:
- **Table structure is ambiguous**: Is "1,234" on line 47 the current liability or long-term debt? LLM guesses based on surrounding text.
- **Column alignment fails**: PDFs don't preserve table structure. Text extraction gives you "Revenue 50,000 45,000" — which year is which?
- **Parentheses convention varies**: (1,234) means negative in US GAAP, but sometimes means footnote reference.
- **LLMs hallucinate**: When uncertain, GPT-4 will return a plausible-sounding number that's completely wrong.

**Why it happens:**
LLMs are impressive at understanding context and language. This creates false confidence that they'll be equally good at precise numeric extraction. They're not. Numeric precision requires structured parsing, not language understanding.

**Consequences:**
- **Sign errors**: Extracting "(5,000)" as 5000 instead of -5000 (Critical for financial metrics)
- **Wrong column**: Extracting 2023 revenue as 2024 revenue (Off-by-one year errors)
- **Table boundary errors**: Extracting "Total Liabilities" as "Long-term Debt" (Semantic confusion)
- **Unit errors**: Extracting "Revenue: 50" when document says "in thousands" (50,000 vs 50)
- Accuracy plateaus at 75-85% no matter how much prompt engineering you do

**Current system exposure:**
HIGH. Code relies entirely on LLM for extraction:
- Prompt says "Be flexible in identifying synonyms" (increases hallucination risk)
- No structural parsing of tables before LLM
- No post-extraction validation of relationships (e.g., Assets = Liabilities + Equity)
- "First non-null wins" merge propagates first error encountered

**Prevention:**
1. **Separate structural parsing from semantic extraction**:
   ```
   Step 1: Use table extraction library (tabula, camelot, pdfplumber) to get structured table data
   Step 2: Use LLM to classify which table is Balance Sheet vs Income Statement vs Cash Flow
   Step 3: Use LLM to map column headers to years
   Step 4: Use deterministic logic to extract values from structured table
   Step 5: Use LLM only for ambiguous cases (e.g., identifying which debt is senior vs subordinated)
   ```

2. **Implement cross-validation checks**:
   - Balance sheet equation: Assets = Liabilities + Equity (tolerance ±1%)
   - EBITDA reconciliation: Net Income + I + T + D&A = EBITDA (tolerance ±2%)
   - Cash flow equation: Beginning Cash + Operating + Investing + Financing = Ending Cash
   - If validation fails, flag for human review instead of returning wrong data

3. **Use structured output mode** (GPT-4 Turbo JSON mode):
   - Current code uses freeform text → manual JSON parsing
   - Switch to OpenAI's structured output mode to enforce schema
   - Reduces JSON parsing errors and forces LLM to return null instead of hallucinating

4. **Extract confidence scores**:
   - For each extracted value, ask LLM: "How confident are you this is correct? (high/medium/low)"
   - Flag low-confidence extractions for human validation
   - Track which fields have consistently low confidence (indicates prompt/process issue)

**Detection:**
- Review extraction logs for values that violate domain constraints:
  - Negative revenue (unless explicitly reported as reversal)
  - EBITDA > Revenue (impossible unless extreme non-operating income)
  - Shareholders' Equity = 0 but company is operating
- Compare extracted values to prior year — if variance > 50%, likely extraction error
- Check for systematic errors (e.g., ALL parenthetical values extracted as positive)

**Phase mapping:**
- Phase 2: Add structural table parsing (before LLM)
- Phase 3: Implement cross-validation rules
- Phase 4: Add confidence scoring

---

### Pitfall 3: "First Non-Null Wins" Merge Strategy Propagates Errors

**What goes wrong:**
Current code uses "first non-null wins" merge when combining extractions from multiple chunks:

```typescript
// extraction-merger.ts line 61
} else if (merged[yr][key] == null && metrics[key] != null) {
  // Only overwrite if current value is null and new value exists
  merged[yr][key] = metrics[key];
}
```

This means:
- If chunk 1 extracts `revenue: 5000` (WRONG)
- And chunk 5 extracts `revenue: 50000` (CORRECT)
- The merge keeps 5000 (because it was first)

**Why it happens:**
Deterministic merging is easier to debug than voting/averaging. "First non-null wins" is simple and fast. Teams choose it without realizing it bakes in error propagation.

**Consequences:**
- Early chunks (often document headers/summaries with less detail) win over later chunks (detailed financial tables)
- Extraction order becomes critical — reordering chunks changes results
- Cannot fix errors by improving later extraction — first wrong value "locks in"
- Accuracy ceiling of ~70-80% because you can't recover from first-chunk errors

**Current system exposure:**
CRITICAL. Code explicitly uses this strategy (extraction-merger.ts). Sequential processing guarantees deterministic errors, not correct errors.

**Prevention:**
1. **Implement voting/consensus merge**:
   - If multiple chunks extract same field, compare values
   - If values agree within tolerance (±2%), keep value
   - If values conflict, flag for resolution:
     ```typescript
     interface ConflictResolution {
       field: string;
       year: string;
       values: Array<{ chunk: number; value: number; context: string }>;
       resolution: 'manual' | 'llm_arbitration' | 'most_specific';
     }
     ```

2. **Use LLM for conflict resolution**:
   - When values conflict, send both contexts to LLM:
     ```
     Chunk 3 extracted revenue: 5,000 from: "Revenue grew to 5,000 from prior year"
     Chunk 7 extracted revenue: 50,000 from: "Revenue | $50,000 | $45,000"

     Which extraction is correct? The table (chunk 7) or narrative (chunk 3)?
     ```
   - LLM is better at resolving conflicts than extracting fresh values

3. **Prioritize chunk types**:
   - Tables > Footnotes > Narrative text
   - Detailed breakdowns > Summary sections
   - Official statements > MD&A commentary
   - Implement chunk type classification before extraction

4. **Flag low-confidence merges**:
   - Single-source values (only one chunk extracted it) = medium confidence
   - Conflicting values = low confidence (requires human review)
   - Consensus values (3+ chunks agree) = high confidence

**Detection:**
- Check logs for "first chunk always wins" pattern
- Compare extraction results when document is chunked differently (different chunk size)
- If results change materially with different chunking, merge strategy is flawed

**Phase mapping:**
- Phase 2: Implement voting/consensus merge (replace first-wins)
- Phase 3: Add LLM conflict resolution
- Phase 4: Chunk type classification and prioritization

---

### Pitfall 4: Parentheses Convention Handling is Brittle

**What goes wrong:**
Financial statements use parentheses to indicate:
- **Negative values**: (5,000) = -5,000
- **Subtracted values**: "Less: Cost of sales (30,000)" = subtract 30,000
- **Context-dependent signs**: "Loss (gain) on sale (139)" = GAIN of 139 (parentheses negate the "loss")

Current code attempts to handle this in prompts:
```
Line 153: "Foreign exchange (gain) loss (2)" = GAIN of 2
Line 138: Numbers in parentheses like (139) = GAIN, extract as positive 139
```

But this is **prompt-based guidance**, not **deterministic logic**. LLMs will misinterpret in ~15-30% of cases.

**Why it happens:**
Teams discover parentheses errors in testing, add a prompt instruction, and assume it's fixed. But LLMs don't follow rules consistently — they interpret rules contextually, which introduces variance.

**Consequences:**
- **Sign flips**: Extracting losses as gains and vice versa
- **Adjusted EBITDA errors**: Adding back gains instead of subtracting them (inflates EBITDA by 2x the gain)
- **FCCR calculation errors**: Wrong sign on FX adjustments causes 10-20% error in final ratio
- Errors are **systematic across documents** but **inconsistent across runs** (non-deterministic)

**Current system exposure:**
HIGH. Prompt has extensive parentheses instructions (lines 113-156 in extraction-prompt.ts) but no code-level validation. EBITDA calculator has hardcoded logic for gains/losses but relies on LLM extracting correct signs.

**Prevention:**
1. **Pre-process numeric values before LLM**:
   - Use regex to find all `(number)` patterns in text
   - Convert to explicit negative values: `(5,000)` → `-5000`
   - Store sign metadata: `{ value: -5000, original_text: "(5,000)", context: "Loss on sale" }`
   - Send preprocessed text to LLM

2. **Post-process extracted values**:
   ```typescript
   function normalizeFinancialValue(
     value: number,
     label: string,
     context: string
   ): number {
     // Domain rules
     if (label.includes('gain') && value > 0) {
       // Gains should be subtracted from EBITDA
       return value; // positive = correct for subtraction
     }
     if (label.includes('loss') && value < 0) {
       // Losses extracted as negative should be positive (for addition to EBITDA)
       return Math.abs(value);
     }
     // Additional rules...
     return value;
   }
   ```

3. **Validate adjusted EBITDA components**:
   - **Gains must be positive** (for subtraction): `gain_on_disposal > 0`
   - **Losses must be positive** (for addition): `loss_on_disposal > 0`
   - **Non-cash expenses must be positive**: `stock_based_compensation > 0`
   - Fail extraction if signs are wrong (forces re-extraction with corrected prompt)

4. **Extract line item context**:
   - Don't just extract value — extract surrounding text
   - Store: `{ value: 139, label: "Loss (gain) on sale", line_number: 47, context: "..." }`
   - Use context for post-extraction validation

**Detection:**
- Check for negative values in fields that should always be positive:
  - `stock_based_compensation < 0` → ERROR (non-cash expense can't be negative)
  - `capital_expenditures < 0` → WARNING (rare, but proceeds from asset sales happen)
- Check adjusted EBITDA calculation:
  - If calculated < reported by >20%, likely sign error in adjustments
- Review extractions with "Loss (gain)" or "Gain (loss)" in labels — high error rate

**Phase mapping:**
- Phase 1: Add post-extraction sign validation (quick win)
- Phase 2: Implement pre-processing of parenthetical values
- Phase 3: Extract line item context for validation

---

### Pitfall 5: Optimizing Prompts Without Measuring Impact

**What goes wrong:**
Teams spend weeks iterating on prompts:
- Adding more examples
- Rewriting instructions
- Trying different phrasings
- Adjusting temperature/max_tokens

But without ground truth dataset + automated benchmarking, they can't tell if changes help or hurt. Symptoms:
- "This prompt feels better" (based on vibes)
- Optimizing for one PDF, breaking three others (overfitting)
- Prompt bloat (4000+ word prompts that confuse the LLM)
- Regression: New prompt version has lower accuracy than old version

**Why it happens:**
Prompt engineering feels productive. You can iterate quickly. Results "look better" on the PDF you're staring at. Without measurement, you're optimizing for local maxima.

**Consequences:**
- Wasted engineering time (weeks spent on 2% accuracy improvement)
- Prompt becomes unmaintainable (too complex to debug)
- Cannot tell which prompt changes actually worked
- Team argues about prompt wording instead of measuring results

**Current system exposure:**
MEDIUM. Prompt is very detailed (437 lines in extraction-prompt.ts) with many edge case instructions. No test suite to validate if instructions work. Likely has prompt cruft from debugging specific PDFs.

**Prevention:**
1. **Create prompt variant testing framework**:
   ```typescript
   interface PromptVariant {
     name: string;
     prompt: string;
     accuracy_on_ground_truth: number;
     avg_extraction_time: number;
     cost_per_document: number;
   }

   // Test each variant against ground truth
   async function evaluatePromptVariants(
     variants: PromptVariant[],
     groundTruth: GroundTruthDataset
   ): Promise<PromptVariant[]> {
     // Run each variant, measure accuracy, rank results
   }
   ```

2. **A/B test prompt changes**:
   - Keep old prompt as baseline
   - Deploy new prompt as experiment
   - Run both on benchmark suite
   - Only promote new prompt if accuracy improves by ≥2% AND no regressions

3. **Track per-field accuracy**:
   - Some prompt changes improve EBITDA extraction but break debt extraction
   - Measure accuracy per field, not just overall
   - Ensure critical fields (EBITDA, total_debt, shareholders_equity) have ≥95% accuracy

4. **Prompt archaeology — remove dead instructions**:
   - Every 2 weeks, remove one instruction from prompt
   - Re-run benchmark
   - If accuracy unchanged, instruction was useless (delete permanently)
   - Shorter prompts = faster, cheaper, more reliable

**Detection:**
- Prompt is >2000 tokens → likely has cruft
- Prompt has >10 examples → overfitting to specific cases
- Team debates prompt wording for >1 hour → missing measurement infrastructure
- Changes to prompt don't include "Benchmark accuracy before: X%, after: Y%"

**Phase mapping:**
- Phase 1: Build A/B testing framework (requires ground truth from Pitfall 1)
- Phase 2: Audit current prompt, remove dead instructions
- Phase 3: Implement automated prompt regression testing (CI/CD integration)

---

### Pitfall 6: Ignoring Table Extraction Libraries (Over-Reliance on LLM)

**What goes wrong:**
Teams send raw PDF text to LLM and expect it to parse tables correctly. But PDF text extraction loses table structure:
- Columns misalign
- Headers separate from values
- Multi-line cells break
- Nested tables flatten

LLMs try to reconstruct table structure from unstructured text, leading to:
- Wrong column alignment (2023 values labeled as 2024)
- Missed rows (LLM doesn't see them in text wall)
- Incorrect cell values (OCR errors in PDF → text)

**Why it happens:**
PDF table extraction libraries (Tabula, Camelot, pdfplumber) have learning curves. Teams choose "just use GPT-4" because it's easier upfront. They don't realize they're creating a harder problem downstream.

**Consequences:**
- Accuracy ceiling of 70-80% (can't exceed quality of input text)
- Cannot reliably extract multi-column tables (3+ years of data)
- Frequent off-by-one errors (wrong year)
- Must chunk documents, which fragments tables across chunks

**Current system exposure:**
MEDIUM-HIGH. Code uses `parseDocument()` (lib/document-parser.ts, not shown but likely uses pdf-parse or similar basic text extractor). No evidence of table-specific parsing. Chunking at 12,000 chars will split large tables.

**Prevention:**
1. **Use specialized table extraction BEFORE LLM**:
   - **Camelot** (for PDFs with clear table borders)
   - **pdfplumber** (for borderless tables, uses text positioning)
   - **Tabula** (fallback for complex layouts)
   - Compare all three, use best result per table

2. **Table-first architecture**:
   ```
   Step 1: Extract all tables from PDF as structured data (CSV/JSON)
   Step 2: Classify each table (Balance Sheet, Income Statement, Cash Flow, Notes)
   Step 3: Use LLM to map table headers to metric names
   Step 4: Use deterministic extraction (row/column matching) to get values
   Step 5: Use LLM only for complex footnotes or narrative sections
   ```

3. **Hybrid approach for multi-page tables**:
   - Detect table continuations across pages
   - Merge continued tables before extraction
   - Extract complete table as one unit (don't chunk)

4. **Validate table extraction quality**:
   - Check: All rows have same number of columns
   - Check: Numeric columns are actually numeric (no text)
   - Check: Headers are distinct (no duplicate column names)
   - If validation fails, fall back to LLM-based extraction

**Detection:**
- Ask: "How do you extract tables from PDFs?" If answer is "send text to GPT-4", problem exists
- Check extraction accuracy on multi-column tables (3+ years of data side by side)
- Look for year misalignment errors (2023 data labeled as 2024)

**Phase mapping:**
- Phase 2: Integrate table extraction library (Camelot or pdfplumber)
- Phase 3: Implement table-first extraction architecture
- Phase 4: Add table continuation detection (multi-page tables)

---

## Moderate Pitfalls

These cause delays, technical debt, or accuracy plateaus.

### Pitfall 7: Insufficient Logging & Debugging Infrastructure

**What goes wrong:**
When extraction fails or returns wrong values, you have no way to debug why:
- Which chunk contained the correct value?
- What did the LLM see (exact text)?
- How did the LLM interpret ambiguous context?
- Why did merge choose value A over value B?

**Prevention:**
- Log every LLM request/response with chunk index
- Store extracted values with source chunk + line number + context
- Implement extraction replay (re-run extraction with saved chunks)
- Create diff tool (compare two extraction runs side by side)

**Detection:**
Current code has basic logging (`console.log` statements) but no structured logging, no extraction provenance tracking, no replay capability.

**Phase mapping:**
- Phase 1: Add structured logging (JSON logs with chunk provenance)
- Phase 2: Build extraction replay tool
- Phase 3: Create diff/comparison tool for debugging

---

### Pitfall 8: Model Switching Without Architecture Changes

**What goes wrong:**
Teams think "just switch to Claude/GPT-5/Gemini and accuracy will improve." But if the architecture is flawed (chunking breaks tables, merge strategy propagates errors), model changes provide 3-5% improvement at best.

**Prevention:**
- Fix architecture first (table extraction, validation, merge strategy)
- THEN experiment with models
- Use ground truth to measure model performance objectively
- Don't assume newer = better (GPT-4 Turbo may be worse than GPT-4 for numeric extraction)

**Detection:**
Team discusses model switching before discussing test coverage, validation logic, or ground truth dataset.

**Phase mapping:**
- Phase 1-3: Fix architecture (ground truth, table extraction, validation)
- Phase 4: Experiment with model alternatives (only after architecture solid)

---

### Pitfall 9: No Validation of Calculated Ratios

**What goes wrong:**
Code calculates FCCR, DSCR, Senior Debt/EBITDA from extracted values. If extraction is wrong, ratios are wrong. But ratios have **domain constraints** that can detect upstream extraction errors:
- FCCR < 0 → impossible (numerator or denominator wrong)
- Senior Debt/EBITDA > 10x → extremely rare (likely extraction error)
- Total Debt/Total Capital > 100% → impossible (equity or debt wrong)

Current code validates some ratios (checks if finite) but doesn't validate domain constraints.

**Prevention:**
1. **Add domain constraint validation**:
   ```typescript
   function validateRatios(metrics: ComputedMetrics): ValidationIssue[] {
     const issues = [];

     if (metrics.fccr < 0) {
       issues.push({
         severity: 'critical',
         field: 'fccr',
         message: 'FCCR cannot be negative - numerator or denominator extraction error',
         likely_cause: 'Wrong sign on adjusted EBITDA components'
       });
     }

     if (metrics.senior_debt_to_ebitda > 10) {
       issues.push({
         severity: 'warning',
         field: 'senior_debt_to_ebitda',
         message: 'Senior Debt/EBITDA > 10x is extremely rare',
         likely_cause: 'Senior debt over-reported or EBITDA under-reported'
       });
     }

     // Additional validations...
     return issues;
   }
   ```

2. **Cross-validate related metrics**:
   - `total_debt ≥ senior_debt` (always true)
   - `revenue ≥ net_income` (usually true, except extreme non-operating gains)
   - `ebitda ≥ net_income` (usually true)

**Detection:**
Review extracted ratios for impossible values. Current validation (aiProcessor.ts lines 267-291) only checks for NaN/Infinity, not domain constraints.

**Phase mapping:**
- Phase 2: Add domain constraint validation
- Phase 3: Add cross-validation rules

---

### Pitfall 10: Chunking Strategy Fragments Financial Context

**What goes wrong:**
Current code chunks at 12,000 characters (AI_CONFIG.CHUNK_SIZE). This arbitrary boundary may:
- Split table headers from values
- Separate "in thousands" disclaimer from numbers
- Fragment footnote references from referenced text

Result: LLM sees incomplete context and makes wrong inferences.

**Prevention:**
1. **Semantic chunking** (instead of character-based):
   - Detect document sections (Balance Sheet, Income Statement, Notes)
   - Chunk at section boundaries
   - Keep each financial statement table in one chunk

2. **Preserve context across chunks**:
   - Include overlap (last 500 chars of chunk N in chunk N+1)
   - Carry forward metadata (current section, current table, units)

3. **Chunk size optimization**:
   - Test multiple chunk sizes on ground truth
   - Measure accuracy vs chunk size
   - Find optimal size (may be larger or smaller than 12,000)

**Detection:**
- Compare extraction results with different chunk sizes
- If accuracy changes >5% with chunk size, chunking strategy is flawed
- Review extraction errors — do they cluster at chunk boundaries?

**Phase mapping:**
- Phase 2: Implement semantic chunking (section-based)
- Phase 3: Add chunk overlap for context preservation

---

## Minor Pitfalls

These cause annoyance but are fixable without major rework.

### Pitfall 11: Hardcoded Financial Domain Rules

**What goes wrong:**
Code has hardcoded rules like "bad_debt_provision is core operating expense, don't add back" (prompt line 122). These rules are correct for US GAAP but may not apply to IFRS, or specific industries, or certain company policies.

**Prevention:**
- Make domain rules configurable per accounting standard
- Add accounting standard detection (IFRS vs US GAAP vs other)
- Allow per-company customization of adjustment rules

**Phase mapping:**
- Phase 4: Make domain rules configurable

---

### Pitfall 12: No Incremental Improvement Tracking

**What goes wrong:**
No system to track accuracy improvement over time. Can't answer: "Are we getting better? At what rate? Will we hit 95% by deadline?"

**Prevention:**
- Store accuracy scores in database/CSV with timestamp
- Generate trend charts (accuracy over time)
- Project completion date based on improvement rate

**Phase mapping:**
- Phase 1: Add accuracy tracking infrastructure

---

### Pitfall 13: Ignoring Document Variability

**What goes wrong:**
Optimizing for one document format (e.g., Tesla 10-K) and assuming all documents follow same format. Reality:
- Different industries have different line items
- Small companies vs large companies report differently
- Audited vs unaudited statements have different structure
- Different fiscal year ends affect comparability

**Prevention:**
- Build ground truth with HIGH document diversity
- Track per-document-type accuracy separately
- Don't over-optimize for "average case" (may break edge cases)

**Phase mapping:**
- Phase 1: Ensure ground truth dataset has diversity

---

## Recommendations by Phase

### Phase 1: Foundation (MUST DO FIRST)
**Goal:** Build measurement infrastructure. You cannot improve what you cannot measure.

**Critical items:**
1. Create ground truth dataset (20-30 PDFs with manual extraction)
2. Build accuracy measurement harness
3. Add structured logging with provenance tracking
4. Implement domain constraint validation for ratios
5. Add post-extraction sign validation (quick win for parentheses issues)

**Success criteria:**
- Can measure accuracy on ground truth suite (single metric: "X% of fields correct")
- Can identify which fields have lowest accuracy
- Can detect regressions when code changes

**Time estimate:** 2-3 weeks (mostly manual ground truth creation)

---

### Phase 2: Extraction Architecture Overhaul
**Goal:** Fix systematic extraction errors through architectural improvements.

**Critical items:**
1. Integrate table extraction library (Camelot/pdfplumber)
2. Replace "first non-null wins" with voting/consensus merge
3. Implement semantic chunking (section-based, not character-based)
4. Add pre-processing of parenthetical values
5. Build prompt A/B testing framework

**Success criteria:**
- Accuracy improves from ~70% baseline to 85%+ on ground truth
- Table alignment errors eliminated
- Sign errors reduced by 80%

**Time estimate:** 3-4 weeks

---

### Phase 3: Validation & Quality Gates
**Goal:** Catch extraction errors before they propagate to calculations.

**Critical items:**
1. Implement cross-validation rules (balance sheet equation, EBITDA reconciliation)
2. Add LLM conflict resolution for merge conflicts
3. Extract confidence scores for all values
4. Add chunk type classification and prioritization
5. Implement extraction replay tool for debugging

**Success criteria:**
- 95% of extraction errors detected by validation (before human sees them)
- Low-confidence extractions flagged for review
- Can debug any extraction error in <10 minutes

**Time estimate:** 2-3 weeks

---

### Phase 4: Optimization & Polish
**Goal:** Push accuracy from 90% to 95%+.

**Critical items:**
1. Experiment with alternative models (Claude, GPT-5, Gemini)
2. Make domain rules configurable per accounting standard
3. Add table continuation detection (multi-page tables)
4. Optimize prompt (remove dead instructions)
5. Implement automated regression testing in CI/CD

**Success criteria:**
- Critical fields (EBITDA, debt, equity) at 98%+ accuracy
- Overall accuracy ≥95%
- Zero regressions on ground truth suite

**Time estimate:** 2-3 weeks

---

## Sources

**Confidence level note:**
This research is based on:
- HIGH confidence: Analysis of existing Lendflow codebase (aiProcessor.ts, extraction-prompt.ts, extraction-merger.ts, chunk-processor.ts)
- MEDIUM confidence: Financial domain knowledge (accounting standards, financial statement structure) — based on domain expertise but not externally verified for this document
- MEDIUM confidence: LLM extraction patterns — based on practical experience with GPT-4 behavior on structured data extraction tasks

**Key insights from codebase analysis:**
- No test coverage detected (Glob for test files returned only node_modules)
- "First non-null wins" merge strategy explicitly implemented (extraction-merger.ts:61)
- Extensive prompt-based parentheses handling (extraction-prompt.ts:113-156) without code-level validation
- Sequential chunk processing for determinism but no validation that determinism = correctness
- Basic validation exists (finite number checks) but no domain constraint validation
- Chunking at 12,000 chars without semantic boundary awareness

**What's missing (flagged for validation):**
- External sources on LLM financial extraction best practices (WebSearch/WebFetch unavailable during research)
- Benchmark studies comparing table extraction libraries
- Case studies of financial extraction accuracy improvement projects
- Regulatory requirements for extraction accuracy in lending context

**Recommendation for next phase:**
When implementing Phase 1 (ground truth creation), validate these pitfalls against real extraction results. Some pitfalls may be more/less severe than predicted here.
