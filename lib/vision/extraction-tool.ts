/**
 * Claude Tool Definition for Financial Metrics Extraction
 *
 * This tool schema forces Claude to return structured JSON matching
 * our ExtractedMetrics type. Using tool_choice: { type: 'tool', name: 'extract_financial_metrics' }
 * guarantees the response format.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';

/**
 * JSON Schema for ExtractedMetrics
 * Must match types/financial.ts ExtractedMetrics interface
 */
export const extractionToolSchema = {
  type: 'object' as const,
  properties: {
    fiscal_year: {
      type: 'string',
      description: 'The fiscal year (e.g., "2023", "FY2023", "2023Q3")',
    },
    fiscal_year_end_date: {
      type: ['string', 'null'],
      description: 'ISO date of fiscal year end (YYYY-MM-DD or YYYY-MM)',
    },
    fiscal_period_type: {
      type: ['string', 'null'],
      enum: ['annual', 'interim', 'quarterly', null],
      description: 'Type of fiscal period',
    },
    // Income Statement
    revenue: {
      type: ['number', 'null'],
      description: 'Total revenue/sales in thousands USD',
    },
    net_income: {
      type: ['number', 'null'],
      description: 'Net income/profit in thousands USD',
    },
    expenses: {
      type: ['number', 'null'],
      description: 'Total operating expenses in thousands USD',
    },
    profit_margins: {
      type: ['number', 'null'],
      description: 'Profit margin as decimal (0.15 = 15%)',
    },
    interest: {
      type: ['number', 'null'],
      description: 'Interest expense in thousands USD (must be positive)',
    },
    taxes: {
      type: ['number', 'null'],
      description: 'Income tax expense in thousands USD',
    },
    depreciation_amortization: {
      type: ['number', 'null'],
      description: 'Total depreciation and amortization in thousands USD',
    },
    // Depreciation breakdown
    depreciation_equipment: {
      type: ['number', 'null'],
      description: 'Depreciation on equipment/machinery in thousands USD',
    },
    depreciation_rou: {
      type: ['number', 'null'],
      description: 'Depreciation on right-of-use assets (leases) in thousands USD',
    },
    depreciation_other: {
      type: ['number', 'null'],
      description: 'Other depreciation in thousands USD',
    },
    // EBITDA
    ebitda: {
      type: ['number', 'null'],
      description: 'EBITDA if explicitly stated in document (do not calculate)',
    },
    reported_adjusted_ebitda: {
      type: ['number', 'null'],
      description: 'Adjusted EBITDA if explicitly reported in document',
    },
    // Balance Sheet
    shareholders_equity: {
      type: ['number', 'null'],
      description: 'Total shareholders equity in thousands USD',
    },
    total_debt: {
      type: ['number', 'null'],
      description: 'Total debt (all borrowings) in thousands USD',
    },
    senior_debt: {
      type: ['number', 'null'],
      description: 'Senior/bank debt only in thousands USD',
    },
    current_assets: {
      type: ['number', 'null'],
      description: 'Total current assets in thousands USD',
    },
    current_liabilities: {
      type: ['number', 'null'],
      description: 'Total current liabilities in thousands USD',
    },
    // Cash Flow Items
    capital_expenditures: {
      type: ['number', 'null'],
      description: 'Capital expenditures (CapEx) in thousands USD',
    },
    proceeds_from_long_term_debt: {
      type: ['number', 'null'],
      description: 'Proceeds from long-term debt issuance in thousands USD',
    },
    cash_taxes_paid: {
      type: ['number', 'null'],
      description: 'Cash taxes paid in thousands USD',
    },
    distributions_paid: {
      type: ['number', 'null'],
      description: 'Dividends/distributions paid in thousands USD',
    },
    ttm_principal_payments: {
      type: ['number', 'null'],
      description: 'Trailing 12 months principal payments in thousands USD',
    },
    ttm_interest_expense: {
      type: ['number', 'null'],
      description: 'Trailing 12 months interest expense in thousands USD',
    },
    repayment_of_debt: {
      type: ['number', 'null'],
      description: 'Debt repayments in thousands USD',
    },
    payment_of_lease_liability: {
      type: ['number', 'null'],
      description: 'Lease liability payments in thousands USD',
    },
    cash_interest_paid: {
      type: ['number', 'null'],
      description: 'Cash interest paid in thousands USD',
    },
    non_cash_interest_expense: {
      type: ['number', 'null'],
      description: 'Non-cash interest expense (amortization, PIK) in thousands USD',
    },
    // Nested components (simplified for initial extraction)
    debt_components: {
      type: ['object', 'null'],
      description: 'Breakdown of debt by type if available',
    },
    fixed_charges: {
      type: ['object', 'null'],
      description: 'Fixed charges breakdown if available',
    },
    adjusted_ebitda_components: {
      type: ['object', 'null'],
      description: 'EBITDA adjustment components if available',
    },
  },
  required: ['fiscal_year'],
};

/**
 * Claude tool definition for financial metrics extraction
 */
export const EXTRACTION_TOOL: Tool = {
  name: 'extract_financial_metrics',
  description: `Extract financial metrics from a financial document image.

IMPORTANT GUIDELINES:
- All monetary values should be in thousands USD (e.g., $1.5M = 1500)
- Only extract values explicitly stated in the document
- Do NOT calculate derived values (e.g., don't calculate EBITDA from components)
- Interest expense must be POSITIVE (if shown as negative, convert to positive)
- If a value is not found, use null
- Fiscal year should match document labeling (e.g., "2023", "FY23", "Q3 2023")

Call this tool with all extracted financial metrics.`,
  input_schema: extractionToolSchema,
};

/**
 * Extraction prompt for Claude
 */
export const EXTRACTION_PROMPT = `You are a financial analyst extracting data from a financial document image.

Analyze this financial document page and extract ALL financial metrics you can find.

Focus on:
1. Income Statement: revenue, net income, expenses, interest, taxes, depreciation/amortization
2. Balance Sheet: total debt, senior debt, shareholders equity, current assets/liabilities
3. Cash Flow: CapEx, debt proceeds, taxes paid, distributions, principal/interest payments
4. EBITDA: Only if explicitly stated (do not calculate)

CRITICAL RULES:
- Report all values in THOUSANDS USD (divide millions by 1000)
- Interest expense must be POSITIVE
- Only report values explicitly visible in the document
- If multiple years shown, extract for each year visible
- Use null for values not found

Call the extract_financial_metrics tool with your findings.`;
