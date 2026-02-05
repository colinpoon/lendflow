/**
 * EBITDA calculation utilities
 * Calculates EBITDA and Adjusted EBITDA from components
 *
 * Reference Values (Zedcor FY2024):
 * - Adjusted EBITDA: $7,541K
 * - FCCR: 0.44x
 * - Senior Debt/EBITDA: 3.2x
 * - Total Debt/Total Cap: 69.5%
 */

import type {
  ExtractedMetrics,
  AdjustedEBITDABreakdown,
  AdjustedEBITDAComponents,
} from '@/types';

export interface EBITDACalculationResult {
  ebitda: number;
  ebitda_calculated: boolean;
  adjusted_ebitda: number | null;
  calculated_adjusted_ebitda: number;
  adjusted_ebitda_breakdown: AdjustedEBITDABreakdown;
}

/**
 * Calculate EBITDA from income statement components
 * EBITDA = Net Income + Interest + Taxes + Depreciation & Amortization
 */
export function calculateEBITDA(metrics: ExtractedMetrics): number | null {
  // If EBITDA is already provided, use it
  if (metrics.ebitda != null) return metrics.ebitda;

  const netIncome = metrics.net_income;
  const interest =
    metrics.interest ?? metrics.fixed_charges?.total_interest_expense ?? null;
  const taxes = metrics.taxes;
  // Prefer summing component depreciation fields when available (more reliable than AI's total)
  const componentDepAmort = [
    metrics.depreciation_equipment,
    metrics.depreciation_rou,
    metrics.depreciation_other,
  ].filter((v): v is number => v != null);

  const depAmort =
    componentDepAmort.length > 0
      ? componentDepAmort.reduce((sum, v) => sum + v, 0)
      : metrics.depreciation_amortization;

  // Need at minimum net_income and depreciation to calculate meaningful EBITDA
  if (netIncome != null && depAmort != null) {
    return parseFloat(
      (netIncome + (interest ?? 0) + (taxes ?? 0) + depAmort).toFixed(2)
    );
  }

  return null;
}

/**
 * Calculate Adjusted EBITDA from EBITDA and adjustment components
 * Adjusted EBITDA = EBITDA + Non-cash + One-time Expenses - One-time Gains
 */
export function calculateAdjustedEBITDA(
  ebitda: number,
  metrics: ExtractedMetrics
): EBITDACalculationResult {
  const adj = (metrics.adjusted_ebitda_components || {}) as AdjustedEBITDAComponents;

  // ─────────────────────────────────────────────────────────────────────────
  // Non-Cash Adjustments (add back)
  // ─────────────────────────────────────────────────────────────────────────

  // Non-cash adjustments to add back to EBITDA
  // NOTE: loss_on_disposal is intentionally EXCLUDED. Disposal losses are already reflected in
  // net income (reducing it) and are NOT added back because:
  // 1. Most companies dispose of assets as a recurring part of operations
  // 2. Conservative underwriting treats disposal losses as operational, not one-time
  // 3. Disposal gains are still subtracted via the one-time gains bucket (gain_on_disposal)
  const nonCashAdjustments = [
    adj.stock_based_compensation,
    adj.impairment_charges,
    adj.goodwill_impairment,
    adj.unrealized_gains_losses,
    adj.deferred_compensation,
    adj.other_non_cash,
  ]
    .filter((v): v is number => v != null && v !== 0)
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Expenses (add back)
  // ─────────────────────────────────────────────────────────────────────────

  const oneTimeExpenses = [
    adj.restructuring_costs,
    adj.severance_costs,
    adj.transaction_costs,
    adj.legal_settlements,
    adj.professional_fees_one_time,
    adj.casualty_losses,
    adj.other_one_time_expenses,
  ]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Gains (subtract)
  // NOTE: gain_on_disposal is intentionally EXCLUDED — disposal gains/losses are treated as
  // operational (symmetric with loss_on_disposal exclusion above). Their impact stays in net income.
  // ─────────────────────────────────────────────────────────────────────────

  // NOTE: Gains/income values should ALWAYS be subtracted from EBITDA.
  // The AI may extract them as negative (due to parentheses in financial statements).
  // We use Math.abs() to normalize: gains are ALWAYS positive, then subtracted.
  const oneTimeGains = [
    adj.gain_on_asset_sale,
    adj.other_income_non_operating,
    adj.insurance_proceeds,
    adj.other_one_time_gains,
  ]
    .filter((v): v is number => v != null)
    .map((v) => Math.abs(v)) // Normalize: gains should always be positive
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Owner/Management Adjustments (add back)
  // ─────────────────────────────────────────────────────────────────────────

  const ownerManagementAdjustments = [
    adj.owner_compensation_adjustment,
    adj.related_party_adjustments,
    adj.management_fees_adjustment,
  ]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Other Adjustments
  // ─────────────────────────────────────────────────────────────────────────

  const accountingAdjustments = adj.accounting_policy_adjustments ?? 0;
  const fxAdjustments = adj.foreign_exchange_adjustments ?? 0;
  const proFormaAdjustments = [adj.pro_forma_cost_savings, adj.pro_forma_synergies]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  const capitalExpenditures = metrics.capital_expenditures ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Adjusted EBITDA
  // ─────────────────────────────────────────────────────────────────────────

  const calculatedAdjustedEbitda = parseFloat(
    (
      ebitda +
      nonCashAdjustments +
      oneTimeExpenses +
      ownerManagementAdjustments +
      accountingAdjustments +
      fxAdjustments +
      proFormaAdjustments -
      oneTimeGains
    ).toFixed(2)
  );

  return {
    ebitda,
    ebitda_calculated: metrics.ebitda == null,
    adjusted_ebitda: metrics.reported_adjusted_ebitda ?? calculatedAdjustedEbitda,
    calculated_adjusted_ebitda: calculatedAdjustedEbitda,
    adjusted_ebitda_breakdown: {
      reported_ebitda: ebitda,
      non_cash_adjustments: nonCashAdjustments,
      one_time_expenses: oneTimeExpenses,
      one_time_gains: oneTimeGains,
      owner_management_adjustments: ownerManagementAdjustments,
      accounting_adjustments: accountingAdjustments,
      fx_adjustments: fxAdjustments,
      pro_forma_adjustments: proFormaAdjustments,
      capital_expenditures_not_in_calc: capitalExpenditures,
      uses_reported_value: metrics.reported_adjusted_ebitda != null,
    },
  };
}
