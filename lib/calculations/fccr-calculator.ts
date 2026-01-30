/**
 * FCCR (Fixed Charge Coverage Ratio) calculation utilities
 * Lender-defined formula for debt servicing capacity
 */

import type { ExtractedMetrics, FCCRBreakdown } from '@/types';

export interface FCCRCalculationResult {
  fccr: number | null;
  fccr_numerator: number | null;
  total_fixed_charges: number | null;
  cash_flow_for_debt_servicing: number | null;
  fccr_breakdown: FCCRBreakdown | null;
}

/**
 * Calculate Fixed Charge Coverage Ratio (FCCR)
 *
 * Lender-defined formula:
 * - Unfunded CapEx = Purchase of PP&E - Proceeds from Long-term Debt
 * - Numerator = Adjusted EBITDA - Unfunded CapEx - Cash Taxes - Distributions
 * - Denominator = TTM Principal Payments + TTM Interest Expense
 * - FCCR = Numerator / Denominator
 *
 * @param adjustedEbitda - The adjusted EBITDA value (or regular EBITDA as fallback)
 * @param metrics - The extracted financial metrics
 */
export function calculateFCCR(
  adjustedEbitda: number | null,
  metrics: ExtractedMetrics
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

  // Unfunded CapEx = PP&E Purchases - Proceeds from Long-term Debt
  // This offsets CapEx with new debt raised to fund it
  const capitalExpenditures = metrics.capital_expenditures ?? 0;
  const proceedsFromLTDebt = metrics.proceeds_from_long_term_debt ?? 0;
  const unfundedCapex = Math.max(0, capitalExpenditures - proceedsFromLTDebt);

  // Cash Taxes and Distributions
  const cashTaxesPaid = metrics.cash_taxes_paid ?? 0;
  const distributionsPaid = metrics.distributions_paid ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Denominator Components (TTM Debt Service)
  // ─────────────────────────────────────────────────────────────────────────

  // TTM Principal Payments - from cash flow statement financing activities
  const ttmPrincipalPayments = metrics.ttm_principal_payments ?? 0;

  // TTM Interest Expense - from income statement (fallback to extracted interest)
  const ttmInterestExpense = metrics.ttm_interest_expense ?? metrics.interest ?? 0;

  // Total Debt Service = Principal + Interest
  const totalDebtService = ttmPrincipalPayments + ttmInterestExpense;

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
  const numerator =
    adjustedEbitda - unfundedCapex - cashTaxesPaid - distributionsPaid;

  // FCCR = Numerator / Denominator
  const fccr = parseFloat((numerator / totalDebtService).toFixed(2));

  return {
    fccr,
    fccr_numerator: parseFloat(numerator.toFixed(2)),
    total_fixed_charges: parseFloat(totalDebtService.toFixed(2)),
    cash_flow_for_debt_servicing: parseFloat(numerator.toFixed(2)),
    fccr_breakdown: {
      calculation_type: 'lender_defined',
      // Numerator components
      adjusted_ebitda: adjustedEbitda,
      capital_expenditures: capitalExpenditures,
      proceeds_from_lt_debt: proceedsFromLTDebt,
      unfunded_capex: unfundedCapex,
      cash_taxes_paid: cashTaxesPaid,
      distributions_paid: distributionsPaid,
      numerator,
      // Denominator components
      ttm_principal_payments: ttmPrincipalPayments,
      ttm_interest_expense: ttmInterestExpense,
      denominator: totalDebtService,
    },
  };
}
