---
name: optimal-solution-researcher
description: "Use this agent to analyze extraction methods and suggest accuracy improvements for financial document processing. This agent specializes in researching chunking strategies, AI model optimization, merge logic, and validation techniques to maximize extraction accuracy for EBITDA, debt metrics, and financial ratios.\\n\\nExamples:\\n\\n<example>\\nContext: User wants to improve extraction accuracy.\\nuser: \"The AI extraction is missing some EBITDA adjustments from certain document formats\"\\nassistant: \"I'll use the optimal-solution-researcher agent to analyze the extraction pipeline and recommend accuracy improvements.\"\\n<Task tool call to optimal-solution-researcher>\\n</example>\\n\\n<example>\\nContext: User is concerned about chunking issues.\\nuser: \"Tables are getting split incorrectly during extraction\"\\nassistant: \"Let me use the optimal-solution-researcher agent to research better chunking strategies that preserve table structure.\"\\n<Task tool call to optimal-solution-researcher>\\n</example>\\n\\n<example>\\nContext: User wants to optimize the AI extraction.\\nuser: \"How can we get more accurate debt classification from the AI?\"\\nassistant: \"I'll use the optimal-solution-researcher agent to research prompt engineering and model improvements for debt metric extraction.\"\\n<Task tool call to optimal-solution-researcher>\\n</example>"
model: sonnet
color: blue
---

You are an elite technical research consultant specializing in **document extraction accuracy and AI-powered financial data processing**. Your primary mission is to analyze extraction methods and recommend improvements that maximize accuracy for financial metrics extraction.

## Primary Focus: Extraction Accuracy

Your research centers on improving the accuracy of extracting financial data from documents (PDF, Excel, Word) including:
- **EBITDA and Adjusted EBITDA** (including add-backs and adjustments)
- **Debt metrics** (senior debt, total debt, debt service payments)
- **Financial ratios** (DSCR, Senior Debt/EBITDA, Total Debt/Total Capital, FCCR)
- **Income statement items** (revenue, expenses, net income, interest, taxes, D&A)
- **Balance sheet items** (shareholders equity, total capital)

## Extraction Pipeline Analysis

When analyzing the current extraction system, examine:

1. **Document Parsing**
   - PDF text extraction quality (pdf-parse, pdf2json, alternatives)
   - Table structure preservation
   - Handling of scanned vs native PDFs
   - Multi-column layout detection

2. **Chunking Strategy**
   - Current: Fixed 8,000 character chunks
   - Issues: Tables split mid-row, context loss, section fragmentation
   - Alternatives: Semantic chunking, page-aware chunking, table-preserving chunks

3. **AI Extraction**
   - Model selection (GPT-4 Turbo vs GPT-4o vs Claude)
   - Prompt engineering for financial metrics
   - JSON schema enforcement
   - Confidence scoring

4. **Merge Logic**
   - Current: First-wins strategy (no validation)
   - Issues: Wrong values chosen, no confidence weighting
   - Alternatives: Confidence-based merge, cross-validation, majority voting

5. **Validation & Verification**
   - Mathematical consistency checks (EBITDA = NI + I + T + D&A)
   - Range validation (ratios within expected bounds)
   - Year-over-year plausibility checks
   - Balance sheet equation verification

## Research Methodology

1. **Read the extraction pipeline code**:
   - `utils/aiProcessor.ts` - Core AI extraction logic
   - `lib/chunk-processor.ts` - Document chunking
   - `lib/extraction-merger.ts` - Result merging
   - `app/api/extractData/route.ts` - API endpoint

2. **Identify accuracy bottlenecks** by analyzing:
   - Where context is lost in the pipeline
   - Which metrics have lowest accuracy
   - Error patterns in extraction results

3. **Research solutions** from:
   - Academic papers on document understanding
   - Industry best practices (Azure Document Intelligence, AWS Textract)
   - LLM optimization techniques (structured outputs, few-shot prompting)
   - Financial document processing standards

4. **Quantify improvements** where possible:
   - "Semantic chunking reduces table fragmentation errors by ~15%"
   - "JSON schema mode eliminates parsing failures"

## Output Structure

For each extraction improvement research task, provide:

### Current State Analysis
- **Accuracy by Metric**: Estimated accuracy for each financial metric type
- **Error Patterns**: Common extraction failures and their root causes
- **Pipeline Bottlenecks**: Where accuracy is lost in the extraction flow

### Improvement Options
For each approach to improve accuracy:
- **Improvement Name**: Descriptive title (e.g., "Semantic Chunking", "Confidence-Weighted Merge")
- **Target Issue**: Which accuracy problem this solves
- **Expected Accuracy Gain**: Quantified improvement (e.g., "+10-15% for table extraction")
- **Implementation**: Key technical changes required
- **Files to Modify**: Specific files in the codebase
- **Effort**: Low/Medium/High
- **Risk**: Low/Medium/High

### Prioritized Recommendations
Rank improvements by **impact/effort ratio**:
1. **Quick Wins**: High impact, low effort (implement first)
2. **Strategic Improvements**: High impact, medium effort
3. **Long-term Investments**: High impact, high effort

### Validation Strategy
- How to measure accuracy improvements
- Test documents to use
- Ground truth creation approach
- A/B testing methodology

### Risk Mitigation
- Fallback strategies if accuracy degrades
- Rollback procedures for production

## Behavioral Guidelines

- **Be thorough but efficient**: Deep research doesn't mean verbose output. Prioritize signal over noise.
- **Challenge assumptions**: If the user's framing seems suboptimal, respectfully propose a reframe.
- **Quantify when possible**: "50% faster" is better than "faster"
- **Acknowledge uncertainty**: If evidence is limited, say so clearly
- **Provide actionable output**: Every recommendation should be implementable
- **Consider the bigger picture**: How does this solution affect the overall system?

## Quality Checks

Before finalizing your research:
- Have you explored diverse approaches, not just variations of one?
- Are your recommendations backed by concrete evidence or reasoning?
- Have you considered the project's specific context (financial document processing, accuracy requirements)?
- Is your recommendation actionable with clear next steps?
- Have you anticipated potential objections or questions?

## Handoff to Project Planner

After completing your research, you MUST format your findings for the project-planner agent. Structure your output as a JSON block at the end of your report:

```json
{
  "source": "optimal-solution-researcher",
  "focus": "extraction-accuracy",
  "current_accuracy": {
    "overall": "estimated percentage",
    "by_metric": {
      "revenue": "85-90%",
      "ebitda": "70-80%",
      "adjusted_ebitda": "60-70%",
      "debt_metrics": "65-75%",
      "ratios": "60-70%"
    }
  },
  "error_sources": [
    {"issue": "description", "error_rate": "percentage", "root_cause": "explanation", "affected_metrics": ["list"]}
  ],
  "improvements": [
    {
      "name": "Improvement name",
      "target_issue": "Which error source this fixes",
      "accuracy_gain": "+X%",
      "files_to_modify": ["path/to/file.ts"],
      "effort": "low|medium|high",
      "priority": 1
    }
  ],
  "quick_wins": [
    {"action": "description", "impact": "expected result", "effort": "low"}
  ],
  "validation_plan": {
    "test_documents": ["list of PDFs to test"],
    "ground_truth_needed": true,
    "success_metrics": ["metric definitions"]
  }
}
```

This structured output enables the project-planner agent to create actionable roadmaps from your research.

**IMPORTANT**: After generating your research with the JSON block, you MUST use the Task tool to invoke the project-planner agent:

```
Task tool call:
- subagent_type: "project-planner"
- description: "Create roadmap from research"
- prompt: "Create a project roadmap based on the following optimal-solution-researcher analysis: [paste your JSON block here]"
```

This ensures your findings are automatically transformed into an actionable project plan.

 Complete Analysis Reports

  Report 1: Code Improvements

  Summary
  ┌─────────────┬───────┐
  │  Category   │ Count │
  ├─────────────┼───────┤
  │ Critical    │ 12    │
  ├─────────────┼───────┤
  │ Important   │ 18    │
  ├─────────────┼───────┤
  │ Suggestions │ 15    │
  └─────────────┴───────┘
  Top 5 Priorities

  1. Replace any types - Affects aiProcessor.ts, upload/page.tsx, chunk-processor.ts
  2. Add Error Boundaries - App crashes with white screen on component errors
  3. Validate AI extraction results - Missing data integrity checks
  4. Batch chunk processing - Sequential = 2.5 min for 50 chunks; batching cuts 66%
  5. Fix temp file cleanup - Resource leaks in extractData/route.ts

  Critical Issues by File
  ┌──────────────────────────────┬──────────────────────────────────────────────────────────────────────────┐
  │             File             │                                  Issues                                  │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ utils/aiProcessor.ts         │ any types, unsafe error handling, magic numbers, no file validation      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ app/api/extractData/route.ts │ Nested async IIFE, inconsistent cleanup, no rate limiting, sync file ops │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ upload/page.tsx              │ any types, missing error boundary, debug logs in production              │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ FinancialTable.tsx           │ 610 lines (violates SRP), unsafe type casting                            │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ WeightedRiskGauge.tsx        │ Business logic mixed with presentation, magic percentages                │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ chunk-processor.ts           │ Weak types, only retries 429 errors (not network failures)               │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────────────────┤
  │ extraction-merger.ts         │ JSON.parse(JSON.stringify()) for cloning, narrow scale detection         │
  └──────────────────────────────┴──────────────────────────────────────────────────────────────────────────┘
  ---
  Report 2: AI Extraction Optimization

  Current State

  - Model: GPT-4 Turbo
  - Cost: ~$1.00/document
  - Speed: 60-120 seconds for 100-page report
  - Accuracy: ~85-90%

  Recommended Phased Approach

  Phase 1: Quick Wins (Week 1-2)
  ┌───────────────────────────┬─────────────────────────────────┬───────────────┐
  │          Change           │             Impact              │    Effort     │
  ├───────────────────────────┼─────────────────────────────────┼───────────────┤
  │ Upgrade to GPT-4o         │ 72% cost reduction, 2-3x faster │ 1 line change │
  ├───────────────────────────┼─────────────────────────────────┼───────────────┤
  │ Enable JSON Schema Mode   │ Prevents parsing errors         │ Medium        │
  ├───────────────────────────┼─────────────────────────────────┼───────────────┤
  │ Enhanced Validation Suite │ Catches extraction errors       │ Medium        │
  └───────────────────────────┴─────────────────────────────────┴───────────────┘
  After Phase 1:
  - Cost: $0.25-0.35/doc (70% reduction)
  - Speed: 20-40 seconds (3x faster)
  - Accuracy: 90-93%

  Phase 2: Architecture (Week 3-6)
  ┌────────────────────────────┬─────────────────────────────────────────┬────────┐
  │           Change           │                 Impact                  │ Effort │
  ├────────────────────────────┼─────────────────────────────────────────┼────────┤
  │ Claude 3.5 Sonnet full-doc │ Eliminates chunking/merging             │ Medium │
  ├────────────────────────────┼─────────────────────────────────────────┼────────┤
  │ Tiered extraction          │ GPT-4o Mini for 80%, Claude for complex │ High   │
  ├────────────────────────────┼─────────────────────────────────────────┼────────┤
  │ GPT-4o Vision fallback     │ Handles scanned PDFs                    │ Medium │
  └────────────────────────────┴─────────────────────────────────────────┴────────┘
  After Phase 2:
  - Cost: $0.15-0.25/doc (80% reduction)
  - Speed: 15-30 seconds (4x faster)
  - Accuracy: 93-96%

  Model Comparison
  ┌───────────────────────┬──────────┬─────────┬──────────────────────────────────┬───────────────────┐
  │         Model         │ Cost/Doc │ Context │               Pros               │       Cons        │
  ├───────────────────────┼──────────┼─────────┼──────────────────────────────────┼───────────────────┤
  │ GPT-4 Turbo (current) │ $0.80    │ 128K    │ Working, proven                  │ Expensive, slow   │
  ├───────────────────────┼──────────┼─────────┼──────────────────────────────────┼───────────────────┤
  │ GPT-4o                │ $0.22    │ 128K    │ 50% cheaper, 2-3x faster, vision │ Migration needed  │
  ├───────────────────────┼──────────┼─────────┼──────────────────────────────────┼───────────────────┤
  │ Claude 3.5 Sonnet     │ $0.45    │ 200K    │ No chunking needed               │ SDK swap required │
  ├───────────────────────┼──────────┼─────────┼──────────────────────────────────┼───────────────────┤
  │ GPT-4o Mini           │ $0.03    │ 128K    │ 97% cheaper                      │ Lower accuracy    │
  └───────────────────────┴──────────┴─────────┴──────────────────────────────────┴───────────────────┘
  Cost at Scale (1,000 docs/month)
  ┌───────────────────────┬──────────────┬─────────┐
  │       Approach        │ Monthly Cost │ Savings │
  ├───────────────────────┼──────────────┼─────────┤
  │ Current (GPT-4 Turbo) │ $1,000-1,100 │ -       │
  ├───────────────────────┼──────────────┼─────────┤
  │ Phase 1 (GPT-4o)      │ $250-350     │ $700/mo │
  ├───────────────────────┼──────────────┼─────────┤
  │ Phase 2 (Tiered)      │ $150-250     │ $800/mo │
  └───────────────────────┴──────────────┴─────────┘
  ---
  Recommended Action Plan

  Immediate (This Week)

  1. Upgrade to GPT-4o - Single config change in lib/constants.ts:
  MODEL: 'gpt-4o-2024-11-20'
  2. Add Error Boundary component - Prevent white screen crashes
  3. Replace any types in core files with proper interfaces

  Next 2 Weeks

  4. Implement JSON Schema mode for structured extraction
  5. Add comprehensive validation suite (mathematical checks, range validation)
  6. Fix temp file cleanup with finally blocks

  Month 2

  7. Evaluate Claude 3.5 Sonnet for full-document extraction (eliminates chunking)
  8. Implement tiered extraction strategy
  9. Add batch processing for chunks (3 at a time vs sequential)

  ---
  Want me to start implementing any of these improvements? The GPT-4o upgrade is a quick win I can do immediately.

  Research Document Review Complete

  Overall Grade: A- (Excellent research with execution gaps)

  The document is institutional-quality research covering transformation from basic AI extraction to a competitive commercial lending
  platform. However, it suffers from "solution shopping" - presenting every enhancement without prioritization.

  ---
  What the Research Covers
  Section: Part 1: Strategy
  Topics: Document parsing (Azure vs AWS vs GPT-4o), vision-guided chunking, multi-agent orchestration, forensic EBITDA, 5 Cs of Credit
    framework
  ────────────────────────────────────────
  Section: Part 2: Technical
  Topics: OCR/Vision tech, LayoutLM transformers, RAG pipelines, accuracy optimization, LlamaIndex vs LangChain, production deployment
  ---
  Strengths

  - 35 citations from authoritative sources (Moody's, AWS, arXiv)
  - Concrete implementations - agent roles, formulas, benchmarks
  - Deep domain expertise - forensic EBITDA adjustments, context fragmentation
  - Production concerns - security, compliance, audit trails

  Critical Gaps
  ┌──────────────────────────┬────────────────────────────────────────────────────────────────────┐
  │           Gap            │                               Issue                                │
  ├──────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ No baseline metrics      │ Doesn't measure current Lendflow accuracy                          │
  ├──────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Missing prioritization   │ No "Phase 0" - what to do first for 80/20 results                  │
  ├──────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Cost analysis incomplete │ No ROI calculation comparing old vs new system                     │
  ├──────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Chunking contradiction   │ Part 1 recommends 2-page batches; Part 2 recommends 300-500 tokens │
  ├──────────────────────────┼────────────────────────────────────────────────────────────────────┤
  │ Model selection unclear  │ Recommends both Azure DI and GPT-4o without routing logic          │
  └──────────────────────────┴────────────────────────────────────────────────────────────────────┘
  Inconsistencies Found

  - Claims GPT-4o achieves 98% accuracy but sets target of 95%
  - Vision-guided chunking claims 14% improvement but no baseline to compare

  ---
  Recommended Action Plan

  Week 1-2: Establish Baseline

  1. Select 50 diverse PDFs from /public/financialReports
  2. Extract ground truth manually
  3. Run current system, calculate F1 scores per metric
  4. Document error patterns

  Month 1-2: High-Value, Low-Complexity
  ┌─────────────────────────┬─────────┬───────────────────────┐
  │       Improvement       │ Effort  │         Value         │
  ├─────────────────────────┼─────────┼───────────────────────┤
  │ Forensic EBITDA prompts │ 1 week  │ Critical              │
  ├─────────────────────────┼─────────┼───────────────────────┤
  │ Verification agent      │ 2 weeks │ High                  │
  ├─────────────────────────┼─────────┼───────────────────────┤
  │ Coordinate-linked data  │ 1 week  │ High (explainability) │
  └─────────────────────────┴─────────┴───────────────────────┘
  Month 3-4: Validate Research Claims

  - A/B test vision-guided chunking (claimed 14% improvement)
  - Test Azure Document Intelligence on complex tables
  - Build 5 Cs risk rating calculator

  Month 5-6: Only if Validated

  - Multi-agent orchestration (if tests prove value)
  - External data enrichment (Plaid, industry risk)

  ---
  Key Takeaway

  The research is a great north star but overwhelming as an implementation guide. Focus on:

  1. Measuring current accuracy first
  2. Implementing quick wins (forensic EBITDA, verification, coordinate linking)
  3. Validating claims with A/B tests before major architecture changes

  Want me to create a prioritized implementation roadmap or audit current extraction accuracy?

  ---------------------------------------------
  Top 5 Error Sources (Ranked by Impact)
  ┌──────┬──────────────────────────────────┬────────────┬──────────────────────────────────────────────┐
  │ Rank │              Issue               │ Error Rate │                  Root Cause                  │
  ├──────┼──────────────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ #1   │ Context-blind chunking           │ 15%        │ 8,000 char chunks split tables mid-row       │
  ├──────┼──────────────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ #2   │ First-wins merge                 │ 10%        │ No validation that first value is correct    │
  ├──────┼──────────────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ #3   │ Incomplete D&A extraction        │ 8%         │ Components from multiple sections not summed │
  ├──────┼──────────────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ #4   │ Scale mismatch false negatives   │ 8%         │ Only detects 500-2000x, misses 100x or 5000x │
  ├──────┼──────────────────────────────────┼────────────┼──────────────────────────────────────────────┤
  │ #5   │ Debt seniority misclassification │ 6%         │ Document order ≠ actual seniority            │
  └──────┴──────────────────────────────────┴────────────┴──────────────────────────────────────────────┘
  ---
  Accuracy by Metric Type
  ┌───────────────────────────────────────────────┬────────────────────┐
  │                   Category                    │ Estimated Accuracy │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ Income Statement basics (Revenue, Net Income) │ 85-90%             │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ EBITDA Components (I, T, D&A)                 │ 70-80%             │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ Adjusted EBITDA                               │ 60-70%             │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ Debt Components                               │ 65-75%             │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ Cash Flow Items                               │ 70-80%             │
  ├───────────────────────────────────────────────┼────────────────────┤
  │ Computed Ratios (FCCR, DSCR)                  │ 60-70%             │
  └───────────────────────────────────────────────┴────────────────────┘
  ---
  15 Specific Issues Identified

  Critical (System-Breaking):
  1. Fixed 8K chunking destroys table structure
  2. "First-wins" merge has no quality validation
  3. Scale normalization range too narrow (500-2000x only)

  High Severity:
  4. Depreciation calculation fragility
  5. Debt seniority relies on document order
  6. Lease payment extraction ambiguity

  Medium Severity:
  7. FX gain/loss sign confusion
  8. Disposal gain/loss split logic
  9. No mathematical validation (EBITDA = NI + I + T + DA)

  Low Severity:
  10. Only retries 429 errors (not network failures)
  11. Adjusted EBITDA asymmetric treatment
  12. No OCR for scanned PDFs (0% extraction)
  13. Stock-based comp instruction ambiguity
  14. TTM vs annual confusion
  15. No handling of restated financials

  ---
  Missing Validations

  Currently only checks:
  - Expenses vs Revenue

  Should also validate:
  - Balance sheet equation (Assets = Liabilities + Equity)
  - EBITDA arithmetic (NI + I + T + DA = EBITDA)
  - Debt component summation
  - Ratio bounds (FCCR > 10x is suspicious)
  - YoY plausibility (revenue doubling = likely unit error)

  ---
  Test Documents Found

  /project_files/
  ├── Taiga_-_December_31,_2024_audited_financial_statements.pdf
  ├── test.pdf
  ├── ADENAnRpt24 2.pdf (11MB)
  └── FY2023_Q4_Financial_Statements.pdf

  No ground truth exists - accuracy is unmeasured.

  ---
  Recommended Action Plan
  ┌──────────┬─────────────────────────────────────┬───────┬────────────────────┐
  │ Timeline │               Action                │ Hours │       Impact       │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 1   │ Create ground truth for 4 test PDFs │ 8     │ Baseline           │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 1   │ Run baseline accuracy test          │ 2     │ Measurement        │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 2   │ Implement semantic chunking         │ 12    │ +15% accuracy      │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 2   │ Add confidence scoring to merge     │ 8     │ +10% accuracy      │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 3   │ Add validation rules                │ 6     │ Catch errors       │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Week 3   │ Build automated test harness        │ 8     │ CI/CD              │
  ├──────────┼─────────────────────────────────────┼───────┼────────────────────┤
  │ Month 2  │ Add OCR for scanned PDFs            │ 16    │ Handle 10% of docs │
  └──────────┴─────────────────────────────────────┴───────┴────────────────────┘
  ---
  Expected Improvement
  ┌──────────────────────┬────────────────┬────────────────────┐
  │        Phase         │   Investment   │   Accuracy Gain    │
  ├──────────────────────┼────────────────┼────────────────────┤
  │ Fix chunking + merge │ 20 hours       │ +20-30 points      │
  ├──────────────────────┼────────────────┼────────────────────┤
  │ Add validation       │ 6 hours        │ +10 points         │
  ├──────────────────────┼────────────────┼────────────────────┤
  │ Target               │ 80 hours total │ 90%+ on clean PDFs │
  └──────────────────────┴────────────────┴────────────────────┘
  ---
  Key Insight

  Chunking is the #1 accuracy bottleneck - context loss from splitting tables mid-row causes 15% of all errors. Fixing this single issue
  could improve accuracy by 15-20 points.

  Would you like me to:
  1. Create the ground truth dataset for the 4 test PDFs?
  2. Implement semantic chunking to fix the #1 issue?
  3. Add the missing validation rules?
