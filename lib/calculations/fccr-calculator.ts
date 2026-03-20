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
 * Numerator = Adjusted EBITDA - Unfunded CapEx - Cash Taxes - Distributions Paid
 * Denominator = Principal Payments + Interest Expense + Lease Payments
 * FCCR = Numerator / Denominator
 *
 * Note: Distributions are deducted from the numerator because they reduce cash
 * available to service debt — consistent with commercial banking FCCR methodology.
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
  /** Analyst-facing warnings from debt service resolution (e.g. gross revolver distortion). */
  warnings: string[];
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
 * - Numerator = Adjusted EBITDA - CapEx Deduction - Cash Taxes - Distributions Paid
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
      warnings: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Numerator Components
  // ─────────────────────────────────────────────────────────────────────────

  // Get raw CapEx values
  const capitalExpenditures = metrics.capital_expenditures ?? 0;
  const proceedsFromLTDebt = metrics.proceeds_from_long_term_debt ?? 0;

  // Analyst warning: negative net LT debt proceeds = net paydown year
  // This increases unfunded CapEx beyond raw CapEx, lowering FCCR relative to
  // prior years with positive proceeds. Without this warning, the FCCR swing
  // between years appears unexplained.
  const negativeProceedsWarnings: string[] = [];
  if (proceedsFromLTDebt < 0) {
    negativeProceedsWarnings.push(
      `Proceeds from long-term debt are negative (${proceedsFromLTDebt.toLocaleString()}) — ` +
      `the borrower is in a net debt paydown year (repayments exceeded new issuances). ` +
      `This increases unfunded CapEx and reduces the FCCR numerator relative to years ` +
      `with positive debt proceeds. Review whether the paydown is voluntary deleveraging ` +
      `or reflects inability to access new credit.`
    );
  }

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

  // Analyst warning when unfunded CapEx floor fires (proceeds > CapEx)
  const capexFloorWarnings: string[] = [];
  if (capexConfig.mode === 'unfunded' && unfundedCapex < 0) {
    capexFloorWarnings.push(
      `Unfunded CapEx floor applied: debt proceeds (${proceedsFromLTDebt.toLocaleString()}) exceed ` +
      `CapEx (${capitalExpenditures.toLocaleString()}) by ${Math.abs(unfundedCapex).toLocaleString()}. ` +
      `CapEx deduction floored at $0 — the excess borrowing may indicate acquisition financing, ` +
      `debt restructuring, or working capital draws classified as long-term. Review use of proceeds.`
    );
  }

  // Cash Taxes — fallback chain: CF statement → income statement → $0 (with analyst warning)
  // Using $0 when cash_taxes_paid is absent would overstate FCCR by 10–20+ bps for
  // profitable companies. Income statement tax expense (accrual) is a conservative substitute.
  type CashTaxesSource = 'cash_flow' | 'income_statement_fallback' | 'zero_fallback';
  let cashTaxesSource: CashTaxesSource = 'cash_flow';
  let rawCashTaxesPaid: number;
  const cashTaxesFallbackWarnings: string[] = [];

  if (metrics.cash_taxes_paid != null) {
    rawCashTaxesPaid = metrics.cash_taxes_paid;
  } else if (metrics.taxes != null && metrics.taxes > 0) {
    rawCashTaxesPaid = metrics.taxes;
    cashTaxesSource = 'income_statement_fallback';
    cashTaxesFallbackWarnings.push(
      `Cash taxes paid not found in cash flow statement — using income statement tax expense ` +
      `(${metrics.taxes.toLocaleString()}) as fallback. FCCR numerator may differ slightly ` +
      `from actual cash outflow (timing differences between accrual and cash basis).`
    );
  } else {
    rawCashTaxesPaid = 0;
    cashTaxesSource = 'zero_fallback';
    cashTaxesFallbackWarnings.push(
      `Cash taxes paid and income statement taxes both unavailable — FCCR numerator uses $0 ` +
      `tax deduction. Coverage ratio is likely overstated for profitable borrowers.`
    );
  }

  if (rawCashTaxesPaid < 0) {
    console.warn(
      `⚠️ CASH TAX FLOOR: cash taxes are negative (${rawCashTaxesPaid}), ` +
      `likely a tax refund. Flooring at 0 to prevent numerator inflation.`
    );
  }
  const cashTaxesPaid = Math.max(0, rawCashTaxesPaid);

  // ─── Non-recurring disposal tax warning ──────────────────────────────
  // When cash_taxes_paid significantly exceeds income statement taxes, it may
  // include taxes on capital gains from asset sales. Since those gains are already
  // excluded from Adjusted EBITDA (as one-time items), deducting the full cash taxes
  // double-penalizes the borrower in the FCCR numerator. Flag for analyst review.
  const cashTaxesMayIncludeDisposal =
    cashTaxesSource === 'cash_flow' &&
    metrics.taxes != null &&
    metrics.taxes > 0 &&
    cashTaxesPaid > metrics.taxes * 1.25;

  if (cashTaxesMayIncludeDisposal) {
    const excessPct = Math.round(((cashTaxesPaid - metrics.taxes!) / metrics.taxes!) * 100);
    cashTaxesFallbackWarnings.push(
      `Cash taxes paid (${cashTaxesPaid.toLocaleString()}) exceeds income statement tax expense ` +
      `(${metrics.taxes!.toLocaleString()}) by ${excessPct}%. This may include taxes on non-recurring ` +
      `asset disposals or capital gains. If those gains were excluded from Adjusted EBITDA, the ` +
      `FCCR numerator is double-penalized. Review cash tax composition for disposal-related taxes.`
    );
  }

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
  // Preferred dividends are a senior contractual fixed obligation — included in the FCCR
  // denominator per commercial lending convention. Excluded from DSCR (banker's ratio).
  const preferredDividends = debtService.preferredDividends;
  let totalDebtService = debtService.total + preferredDividends;

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
      // Recalculate total after interest adjustment — include preferred dividends in recomputed total
      totalDebtService = ttmPrincipalPayments + ttmInterestExpense + leasePayments + operatingLeasePayments + preferredDividends;
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
      warnings: [...debtService.warnings, ...cashTaxesFallbackWarnings, ...negativeProceedsWarnings, ...capexFloorWarnings],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate FCCR
  // ─────────────────────────────────────────────────────────────────────────

  // Numerator: Cash Flow Available for Debt Servicing
  // Uses the configured CapEx deduction (unfunded, all, none, or custom)
  // Distributions reduce cash available to service debt (same treatment as cash taxes)
  const numerator =
    adjustedEbitda - capexDeduction - cashTaxesPaid - distributionsPaid;

  // FCCR = Numerator / Denominator
  const fccr = parseFloat((numerator / totalDebtService).toFixed(2));

  // Surface negative FCCR as a validation issue — a negative numerator means
  // operating cash flow (after CapEx, taxes, distributions) is insufficient to
  // cover ANY fixed charges. This is a critical signal for lenders.
  const negativeFccrWarnings: string[] = [];
  if (numerator < 0) {
    negativeFccrWarnings.push(
      `FCCR numerator is negative (${numerator.toLocaleString()}): Adjusted EBITDA ` +
      `(${adjustedEbitda.toLocaleString()}) minus CapEx (${capexDeduction.toLocaleString()}), ` +
      `cash taxes (${cashTaxesPaid.toLocaleString()}), and distributions ` +
      `(${distributionsPaid.toLocaleString()}) leaves no cash available for debt service. ` +
      `FCCR of ${fccr}x indicates the borrower cannot service fixed charges from operations.`
    );
  }

  return {
    fccr,
    fccr_numerator: parseFloat(numerator.toFixed(2)),
    total_fixed_charges: parseFloat(totalDebtService.toFixed(2)),
    cash_flow_for_debt_servicing: parseFloat(numerator.toFixed(2)),
    warnings: [...debtService.warnings, ...cashTaxesFallbackWarnings, ...negativeProceedsWarnings, ...capexFloorWarnings, ...negativeFccrWarnings],
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
      // Preferred dividends (only populated when non-zero — many borrowers have none)
      ...(preferredDividends > 0 && {
        preferred_dividends: preferredDividends,
      }),
      denominator: totalDebtService,
      // Source values for transparency
      sources: {
        capital_expenditures_extracted: metrics.capital_expenditures,
        proceeds_from_lt_debt_extracted: metrics.proceeds_from_long_term_debt,
        cash_taxes_paid_extracted: metrics.cash_taxes_paid,
        cash_taxes_source: cashTaxesSource,
        ...(cashTaxesMayIncludeDisposal && { cash_taxes_may_include_disposal: true }),
        distributions_paid_extracted: metrics.distributions_paid,
        // Denominator source tracking from resolver
        principal_source: debtService.sources.principal_source,
        principal_value: debtService.sources.principal_value,
        interest_source: debtService.sources.interest_source,
        interest_value: ttmInterestExpense || null,
        lease_source: debtService.sources.lease_source,
        lease_value: debtService.sources.lease_value,
        lease_interest_deducted: debtService.sources.lease_interest_deducted ?? (operatingLeaseInterestDeducted > 0 ? operatingLeaseInterestDeducted : null),
        preferred_dividends_value: debtService.sources.preferred_dividends_value,
      },
    },
  };
}
