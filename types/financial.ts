/**
 * Financial metric type definitions
 * Centralized types for all financial data extracted and computed
 */

// ─────────────────────────────────────────────────────────────────────────────
// Debt Components
// ─────────────────────────────────────────────────────────────────────────────

export interface DebtComponents {
  // Senior Debt (highest priority)
  bank_debt_current: number | null;
  bank_debt_long_term: number | null;
  term_loans: number | null;
  revolving_credit_facilities: number | null;
  overdraft_facilities: number | null;
  lines_of_credit: number | null;

  // Lease Liabilities
  lease_liabilities_current: number | null;
  lease_liabilities_long_term: number | null;
  finance_lease_liabilities: number | null;
  operating_lease_liabilities: number | null;

  // Subordinated/Junior Debt
  notes_payable: number | null;
  subordinated_debt: number | null;
  convertible_debt: number | null;
  bonds_debentures: number | null;
  other_borrowings: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixed Charges
// ─────────────────────────────────────────────────────────────────────────────

export interface FixedCharges {
  // Interest Components
  senior_debt_interest: number | null;
  subordinated_debt_interest: number | null;
  lease_interest: number | null;
  total_interest_expense: number | null;
  senior_debt_interest_rate: number | null; // Extracted as decimal (e.g., 0.08 for 8%)

  // Lease Payments
  minimum_lease_payments: number | null;
  finance_lease_payments: number | null;
  operating_lease_payments: number | null;

  // Other Fixed Charges
  principal_payments: number | null;
  preferred_dividends: number | null;
  other_fixed_charges: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adjusted EBITDA Components
// ─────────────────────────────────────────────────────────────────────────────

export interface AdjustedEBITDAComponents {
  // Non-cash adjustments (add back)
  stock_based_compensation: number | null;
  impairment_charges: number | null;
  goodwill_impairment: number | null;
  unrealized_gains_losses: number | null;
  deferred_compensation: number | null;
  loss_on_disposal: number | null;
  other_non_cash: number | null;

  // One-time expenses (add back)
  restructuring_costs: number | null;
  severance_costs: number | null;
  transaction_costs: number | null;
  legal_settlements: number | null;
  professional_fees_one_time: number | null;
  casualty_losses: number | null;
  other_one_time_expenses: number | null;

  // One-time gains (subtract)
  gain_on_disposal: number | null;
  gain_on_asset_sale: number | null;
  other_income_non_operating: number | null;
  insurance_proceeds: number | null;
  other_one_time_gains: number | null;

  // Owner/management adjustments
  owner_compensation_adjustment: number | null;
  related_party_adjustments: number | null;
  management_fees_adjustment: number | null;

  // Other adjustments
  accounting_policy_adjustments: number | null;
  foreign_exchange_adjustments: number | null;
  pro_forma_cost_savings: number | null;
  pro_forma_synergies: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Breakdown Types (for display)
// ─────────────────────────────────────────────────────────────────────────────

export interface DebtBreakdown {
  bank_debt: number;
  lease_liabilities: number;
  notes_payable: number;
  subordinated_debt: number;
  other_non_senior_debt: number;
}

export interface AdjustedEBITDABreakdown {
  reported_ebitda: number;
  non_cash_adjustments: number;
  one_time_expenses: number;
  one_time_gains: number;
  owner_management_adjustments: number;
  accounting_adjustments: number;
  fx_adjustments: number;
  pro_forma_adjustments: number;
  capital_expenditures_not_in_calc: number;
  uses_reported_value: boolean;
}

/**
 * CapEx treatment modes for FCCR calculation
 * - 'unfunded': Deduct only unfunded CapEx (CapEx - Proceeds from LT Debt) - DEFAULT
 * - 'all': Deduct 100% of CapEx regardless of funding
 * - 'none': Exclude CapEx entirely from calculation
 * - 'custom': Deduct a custom percentage of CapEx
 */
export type CapexTreatmentMode = 'unfunded' | 'all' | 'none' | 'custom';

export interface CapexTreatmentConfig {
  mode: CapexTreatmentMode;
  customPercentage?: number; // 0-100, only used when mode is 'custom'
}

export interface FCCRBreakdown {
  calculation_type: 'lender_defined';
  // CapEx treatment used
  capex_treatment: CapexTreatmentMode;
  capex_custom_percentage?: number; // Only present when mode is 'custom'
  // Numerator components
  adjusted_ebitda: number;
  capital_expenditures: number;
  proceeds_from_lt_debt: number;
  unfunded_capex: number;
  capex_deduction: number; // The actual amount deducted based on treatment mode
  cash_taxes_paid: number;
  distributions_paid: number;
  numerator: number;
  // Denominator components
  ttm_principal_payments: number;
  ttm_interest_expense: number;
  lease_payments: number;
  denominator: number;
  // Source values for transparency (what was extracted vs fallback)
  sources?: {
    capital_expenditures_extracted: number | null;
    proceeds_from_lt_debt_extracted: number | null;
    cash_taxes_paid_extracted: number | null;
    distributions_paid_extracted: number | null;
    ttm_principal_payments_extracted: number | null;
    repayment_of_debt_fallback: number | null;
    ttm_interest_expense_extracted: number | null;
    cash_interest_paid_fallback: number | null;
    interest_accrual_fallback: number | null;
    lease_payments_extracted: number | null;
  };
}

export interface DSCRBreakdown {
  calculation_type: 'banker_covenant';
  // Numerator
  adjusted_ebitda: number;
  // Denominator components (bank debt service only)
  bank_principal_payments: number;
  bank_interest_expense: number;
  lease_payments: number;
  total_debt_service: number;
  // Result
  dscr: number;
  // Funded debt calculation
  funded_debt: number;
  funded_debt_to_ebitda: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracted Metrics (raw AI extraction)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fiscal period type for document classification
 */
export type FiscalPeriodType = 'annual' | 'interim' | 'quarterly';

export interface ExtractedMetrics {
  // Fiscal Year Metadata (for document recency comparison)
  fiscal_year_end_date?: string | null; // ISO date (YYYY-MM-DD) or partial (YYYY-MM)
  fiscal_period_type?: FiscalPeriodType | null;

  // Income Statement
  revenue: number | null;
  net_income: number | null;
  expenses: number | null;
  profit_margins: number | null;
  interest: number | null;
  taxes: number | null;
  depreciation_amortization: number | null;

  // Depreciation breakdown (critical for banker's EBITDA)
  depreciation_equipment: number | null;
  depreciation_rou: number | null;
  depreciation_other: number | null;

  // EBITDA
  ebitda: number | null;
  reported_adjusted_ebitda: number | null;

  // Balance Sheet
  shareholders_equity: number | null;
  total_debt: number | null;
  senior_debt: number | null;
  current_assets: number | null;
  current_liabilities: number | null;

  // Cash Flow Items (for FCCR)
  capital_expenditures: number | null;
  proceeds_from_long_term_debt: number | null;
  cash_taxes_paid: number | null;
  distributions_paid: number | null;
  ttm_principal_payments: number | null;
  ttm_interest_expense: number | null;

  // Cash flow for DSCR (banker's method)
  repayment_of_debt: number | null;
  payment_of_lease_liability: number | null;
  cash_interest_paid: number | null;
  non_cash_interest_expense: number | null;

  // Nested components
  debt_components: DebtComponents | null;
  fixed_charges: FixedCharges | null;
  adjusted_ebitda_components: AdjustedEBITDAComponents | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Computed Metrics (includes calculated ratios)
// ─────────────────────────────────────────────────────────────────────────────

export interface ComputedMetrics extends ExtractedMetrics {
  // Computed EBITDA values
  ebitda_calculated?: boolean;
  adjusted_ebitda: number | null;
  calculated_adjusted_ebitda: number | null;

  // Computed ratios
  fccr: number | null;
  fccr_numerator: number | null;
  total_fixed_charges: number | null;
  cash_flow_for_debt_servicing: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  interest_coverage_ratio: number | null;
  debt_to_equity_ratio: number | null;
  current_ratio: number | null;

  // Banker's covenant ratios (NEW)
  dscr: number | null; // Debt Service Coverage Ratio (Adjusted EBITDA / Total Debt Service)
  funded_debt: number | null; // Bank debt only (excludes subordinated notes)
  funded_debt_to_ebitda: number | null; // Funded Debt / Adjusted EBITDA

  // Breakdowns for display
  debt_breakdown: DebtBreakdown | null;
  adjusted_ebitda_breakdown: AdjustedEBITDABreakdown | null;
  fccr_breakdown: FCCRBreakdown | null;
  dscr_breakdown: DSCRBreakdown | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Data Structures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Financial data organized by fiscal year
 */
export interface FinancialData {
  metrics_by_year: Record<string, ComputedMetrics>;
}

/**
 * Alias for backward compatibility with components
 */
export type YearMetrics = ComputedMetrics;

/**
 * Props for components that receive financial data
 */
export interface FinancialDataProps {
  data: FinancialData | null;
}
