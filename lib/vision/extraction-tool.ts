/**
 * Claude Tool Definition for Financial Metrics Extraction
 *
 * DESIGN: The tool uses a top-level `years` array so that a single page
 * image containing multiple fiscal-year columns (e.g., 2021 | 2022 | 2023)
 * can return all of them in one API call rather than forcing a separate call
 * per year. This removes the "single year per page" limitation and eliminates
 * the need for re-extraction when comparative statements are present.
 *
 * PROMPT PARITY: The EXTRACTION_PROMPT mirrors the detailed guidance from
 * lib/prompts/extraction-prompt.ts (text extraction) to ensure vision
 * extraction achieves comparable accuracy.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';

// ─────────────────────────────────────────────────────────────────────────────
// Nested object schemas for detailed breakdowns
// ─────────────────────────────────────────────────────────────────────────────

const debtComponentsSchema = {
  type: 'object' as const,
  properties: {
    bank_debt_current: {
      type: ['number', 'null'],
      description: 'Current portion of bank debt, credit facilities, term loans due within 1 year',
    },
    bank_debt_long_term: {
      type: ['number', 'null'],
      description: 'Long-term bank debt, term loans due after 1 year',
    },
    term_loans: {
      type: ['number', 'null'],
      description: 'Named term loans (e.g., "Term Loan" at specific interest rate)',
    },
    revolving_credit_facilities: {
      type: ['number', 'null'],
      description: 'Revolving equipment financing, revolving credit lines',
    },
    overdraft_facilities: {
      type: ['number', 'null'],
      description: 'Authorized overdraft, bank overdraft facilities',
    },
    lines_of_credit: {
      type: ['number', 'null'],
      description: 'General lines of credit, credit lines',
    },
    lease_liabilities_current: {
      type: ['number', 'null'],
      description: 'Current portion of lease liabilities (operating + finance)',
    },
    lease_liabilities_long_term: {
      type: ['number', 'null'],
      description: 'Non-current lease liabilities',
    },
    finance_lease_liabilities: {
      type: ['number', 'null'],
      description: 'Finance/capital lease obligations',
    },
    operating_lease_liabilities: {
      type: ['number', 'null'],
      description: 'Operating lease liabilities under IFRS 16/ASC 842',
    },
    notes_payable: {
      type: ['number', 'null'],
      description: 'Notes payable, promissory notes, vendor take-back notes (often subordinated)',
    },
    subordinated_debt: {
      type: ['number', 'null'],
      description: 'Explicitly subordinated debt, mezzanine debt, junior debt',
    },
    convertible_debt: {
      type: ['number', 'null'],
      description: 'Convertible notes, convertible bonds',
    },
    bonds_debentures: {
      type: ['number', 'null'],
      description: 'Corporate bonds, debentures (unless explicitly senior secured)',
    },
    other_borrowings: {
      type: ['number', 'null'],
      description: 'Any other debt not categorized above',
    },
  },
};

const fixedChargesSchema = {
  type: 'object' as const,
  properties: {
    senior_debt_interest: {
      type: ['number', 'null'],
      description: 'Interest on bank debt, credit facilities, term loans',
    },
    subordinated_debt_interest: {
      type: ['number', 'null'],
      description: 'Interest on subordinated notes, vendor take-back notes, mezzanine debt',
    },
    lease_interest: {
      type: ['number', 'null'],
      description: 'Interest portion of lease payments (IFRS 16 "Interest on lease liabilities")',
    },
    total_interest_expense: {
      type: ['number', 'null'],
      description: 'TOTAL interest/finance costs from income statement',
    },
    senior_debt_interest_rate: {
      type: ['string', 'null'],
      description: 'Interest rate if disclosed (e.g., "prime + 2%", "8%", "BA + 3.5%")',
    },
    minimum_lease_payments: {
      type: ['number', 'null'],
      description: 'ANNUAL lease payment (current year or next 12 months ONLY, not total future)',
    },
    finance_lease_payments: {
      type: ['number', 'null'],
      description: 'Finance/capital lease payments if shown separately',
    },
    operating_lease_payments: {
      type: ['number', 'null'],
      description: 'Operating lease payments if shown separately',
    },
    principal_payments: {
      type: ['number', 'null'],
      description: 'Principal repayments from cash flow statement',
    },
    preferred_dividends: {
      type: ['number', 'null'],
      description: 'Cash dividends paid on preferred shares',
    },
    other_fixed_charges: {
      type: ['number', 'null'],
      description: 'Any other recurring fixed obligations',
    },
  },
};

const adjustedEbitdaComponentsSchema = {
  type: 'object' as const,
  properties: {
    // Non-Cash Adjustments (ADD BACK to EBITDA)
    stock_based_compensation: {
      type: ['number', 'null'],
      description: 'Stock/share-based compensation expense (use CASH FLOW STATEMENT value)',
    },
    impairment_charges: {
      type: ['number', 'null'],
      description: 'Impairment charges, asset write-downs',
    },
    goodwill_impairment: {
      type: ['number', 'null'],
      description: 'Goodwill impairment specifically',
    },
    unrealized_gains_losses: {
      type: ['number', 'null'],
      description: 'Unrealized gains/losses, mark-to-market adjustments',
    },
    deferred_compensation: {
      type: ['number', 'null'],
      description: 'Deferred compensation expense',
    },
    loss_on_disposal: {
      type: ['number', 'null'],
      description: 'Loss on disposal/sale of assets (positive = loss). If in parentheses, it is a GAIN - use gain_on_disposal instead.',
    },
    other_non_cash: {
      type: ['number', 'null'],
      description: 'Other non-cash expenses (straight-line rent, non-cash interest)',
    },
    // One-Time Expenses (ADD BACK)
    restructuring_costs: {
      type: ['number', 'null'],
      description: 'Restructuring, reorganization costs',
    },
    severance_costs: {
      type: ['number', 'null'],
      description: 'Severance payments',
    },
    transaction_costs: {
      type: ['number', 'null'],
      description: 'Transaction costs, deal costs, integration costs',
    },
    legal_settlements: {
      type: ['number', 'null'],
      description: 'Legal settlement expenses, litigation costs',
    },
    professional_fees_one_time: {
      type: ['number', 'null'],
      description: 'One-time professional/consulting fees',
    },
    casualty_losses: {
      type: ['number', 'null'],
      description: 'Casualty losses, disaster-related costs',
    },
    other_one_time_expenses: {
      type: ['number', 'null'],
      description: 'Other one-time, non-recurring expenses',
    },
    // Gains (SUBTRACT from EBITDA)
    gain_on_disposal: {
      type: ['number', 'null'],
      description: 'Gain on disposal/sale (extract as positive). Numbers in PARENTHESES on "Loss (gain)" lines are GAINS.',
    },
    gain_on_asset_sale: {
      type: ['number', 'null'],
      description: 'Gain on asset sale',
    },
    other_income_non_operating: {
      type: ['number', 'null'],
      description: 'Other non-operating income (extract as positive)',
    },
    insurance_proceeds: {
      type: ['number', 'null'],
      description: 'Insurance proceeds received',
    },
    other_one_time_gains: {
      type: ['number', 'null'],
      description: 'Settlement income, extraordinary gains',
    },
    // Foreign Exchange
    foreign_exchange_adjustments: {
      type: ['number', 'null'],
      description: 'FX gain/loss. Positive = loss (add back). Negative = gain (subtract). See parentheses rules.',
    },
    // Owner/Management
    owner_compensation_adjustment: {
      type: ['number', 'null'],
      description: 'Owner compensation, excess compensation, family payroll adjustments',
    },
    related_party_adjustments: {
      type: ['number', 'null'],
      description: 'Related-party expense adjustments',
    },
    management_fees_adjustment: {
      type: ['number', 'null'],
      description: 'Management fee adjustments',
    },
    // Other
    accounting_policy_adjustments: {
      type: ['number', 'null'],
      description: 'Changes in accounting policy/estimates',
    },
    pro_forma_cost_savings: {
      type: ['number', 'null'],
      description: 'Pro forma cost savings, run-rate adjustments',
    },
    pro_forma_synergies: {
      type: ['number', 'null'],
      description: 'Synergies, operational efficiencies',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-year metric schema (reused inside the years array)
// ─────────────────────────────────────────────────────────────────────────────

const yearMetricsSchema = {
  type: 'object' as const,
  properties: {
    fiscal_year: {
      type: 'string',
      description: 'The fiscal year label exactly as printed in the document (e.g., "2023", "FY2023", "Year ended Dec 31, 2022")',
    },
    fiscal_year_end_date: {
      type: ['string', 'null'],
      description: 'ISO date of fiscal year end (YYYY-MM-DD or YYYY-MM). Derive from document header if possible.',
    },
    fiscal_period_type: {
      type: ['string', 'null'],
      enum: ['annual', 'interim', 'quarterly', null],
      description: 'Type of fiscal period: annual (10-K), quarterly (10-Q), or interim (semi-annual)',
    },

    // ── Income Statement ──────────────────────────────────────────────────────
    revenue: {
      type: ['number', 'null'],
      description: 'Total revenue / net sales / turnover, normalized to thousands USD',
    },
    net_income: {
      type: ['number', 'null'],
      description: 'Net income / net profit (can be negative), normalized to thousands USD',
    },
    expenses: {
      type: ['number', 'null'],
      description: 'Total operating expenses (excluding COGS if separated), normalized to thousands USD',
    },
    profit_margins: {
      type: ['number', 'null'],
      description: 'Net profit margin as decimal (0.15 = 15%). Calculate as net_income / revenue if not stated.',
    },
    interest: {
      type: ['number', 'null'],
      description: 'TOTAL finance costs / interest expense from Income Statement. ALWAYS positive. Look for "Finance costs" (IFRS) or "Interest expense" (GAAP). Normalized to thousands USD.',
    },
    taxes: {
      type: ['number', 'null'],
      description: 'Income tax expense from Income Statement. Normalized to thousands USD.',
    },
    depreciation_amortization: {
      type: ['number', 'null'],
      description: 'TOTAL D&A - sum ALL depreciation/amortization from ALL sections (Direct expenses, Operating expenses, Other expenses, AND cash flow statement). Normalized to thousands USD.',
    },
    depreciation_equipment: {
      type: ['number', 'null'],
      description: 'Depreciation on equipment / property / machinery / security towers only. Normalized to thousands USD.',
    },
    depreciation_rou: {
      type: ['number', 'null'],
      description: 'Depreciation on right-of-use / IFRS 16 / ROU lease assets only. Normalized to thousands USD.',
    },
    depreciation_other: {
      type: ['number', 'null'],
      description: 'Other depreciation (buildings, leasehold improvements). Normalized to thousands USD.',
    },

    // ── EBITDA ────────────────────────────────────────────────────────────────
    // NOTE: We calculate EBITDA and Adjusted EBITDA from components.
    // These fields are DEPRECATED for vision extraction - always use null.
    ebitda: {
      type: ['number', 'null'],
      description: 'DEPRECATED: Always use null. EBITDA will be calculated from: net_income + interest + taxes + depreciation_amortization.',
    },
    reported_adjusted_ebitda: {
      type: ['number', 'null'],
      description: 'DEPRECATED: Always use null. Adjusted EBITDA will be calculated from EBITDA + adjusted_ebitda_components.',
    },

    // ── Balance Sheet ─────────────────────────────────────────────────────────
    shareholders_equity: {
      type: ['number', 'null'],
      description: 'Total shareholders equity / owners equity / net assets (common stock + retained earnings + AOCI). Normalized to thousands USD.',
    },
    total_debt: {
      type: ['number', 'null'],
      description: 'TOTAL debt = ALL interest-bearing borrowings (bank + notes + bonds + leases + subordinated). NOT the same as senior_debt. Normalized to thousands USD.',
    },
    senior_debt: {
      type: ['number', 'null'],
      description: 'SENIOR debt ONLY = bank_debt (current + long-term) + lease_liabilities. Excludes notes payable, subordinated debt. If not explicitly broken out, use null - do NOT copy total_debt. Normalized to thousands USD.',
    },
    current_assets: {
      type: ['number', 'null'],
      description: 'Total current assets from Balance Sheet. Normalized to thousands USD.',
    },
    current_liabilities: {
      type: ['number', 'null'],
      description: 'Total current liabilities from Balance Sheet. Normalized to thousands USD.',
    },

    // ── Cash Flow ─────────────────────────────────────────────────────────────
    capital_expenditures: {
      type: ['number', 'null'],
      description: 'CapEx from Cash Flow Statement Investing activities. "Purchase of PP&E", "Capital additions". Positive value. Normalized to thousands USD.',
    },
    proceeds_from_long_term_debt: {
      type: ['number', 'null'],
      description: 'Proceeds from debt from Cash Flow Statement Financing activities. Normalized to thousands USD.',
    },
    cash_taxes_paid: {
      type: ['number', 'null'],
      description: 'Cash taxes paid from Cash Flow Statement Operating activities. Normalized to thousands USD.',
    },
    distributions_paid: {
      type: ['number', 'null'],
      description: 'Dividends / distributions paid from Cash Flow Statement Financing activities. Normalized to thousands USD.',
    },
    ttm_principal_payments: {
      type: ['number', 'null'],
      description: 'TOTAL principal repayments = repayment_of_debt + payment_of_lease_liability. Normalized to thousands USD.',
    },
    ttm_interest_expense: {
      type: ['number', 'null'],
      description: 'Total interest expense for the period from Income Statement. Normalized to thousands USD.',
    },
    repayment_of_debt: {
      type: ['number', 'null'],
      description: 'Repayment of bank debt (NOT lease payments) from Cash Flow Statement. Positive value. Normalized to thousands USD.',
    },
    payment_of_lease_liability: {
      type: ['number', 'null'],
      description: 'Payment of lease liability from Cash Flow Statement. SEPARATE from bank debt repayment. Positive value. Normalized to thousands USD.',
    },
    cash_interest_paid: {
      type: ['number', 'null'],
      description: 'Cash interest paid from Cash Flow Statement supplementary info. Normalized to thousands USD.',
    },
    non_cash_interest_expense: {
      type: ['number', 'null'],
      description: 'Non-cash interest (accretion, debt discount amortization). Normalized to thousands USD.',
    },

    // ── Nested breakdowns ─────────────────────────────────────────────────────
    debt_components: {
      ...debtComponentsSchema,
      description: 'Breakdown of debt by type. Extract individual line items from Balance Sheet and debt notes.',
    },
    fixed_charges: {
      ...fixedChargesSchema,
      description: 'Fixed charges breakdown. Extract from Income Statement, Cash Flow, and Notes.',
    },
    adjusted_ebitda_components: {
      ...adjustedEbitdaComponentsSchema,
      description: 'EBITDA adjustment line items from any reconciliation table or bridge.',
    },
  },
  required: ['fiscal_year'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Top-level tool schema
// ─────────────────────────────────────────────────────────────────────────────

export const extractionToolSchema = {
  type: 'object' as const,
  properties: {
    scale_note: {
      type: 'string',
      description:
        'Describe the unit of measurement detected (e.g., "All figures in thousands USD per header", "Figures in full dollars - divided by 1000"). This helps downstream validation.',
    },
    years: {
      type: 'array',
      description:
        'One entry per fiscal year column found on this page. A page with 2021 | 2022 | 2023 columns should produce three entries.',
      items: yearMetricsSchema,
      minItems: 1,
    },
  },
  required: ['years'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────────────────────────────────────

export const EXTRACTION_TOOL: Tool = {
  name: 'extract_financial_metrics',
  description: `Extract financial metrics from a financial document image. See the detailed EXTRACTION_PROMPT for complete instructions.

CRITICAL RULES:
- Normalize ALL monetary values to THOUSANDS USD
- Interest expense MUST be positive (convert if shown negative)
- ebitda and reported_adjusted_ebitda: ALWAYS use null - we calculate these from components
- senior_debt and total_debt are DIFFERENT - senior excludes subordinated notes
- Extract ALL fiscal year columns visible on the page
- Focus on COMPONENTS: net_income, interest, taxes, depreciation, adjusted_ebitda_components`,
  input_schema: extractionToolSchema,
};

// ─────────────────────────────────────────────────────────────────────────────
// Extraction prompt - Ported from lib/prompts/extraction-prompt.ts
// ─────────────────────────────────────────────────────────────────────────────

export const EXTRACTION_PROMPT = `You are a deterministic **financial-statement extraction engine** analyzing a document image.
The image may come from any kind of financial filing (annual report, 10-K, MD&A, notes, balance sheet, cash flow statement, etc.).

═══════════════════════════════════════════════════════════════════════════════
STEP 1: IDENTIFY SCALE AND UNITS
═══════════════════════════════════════════════════════════════════════════════

Look for a header, footnote, or statement indicating units:
  "($ in thousands)", "(in millions)", "Amounts in thousands of Canadian dollars", etc.

NORMALIZATION RULES:
- If header says "(in thousands)" → use values as-is
- If header says "(in millions)" → multiply each value by 1,000
- If no unit label and values look like full dollars (e.g., revenue = 45,000,000) → divide by 1,000
- Record your inference in scale_note field

═══════════════════════════════════════════════════════════════════════════════
STEP 2: IDENTIFY ALL FISCAL YEAR COLUMNS
═══════════════════════════════════════════════════════════════════════════════

Financial statements typically show 2-3 years side-by-side. Identify EVERY year column header.
Return one entry per column in the years array.

FISCAL YEAR END DATE (fiscal_year_end_date):
- Cover page: "For the Year Ended December 31, 2024" → "2024-12-31"
- Header: "Fiscal Year Ending March 31, 2024" → "2024-03-31"
- If only year visible, assume calendar year end: "2024" → "2024-12-31"

FISCAL PERIOD TYPE (fiscal_period_type):
- "annual": Full fiscal year (10-K, Annual Report)
- "quarterly": Quarterly report (10-Q, Q1/Q2/Q3/Q4)
- "interim": Semi-annual, half-year reports

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: PARENTHESES CONVENTION IN FINANCIAL STATEMENTS
═══════════════════════════════════════════════════════════════════════════════

Numbers in parentheses = OPPOSITE of the label:
- "Loss (gain) on sale (139)" = GAIN of 139 (parentheses reverse "loss" to "gain")
- "Foreign exchange (gain) loss (2)" = GAIN of 2
- "Other income (2,159)" = INCOME of 2,159

LOSS vs GAIN EXTRACTION:
- "Loss (gain) on sale 27" → 27 is a LOSS → put in loss_on_disposal as positive 27
- "Loss (gain) on sale (139)" → 139 is a GAIN → put in gain_on_disposal as positive 139
- NEVER put the same value in both loss_on_disposal AND gain_on_disposal

FOREIGN EXCHANGE:
- "Foreign exchange (gain) loss 70" → 70 is a LOSS → extract as POSITIVE 70 (add back to EBITDA)
- "Foreign exchange (gain) loss (2)" → 2 is a GAIN → extract as NEGATIVE -2 (subtract from EBITDA)

═══════════════════════════════════════════════════════════════════════════════
INCOME STATEMENT EXTRACTION
═══════════════════════════════════════════════════════════════════════════════

REVENUE: Total revenue / net sales / turnover

NET INCOME: Net income / net profit (can be negative)

INTEREST (CRITICAL):
- Extract TOTAL finance costs / interest expense from Income Statement
- Look for "Finance costs" (IFRS) or "Interest expense" (US GAAP)
- For statements with "Other (income) expenses" section, look there for "Finance costs"
- MUST be POSITIVE (if shown negative or in brackets, convert to positive)

TAXES: Current income tax expense (may be zero or recovery)

DEPRECIATION & AMORTIZATION (CRITICAL):
- MUST equal SUM of ALL D&A lines across ALL sections
- Check: Direct expenses section, Operating expenses section, Other expenses section
- Also check Cash Flow Statement operating activities for total D&A
- depreciation_amortization SHOULD equal: depreciation_equipment + depreciation_rou + depreciation_other

DEPRECIATION BREAKDOWN:
- depreciation_equipment: "Depreciation of equipment", "Equipment depreciation", "Depreciation of security towers"
- depreciation_rou: "Depreciation of right-of-use assets", "ROU depreciation"
- depreciation_other: "Depreciation of other property", "Building depreciation", "Leasehold improvements"

═══════════════════════════════════════════════════════════════════════════════
EBITDA COMPONENTS (WE CALCULATE EBITDA - YOU EXTRACT COMPONENTS)
═══════════════════════════════════════════════════════════════════════════════

IMPORTANT: Do NOT extract "EBITDA" or "Adjusted EBITDA" values directly.
Set both ebitda and reported_adjusted_ebitda to NULL.

We will CALCULATE these values from the components you extract:

EBITDA = net_income + interest + taxes + depreciation_amortization

Adjusted EBITDA = EBITDA + adjusted_ebitda_components (non-cash, one-time items)

YOUR JOB: Extract these components ACCURATELY:
1. net_income - Net income / net profit from income statement
2. interest - Total interest expense / finance costs (MUST be positive)
3. taxes - Income tax expense
4. depreciation_amortization - Total D&A (sum ALL depreciation from ALL sections)
5. depreciation_equipment, depreciation_rou, depreciation_other - Individual D&A breakdown
6. adjusted_ebitda_components - All adjustment items (stock comp, restructuring, gains/losses, etc.)

═══════════════════════════════════════════════════════════════════════════════
ADJUSTED EBITDA COMPONENTS (CRITICAL FOR ACCURACY)
═══════════════════════════════════════════════════════════════════════════════

These components are used to CALCULATE Adjusted EBITDA. Extract ALL visible items:
- Look in Income Statement for: stock compensation, impairment, restructuring, FX gains/losses
- Look in Cash Flow Statement for: stock-based compensation (more reliable than income statement)
- Look in Notes for: one-time items, non-recurring charges, management adjustments

NON-CASH ADJUSTMENTS (ADD BACK to EBITDA):
- stock_based_compensation: Use CASH FLOW STATEMENT value under "Operating activities". Look for "Stock based compensation" or "Share-based compensation". This is TOTAL non-cash stock compensation.
- impairment_charges: "impairment", "asset write-down"
- goodwill_impairment: "goodwill impairment"
- unrealized_gains_losses: "unrealized loss/gain", "mark-to-market"
- deferred_compensation: "deferred compensation"
- loss_on_disposal: Sum ALL disposal LOSSES. ONLY include where number is POSITIVE (not in parentheses). If in parentheses, it's a GAIN - use gain_on_disposal instead.
- other_non_cash: "non-cash expense", "straight-line rent"

ONE-TIME EXPENSES (ADD BACK):
- restructuring_costs: "restructuring", "reorganization"
- severance_costs: "severance"
- transaction_costs: "transaction costs", "deal costs", "integration costs"
- legal_settlements: "legal settlement", "litigation expense"
- professional_fees_one_time: one-time "professional fees"
- casualty_losses: "casualty loss", "disaster costs"
- other_one_time_expenses: "one-time expense", "non-recurring expense"

SUBTRACT FROM EBITDA (these inflate net income):
- gain_on_disposal: Sum ALL disposal GAINS. When "Loss (gain) on sale" shows number in PARENTHESES like (139), that's a GAIN - extract as positive 139.
- gain_on_asset_sale: "gain on sale"
- other_income_non_operating: "Other income" on income statement. Values in parentheses like (2,159) mean income - extract as positive.
- insurance_proceeds: "insurance proceeds"
- other_one_time_gains: "settlement income", "extraordinary gain"

FOREIGN EXCHANGE (CRITICAL):
- foreign_exchange_adjustments: "Foreign exchange (gain) loss" or "FX gain/loss"
  - POSITIVE number (e.g., 70) = LOSS → extract as POSITIVE (add back)
  - In PARENTHESES (e.g., (2)) = GAIN → extract as NEGATIVE (subtract)

OWNER/MANAGEMENT ADJUSTMENTS:
- owner_compensation_adjustment: "owner compensation", "excess compensation"
- related_party_adjustments: "related-party expense"
- management_fees_adjustment: "management fees"

NOTE: bad_debt_provision is a CORE OPERATING EXPENSE - do NOT add it back to EBITDA.

═══════════════════════════════════════════════════════════════════════════════
BALANCE SHEET EXTRACTION
═══════════════════════════════════════════════════════════════════════════════

SHAREHOLDERS EQUITY: Total shareholders equity / owners equity / net assets

CURRENT ASSETS: Total current assets (cash + receivables + inventory + prepaid)

CURRENT LIABILITIES: Total current liabilities (payables + accrued + current debt + current leases)

═══════════════════════════════════════════════════════════════════════════════
DEBT EXTRACTION (CRITICAL FOR ACCURACY)
═══════════════════════════════════════════════════════════════════════════════

COMPLETENESS CHECK - You MUST extract ALL of these if present:
1. Bank debt / credit facilities (current AND long-term portions)
2. Term loans
3. Lease liabilities (current AND long-term - often shown separately from bank debt)
4. Notes payable / vendor take-back notes (often listed last - DO NOT MISS)
5. Subordinated debt / mezzanine debt
6. Bonds / debentures

COMMON MISS: Notes payable and lease liabilities are often on SEPARATE lines or even
separate pages. Look in the Notes to Financial Statements (e.g., "Note 8: Debt",
"Note 9: Lease Liabilities", "Note 10: Note Payable"). Sum ALL components.

DOCUMENT ORDER INDICATES SENIORITY:
- Items listed FIRST (top of debt section) = Most senior (secured bank debt)
- Items listed in MIDDLE = Typically senior secured (leases, term loans)
- Items listed LAST (bottom) = Usually subordinated (notes payable, mezzanine)

DEBT COMPONENTS (debt_components) - Extract individual lines:

SENIOR DEBT (highest priority, listed first):
- bank_debt_current: Current portion of bank debt, credit facilities, term loans due within 1 year
- bank_debt_long_term: Long-term bank debt, term loans due after 1 year
- term_loans: Named term loans at specific interest rates
- revolving_credit_facilities: Revolving equipment financing, revolving credit
- overdraft_facilities: Authorized overdraft, bank overdraft
- lines_of_credit: General lines of credit
- lease_liabilities_current: Current lease liabilities (operating + finance)
- lease_liabilities_long_term: Non-current lease liabilities
- finance_lease_liabilities: Finance/capital lease obligations
- operating_lease_liabilities: Operating lease liabilities (IFRS 16/ASC 842)

SUBORDINATED/JUNIOR DEBT (lower priority, listed last):
- notes_payable: Notes payable, promissory notes, vendor take-back notes
- subordinated_debt: Explicitly subordinated, mezzanine, junior debt
- convertible_debt: Convertible notes/bonds
- bonds_debentures: Corporate bonds, debentures
- other_borrowings: Any other debt

CRITICAL CALCULATION RULES:
- senior_debt = bank_debt (current + long-term) + ALL lease_liabilities (current + long-term)
- Notes payable (especially vendor take-back) are NOT senior debt
- total_debt = senior_debt + notes_payable + subordinated_debt + other non-senior debt
- If document shows "Current debt" and "Long term debt" line items, these typically refer to bank debt only, NOT lease liabilities
- Lease liabilities are often shown separately

═══════════════════════════════════════════════════════════════════════════════
FIXED CHARGES EXTRACTION (fixed_charges) - CRITICAL FOR FCCR
═══════════════════════════════════════════════════════════════════════════════

INTEREST COMPONENTS:
- senior_debt_interest: Interest on bank debt, credit facilities. Look for "Interest on bank indebtedness" in notes.
- subordinated_debt_interest: Interest on subordinated notes, vendor take-back notes
- lease_interest: Interest portion of lease payments ("Interest on lease liabilities" in finance costs)
- total_interest_expense: TOTAL interest/finance costs from income statement (validation/fallback)
- senior_debt_interest_rate: If disclosed (e.g., "prime + 2%", "8%")

LEASE PAYMENTS (ANNUAL only, NOT total future):
- minimum_lease_payments: ANNUAL lease payment. Look for:
  - Cash flow statement: "Payment of lease liability", "Lease payments" - actual cash paid
  - Lease maturity schedule: ONLY the first/current year amount
  - WARNING: Do NOT extract "Total minimum lease payments" or multi-year totals
  - Annual payment is typically 5-15% of total lease liabilities
- finance_lease_payments: Finance/capital lease payments if separate
- operating_lease_payments: Operating lease payments if separate

OTHER:
- principal_payments: "Repayment of debt" or "Principal repayments" from cash flow
- preferred_dividends: Preferred share dividends
- other_fixed_charges: Other recurring fixed obligations

═══════════════════════════════════════════════════════════════════════════════
CASH FLOW STATEMENT EXTRACTION
═══════════════════════════════════════════════════════════════════════════════

From INVESTING ACTIVITIES:
- capital_expenditures: "Purchase of PP&E", "Capital additions", "Acquisition of fixed assets". Extract as POSITIVE.

From FINANCING ACTIVITIES:
- proceeds_from_long_term_debt: "Proceeds from long-term debt", "Proceeds from credit facilities"
- repayment_of_debt: "Repayment of debt", "Repayment of bank indebtedness" (bank debt only, NOT leases). POSITIVE value.
- payment_of_lease_liability: "Payment of lease liability", "Repayment of lease obligations". SEPARATE from bank debt. POSITIVE value.
- distributions_paid: "Dividends paid", "Distributions to shareholders"

From OPERATING ACTIVITIES or SUPPLEMENTARY INFO:
- cash_taxes_paid: "Income taxes paid", "Cash taxes paid"
- cash_interest_paid: "Cash interest paid", "Interest paid"
- non_cash_interest_expense: "Non-cash interest expense", "Accretion of discount"

DEBT SERVICE TOTALS:
- ttm_principal_payments: TOTAL = repayment_of_debt + payment_of_lease_liability
- ttm_interest_expense: TOTAL interest expense from income statement

═══════════════════════════════════════════════════════════════════════════════
FINAL RULES
═══════════════════════════════════════════════════════════════════════════════

- Extract values EXACTLY as they appear after scale normalization
- Use null for any value not visible - do NOT estimate or calculate
- EBITDA and Adjusted EBITDA are DIFFERENT - never conflate
- senior_debt and total_debt are DIFFERENT - never conflate
- Interest expense MUST be positive
- Extract ALL fiscal year columns visible on the page
- Record your scale inference in scale_note

Call extract_financial_metrics with all findings.`;
