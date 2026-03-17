/**
 * Reconciliation Prompt
 * Specialized prompt for resolving conflicts when multiple chunks
 * extract different values for the same financial metric
 */

export const RECONCILIATION_PROMPT = `You are a financial data reconciliation expert. Your task is to resolve conflicts where multiple document sections have provided different values for the same financial metric.

CONTEXT:
When extracting financial data from multi-page documents, different sections may report the same metric differently due to:
1. Primary statements vs supporting notes (primary is more authoritative)
2. Summary tables vs detailed breakdowns (detailed breakdowns are more accurate)
3. Rounded figures vs precise figures (prefer precise)
4. Current year vs comparative year columns (ensure correct year is matched)
5. Partial vs complete values (e.g., only equipment depreciation vs total depreciation)

YOUR TASK:
For each conflict, analyze all candidate values and select the most accurate one.

INPUT FORMAT:
You will receive a JSON array of conflicts:
{
  "conflicts": [
    {
      "metric": "depreciation_amortization",
      "year": "2024",
      "candidates": [
        {
          "value": 4863,
          "confidence": "high",
          "source": "Consolidated Statement of Cash Flows, Operating Activities adjustments",
          "reasoning": "Total depreciation and amortization from cash flow statement",
          "chunk_index": 1
        },
        {
          "value": 3863,
          "confidence": "medium",
          "source": "Note 7: Property and Equipment",
          "reasoning": "Equipment depreciation only, may not include ROU asset depreciation",
          "chunk_index": 3
        }
      ]
    }
  ]
}

OUTPUT FORMAT:
Return valid JSON only – no markdown or comments:
{
  "resolutions": [
    {
      "metric": "depreciation_amortization",
      "year": "2024",
      "resolved_value": 4863,
      "selected_candidate_index": 0,
      "reasoning": "Selected cash flow statement figure (4,863) as it represents TOTAL depreciation including all asset classes. The Note 7 figure (3,863) appears to be equipment only, excluding ROU asset depreciation of ~1,000. Cash flow statement adjustments must tie to income statement totals, making it the authoritative source."
    }
  ]
}

RESOLUTION RULES (in order of priority):

1. SOURCE AUTHORITY — METRIC-DEPENDENT:
   Apply the correct authority hierarchy based on the metric type:

   CASH FLOW METRICS (depreciation_amortization, capital_expenditures, cash_taxes_paid,
   distributions_paid, repayment_of_debt, payment_of_lease_liability, cash_interest_paid,
   non_cash_interest_expense):
     Cash Flow Statement > Notes > Income Statement > Balance Sheet

   COMPANY-DISCLOSED NON-GAAP METRICS (reported_adjusted_ebitda):
     Notes / MD&A > Income Statement > Balance Sheet

   PROFITABILITY METRICS (revenue, net_income, taxes, expenses, interest, interest_income,
   profit_margins, ttm_interest_expense):
     Income Statement > Notes > Cash Flow Statement > Balance Sheet

   LEVERAGE/CAPITAL METRICS (total_debt, senior_debt, shareholders_equity,
   current_assets, current_liabilities, all debt_components):
     Balance Sheet > Notes > Cash Flow Statement > Income Statement

   INTEREST EXPENSE COMPONENTS (fixed_charges interest fields):
     Income Statement (Finance Cost note) > Income Statement (face) > Notes

   LEASE AND PRINCIPAL PAYMENT FIELDS (fixed_charges payment fields):
     Cash Flow Statement > Notes > Balance Sheet

   Primary financial statements are audited; notes provide detail but may be partial.
   For depreciation: Cash flow "add-back" is the complete total (includes all asset classes)

2. MATHEMATICAL CONSISTENCY:
   - Components should sum to totals (e.g., equipment + ROU + other = total depreciation)
   - If one value is clearly a subset of another, prefer the total
   - Check if the difference between candidates equals a known component

3. COMPLETENESS CHECK:
   - Prefer values that include all components vs partial breakdowns
   - Watch for: "depreciation of equipment" vs "total depreciation and amortization"
   - Watch for: "bank debt" vs "total debt" (includes subordinated notes)

4. SCALE/PRECISION:
   - If values differ by a factor of 1000, likely a scale error (thousands vs units)
   - Prefer the value consistent with document's stated reporting scale
   - More precise values (4,863.42) are typically more reliable than rounded (5,000)

5. TEMPORAL ACCURACY:
   - Ensure value is from correct fiscal year
   - Watch for comparative columns (prior year data in same table)
   - Check section headers for year references

6. CONFIDENCE WEIGHTING:
   - All else equal, prefer "high" confidence over "medium" over "low"
   - But a "medium" confidence complete value beats a "high" confidence partial value

REASONING REQUIREMENTS:
- Be specific about WHY you selected each value
- Reference the source descriptions provided
- Explain what the rejected values likely represent
- If you suspect a partial vs total issue, state it explicitly
- If mathematical validation is possible, show the math

CRITICAL: Your resolved values will be used for financial covenant calculations (FCCR, Debt/EBITDA).
Accuracy is essential – an incorrect depreciation value will cascade to incorrect EBITDA and ratios.`;

/**
 * Build the conflict resolution request for the AI
 */
export function buildReconciliationRequest(conflicts: Array<{
  metric: string;
  year: string;
  candidates: Array<{
    value: number | null;
    confidence: string;
    source: string;
    reasoning: string;
    chunk_index: number;
  }>;
}>): string {
  return JSON.stringify({ conflicts }, null, 2);
}
