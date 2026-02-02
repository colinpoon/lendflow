/**
 * FCCR (Fixed Charge Coverage Ratio) calculation utilities
 * Lender-defined formula for debt servicing capacity
 *
 * Supports configurable CapEx treatment:
 * - 'unfunded': Deduct only unfunded CapEx (CapEx - Proceeds from LT Debt) - DEFAULT
 * - 'all': Deduct 100% of CapEx regardless of funding
 * - 'none': Exclude CapEx entirely from calculation
 * - 'custom': Deduct a custom percentage of CapEx
 */

import type {
  ExtractedMetrics,
  FCCRBreakdown,
  CapexTreatmentMode,
  CapexTreatmentConfig,
} from '@/types';

export interface FCCRCalculationResult {
  fccr: number | null;
  fccr_numerator: number | null;
  total_fixed_charges: number | null;
  cash_flow_for_debt_servicing: number | null;
  fccr_breakdown: FCCRBreakdown | null;
}

/** Default CapEx treatment configuration */
export const DEFAULT_CAPEX_TREATMENT: CapexTreatmentConfig = {
  mode: 'unfunded',
};

/**
 * Calculate the CapEx deduction based on treatment mode
 *
 * @param capitalExpenditures - Total CapEx from cash flow statement
 * @param proceedsFromLTDebt - Proceeds from long-term debt issuance
 * @param config - CapEx treatment configuration
 * @returns The amount to deduct from EBITDA
 */
export function calculateCapexDeduction(
  capitalExpenditures: number,
  proceedsFromLTDebt: number,
  config: CapexTreatmentConfig
): number {
  switch (config.mode) {
    case 'all':
      // Deduct 100% of CapEx
      return capitalExpenditures;

    case 'none':
      // Don't deduct any CapEx
      return 0;

    case 'custom':
      // Deduct a custom percentage of CapEx
      const percentage = config.customPercentage ?? 0;
      return capitalExpenditures * (percentage / 100);

    case 'unfunded':
    default:
      // Deduct only unfunded CapEx (CapEx - Proceeds from LT Debt)
      return Math.max(0, capitalExpenditures - proceedsFromLTDebt);
  }
}

/**
 * Calculate Fixed Charge Coverage Ratio (FCCR)
 *
 * Lender-defined formula:
 * - CapEx Deduction = Based on treatment mode (unfunded, all, none, or custom %)
 * - Numerator = Adjusted EBITDA - CapEx Deduction - Cash Taxes - Distributions
 * - Denominator = TTM Principal Payments + TTM Interest Expense
 * - FCCR = Numerator / Denominator
 *
 * @param adjustedEbitda - The adjusted EBITDA value (or regular EBITDA as fallback)
 * @param metrics - The extracted financial metrics
 * @param capexConfig - Optional CapEx treatment configuration (defaults to 'unfunded')
 */
export function calculateFCCR(
  adjustedEbitda: number | null,
  metrics: ExtractedMetrics,
  capexConfig: CapexTreatmentConfig = DEFAULT_CAPEX_TREATMENT
): FCCRCalculationResult {
  // Cannot calculate without EBITDA
  if (adjustedEbitda == null) {
    return {
      fccr: null,
      fccr_numerator: null,
      total_fixed_charges: null,
      cash_flow_for_debt_servicing: null,
      fccr_breakdown: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Numerator Components
  // ─────────────────────────────────────────────────────────────────────────

  // Get raw CapEx values
  const capitalExpenditures = metrics.capital_expenditures ?? 0;
  const proceedsFromLTDebt = metrics.proceeds_from_long_term_debt ?? 0;

  // Calculate unfunded CapEx (for reference, even if not using it)
  const unfundedCapex = Math.max(0, capitalExpenditures - proceedsFromLTDebt);

  // Calculate actual CapEx deduction based on treatment mode
  const capexDeduction = calculateCapexDeduction(
    capitalExpenditures,
    proceedsFromLTDebt,
    capexConfig
  );

  // Cash Taxes and Distributions
  const cashTaxesPaid = metrics.cash_taxes_paid ?? 0;
  const distributionsPaid = metrics.distributions_paid ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Denominator Components (TTM Debt Service)
  // ─────────────────────────────────────────────────────────────────────────

  // TTM Principal Payments - from cash flow statement financing activities
  // Fallback chain: ttm_principal_payments → repayment_of_debt
  const ttmPrincipalPayments =
    metrics.ttm_principal_payments ?? metrics.repayment_of_debt ?? 0;

  // TTM Interest Expense - prefer cash basis, fallback to accrual
  // Fallback chain: ttm_interest_expense → cash_interest_paid → interest
  const ttmInterestExpense =
    metrics.ttm_interest_expense ?? metrics.cash_interest_paid ?? metrics.interest ?? 0;

  // Lease payments (included in fixed charges for FCCR)
  const leasePayments = metrics.payment_of_lease_liability ?? 0;

  // Total Debt Service = Principal + Interest + Lease Payments
  const totalDebtService = ttmPrincipalPayments + ttmInterestExpense + leasePayments;

  // Cannot calculate without debt service
  if (totalDebtService === 0) {
    return {
      fccr: null,
      fccr_numerator: null,
      total_fixed_charges: null,
      cash_flow_for_debt_servicing: null,
      fccr_breakdown: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate FCCR
  // ─────────────────────────────────────────────────────────────────────────

  // Numerator: Cash Flow Available for Debt Servicing
  // Uses the configured CapEx deduction (unfunded, all, none, or custom)
  const numerator =
    adjustedEbitda - capexDeduction - cashTaxesPaid - distributionsPaid;

  // FCCR = Numerator / Denominator
  const fccr = parseFloat((numerator / totalDebtService).toFixed(2));

  return {
    fccr,
    fccr_numerator: parseFloat(numerator.toFixed(2)),
    total_fixed_charges: parseFloat(totalDebtService.toFixed(2)),
    cash_flow_for_debt_servicing: parseFloat(numerator.toFixed(2)),
    fccr_breakdown: {
      calculation_type: 'lender_defined',
      // CapEx treatment info
      capex_treatment: capexConfig.mode,
      ...(capexConfig.mode === 'custom' && {
        capex_custom_percentage: capexConfig.customPercentage,
      }),
      // Numerator components
      adjusted_ebitda: adjustedEbitda,
      capital_expenditures: capitalExpenditures,
      proceeds_from_lt_debt: proceedsFromLTDebt,
      unfunded_capex: unfundedCapex,
      capex_deduction: capexDeduction,
      cash_taxes_paid: cashTaxesPaid,
      distributions_paid: distributionsPaid,
      numerator,
      // Denominator components
      ttm_principal_payments: ttmPrincipalPayments,
      ttm_interest_expense: ttmInterestExpense,
      lease_payments: leasePayments,
      denominator: totalDebtService,
    },
  };
}
