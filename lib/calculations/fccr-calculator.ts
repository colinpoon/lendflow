/**
 * Covenant FCCR (Fixed Charge Coverage Ratio) calculation utilities
 * Lender-defined formula for debt servicing capacity
 *
 * NOTE: This is the lender/covenant-style FCCR, NOT the Moody's/S&P rating-agency
 * definition. The standard rating-agency FCCR uses EBITDA(R) / (Interest + Debt
 * Repayments + Leases + Preferred Dividends). Our formula deducts CapEx, cash taxes,
 * and distributions from the numerator to represent true cash available for debt service,
 * which matches the covenant test structure in most commercial loan agreements.
 *
 * Supports configurable CapEx treatment:
 * - 'unfunded': Deduct only unfunded CapEx (CapEx - Proceeds from LT Debt) - DEFAULT
 * - 'all': Deduct 100% of CapEx regardless of funding
 * - 'none': Exclude CapEx entirely from calculation
 * - 'custom': Deduct a custom percentage of CapEx
 *
 * Covenant FCCR Formula:
 * Numerator = Adjusted EBITDA - Unfunded CapEx - Cash Taxes
 * Denominator = Principal Payments + Interest Expense + Lease Payments
 * FCCR = Numerator / Denominator
 *
 * Note: Distributions are NOT deducted from the numerator. They are discretionary
 * and are typically restricted BY the covenant, not included IN the coverage calc.
 *
 * Reference Value (Zedcor FY2024): FCCR >= 1.15x (per covenant compliance)
 */

import type {
  ExtractedMetrics,
  FCCRBreakdown,
  CapexTreatmentConfig,
  OperatingLeaseConfig,
} from '@/types';
import { resolveDebtService } from './debt-service-resolver';

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
    default: {
      // Deduct unfunded CapEx (CapEx - Proceeds from LT Debt)
      // Floor at 0: negative means debt proceeds exceed CapEx (surplus cash),
      // which should not inflate the numerator.
      const unfunded = capitalExpenditures - proceedsFromLTDebt;
      if (unfunded < 0) {
        console.warn(
          `⚠️ CAPEX FLOOR: Unfunded CapEx is negative (${unfunded}) — ` +
          `proceeds (${proceedsFromLTDebt}) exceed CapEx (${capitalExpenditures}). ` +
          `Flooring at 0 to prevent numerator inflation.`
        );
      }
      return Math.max(0, unfunded);
    }
  }
}

/**
 * Calculate Fixed Charge Coverage Ratio (FCCR)
 *
 * Lender-defined formula:
 * - CapEx Deduction = Based on treatment mode (unfunded, all, none, or custom %)
 * - Numerator = Adjusted EBITDA - CapEx Deduction - Cash Taxes
 * - Denominator = TTM Principal Payments + TTM Interest Expense
 * - FCCR = Numerator / Denominator
 *
 * @param adjustedEbitda - The adjusted EBITDA value (or regular EBITDA as fallback)
 * @param metrics - The extracted financial metrics
 * @param capexConfig - Optional CapEx treatment configuration (defaults to 'unfunded')
 */
/** Default operating lease configuration — excluded from FCCR denominator */
export const DEFAULT_OPERATING_LEASE_CONFIG: OperatingLeaseConfig = {
  mode: 'exclude',
};

export function calculateFCCR(
  adjustedEbitda: number | null,
  metrics: ExtractedMetrics,
  capexConfig: CapexTreatmentConfig = DEFAULT_CAPEX_TREATMENT,
  year?: string,
  operatingLeaseConfig: OperatingLeaseConfig = DEFAULT_OPERATING_LEASE_CONFIG
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

  // Calculate unfunded CapEx (for reference/transparency, even if not using it)
  // Can be negative when debt proceeds exceed CapEx
  const unfundedCapex = capitalExpenditures - proceedsFromLTDebt;

  // Calculate actual CapEx deduction based on treatment mode
  // Belt-and-suspenders floor: even though the 'unfunded' case floors internally,
  // other modes could theoretically produce unexpected negatives.
  const capexDeduction = Math.max(0, calculateCapexDeduction(
    capitalExpenditures,
    proceedsFromLTDebt,
    capexConfig
  ));

  // Cash Taxes — floor at 0 (negative cash taxes = refunds should not inflate numerator)
  const rawCashTaxesPaid = metrics.cash_taxes_paid ?? 0;
  if (rawCashTaxesPaid < 0) {
    console.warn(
      `⚠️ CASH TAX FLOOR: cash_taxes_paid is negative (${rawCashTaxesPaid}), ` +
      `likely a tax refund. Flooring at 0 to prevent numerator inflation.`
    );
  }
  const cashTaxesPaid = Math.max(0, rawCashTaxesPaid);
  const distributionsPaid = metrics.distributions_paid ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Denominator Components (Debt Service via shared resolver)
  //
  // The resolver uses priority chains:
  //   Principal: repayment_of_debt (all debt classes) > bank_debt_current > ttm_principal_payments
  //   Interest:  cash_interest_paid (cross-checked vs accrual) > total_interest_expense > ttm > P&L
  //   Leases:    finance_lease_payments > lease_liabilities_current > payment_of_lease_liability
  //
  // Finance leases are resolved independently to prevent double-counting.
  // Lease interest is only deducted from the interest component when the
  // lease source is a total cash payment (not a BS current portion).
  // ─────────────────────────────────────────────────────────────────────────

  const debtService = resolveDebtService(metrics, year);
  const ttmPrincipalPayments = debtService.principal;
  let ttmInterestExpense = debtService.interest;
  const leasePayments = debtService.leases;
  const operatingLeasePayments = debtService.operatingLeases;
  let totalDebtService = debtService.total;

  // ─────────────────────────────────────────────────────────────────────────
  // Operating Lease Inclusion (optional)
  //
  // When mode === 'include', add operating lease payments to the denominator.
  // Lease interest double-count prevention: if the interest source is P&L-based
  // and lease_interest exists but was NOT already deducted by the finance lease
  // logic, deduct it to avoid counting lease interest in both the interest line
  // and the operating lease payment.
  // ─────────────────────────────────────────────────────────────────────────
  const fc = (metrics.fixed_charges || {}) as import('@/types').FixedCharges;
  let operatingLeaseInterestDeducted = 0;

  if (operatingLeaseConfig.mode === 'include' && operatingLeasePayments > 0) {
    totalDebtService += operatingLeasePayments;

    // Prevent lease interest double-count
    const PL_BASED_SOURCES = ['total_interest_expense', 'ttm_interest_expense', 'interest_accrual'];
    if (
      PL_BASED_SOURCES.includes(debtService.sources.interest_source) &&
      fc.lease_interest != null &&
      fc.lease_interest > 0 &&
      debtService.sources.lease_interest_deducted == null
    ) {
      operatingLeaseInterestDeducted = fc.lease_interest;
      ttmInterestExpense = Math.max(0, ttmInterestExpense - fc.lease_interest);
      // Recalculate total after interest adjustment
      totalDebtService = ttmPrincipalPayments + ttmInterestExpense + leasePayments + operatingLeasePayments;
    }
  }

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
  // Distributions are excluded — they are discretionary and restricted by covenant
  const numerator =
    adjustedEbitda - capexDeduction - cashTaxesPaid;

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
      // Operating lease info (only populated when mode is 'include')
      ...(operatingLeaseConfig.mode === 'include' && operatingLeasePayments > 0 && {
        operating_lease_payments: operatingLeasePayments,
        operating_lease_treatment: operatingLeaseConfig.mode,
      }),
      denominator: totalDebtService,
      // Source values for transparency
      sources: {
        capital_expenditures_extracted: metrics.capital_expenditures,
        proceeds_from_lt_debt_extracted: metrics.proceeds_from_long_term_debt,
        cash_taxes_paid_extracted: metrics.cash_taxes_paid,
        distributions_paid_extracted: metrics.distributions_paid,
        // Denominator source tracking from resolver
        principal_source: debtService.sources.principal_source,
        principal_value: debtService.sources.principal_value,
        interest_source: debtService.sources.interest_source,
        interest_value: ttmInterestExpense || null,
        lease_source: debtService.sources.lease_source,
        lease_value: debtService.sources.lease_value,
        lease_interest_deducted: debtService.sources.lease_interest_deducted ?? (operatingLeaseInterestDeducted > 0 ? operatingLeaseInterestDeducted : null),
      },
    },
  };
}
