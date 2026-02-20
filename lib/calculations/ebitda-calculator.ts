/**
 * EBITDA calculation utilities
 * Calculates EBITDA and Adjusted EBITDA from components
 *
 * Reference Values (Zedcor FY2024):
 * - Adjusted EBITDA: $7,541K
 * - FCCR: 0.44x
 * - Senior Debt/EBITDA: 3.2x
 * - Total Debt/Total Cap: 69.5%
 *
 * Reference Values (KITS FY2024):
 * - Adjusted EBITDA: ~$8,642K
 * - Calculation: EBITDA $8,088K + SBC $1,005K - unrealized FX gain $444K - lease extinguishment gain $7K
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
  /** Post-dedup component overrides for UI display accuracy */
  deduped_components: {
    other_non_cash: number;
  };
}

/**
 * Calculate EBITDA from income statement components
 * EBITDA = Net Income + Interest + Taxes + Depreciation & Amortization
 */
export function calculateEBITDA(metrics: ExtractedMetrics): number | null {
  // If EBITDA is already provided, use it
  if (metrics.ebitda != null) return metrics.ebitda;

  const netIncome = metrics.net_income;

  // CRITICAL: Interest expense should ALWAYS be positive for EBITDA.
  // Negative values occur when net finance income exceeds costs (e.g., Taiga earns
  // more interest on $192M cash than it pays on leases). Reject negatives at every
  // level and prefer the first positive source found.
  const rawInterest = metrics.interest;
  let interest: number | null = null;

  // Primary source: P&L interest (should be gross finance costs, always positive)
  if (rawInterest != null && rawInterest > 0) {
    interest = rawInterest;
  }

  // Fallback chain: try each source, skip any that are null/negative
  if (interest == null) {
    const fallbackCandidates = [
      { value: metrics.fixed_charges?.total_interest_expense, label: 'fixed_charges.total_interest_expense' },
      { value: metrics.ttm_interest_expense, label: 'ttm_interest_expense' },
      { value: metrics.cash_interest_paid, label: 'cash_interest_paid' },
    ];

    for (const candidate of fallbackCandidates) {
      if (candidate.value != null && candidate.value > 0) {
        if (rawInterest != null && rawInterest <= 0) {
          console.warn(
            `⚠️ INTEREST CORRECTION: Rejected negative interest (${rawInterest}), ` +
            `using fallback ${candidate.label}: ${candidate.value}`
          );
        }
        interest = candidate.value;
        break;
      }
    }
  }
  const taxes = metrics.taxes;
  // Prefer summing component depreciation fields when available (more reliable than AI's total)
  const componentDepAmort = [
    metrics.depreciation_equipment,
    metrics.depreciation_rou,
    metrics.depreciation_other,
    metrics.amortization_intangibles,
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal deduplication helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true when two absolute values are within `tolerancePct` of the larger one.
 * Uses the larger value as the denominator to avoid division-by-zero and to make the
 * comparison symmetric.
 */
function valuesOverlapWithinTolerance(a: number, b: number, tolerancePct: number): boolean {
  const denominator = Math.max(Math.abs(a), Math.abs(b));
  if (denominator === 0) return true; // both zero — trivially equal
  return Math.abs(Math.abs(a) - Math.abs(b)) / denominator < tolerancePct;
}

/**
 * Deduplicate other_non_cash against finance cost components.
 *
 * The AI sometimes places "amortization of deferred financing costs" or "non-cash interest"
 * in `other_non_cash` even though this amount is already embedded in the top-level `interest`
 * field (P&L finance costs). Adding it back would double-count.
 *
 * Check against multiple sources because the merge pipeline may drop some fields:
 * 1. non_cash_interest_expense (direct match — same item extracted twice)
 * 2. interest (P&L) when other_non_cash is a small fraction — likely a sub-component
 *    already included in finance costs (e.g., Taiga's $241K amortization within $811K total)
 */
function deduplicateOtherNonCash(
  rawOtherNonCash: number,
  nonCashInterestExpense: number,
  interestExpense: number,
  tolerance: number
): number {
  if (rawOtherNonCash <= 0) return rawOtherNonCash;

  // Check 1: Direct match against non_cash_interest_expense
  if (nonCashInterestExpense > 0 &&
      valuesOverlapWithinTolerance(rawOtherNonCash, nonCashInterestExpense, tolerance)) {
    console.warn(
      `⚠️ DEDUP [other_non_cash]: value (${rawOtherNonCash}) matches ` +
      `non_cash_interest_expense (${nonCashInterestExpense}) within ${tolerance * 100}% — ` +
      `treating as duplicate, zeroing other_non_cash`
    );
    return 0;
  }

  // Check 2: Warning only — other_non_cash may overlap with P&L interest.
  // We do NOT zero here because the size relationship alone is insufficient evidence.
  // Legitimate non-cash items (warranty provisions, pension costs, environmental accruals)
  // can be smaller than interest expense without being financing-related.
  // Suppression requires an explicit non_cash_interest_expense match (Check 1).
  if (interestExpense > 0 && nonCashInterestExpense === 0 &&
      rawOtherNonCash <= interestExpense &&
      rawOtherNonCash > interestExpense * 0.05) {
    console.warn(
      `⚠️ REVIEW [other_non_cash]: value (${rawOtherNonCash}) is within ` +
      `interest expense range (${interestExpense}) and non_cash_interest_expense was not extracted. ` +
      `Possible sub-component overlap — verify manually.`
    );
  }

  return rawOtherNonCash;
}

/**
 * Resolve the unrealized FX adjustment from the new `unrealized_fx_cash_flow` field,
 * falling back to the deprecated `foreign_exchange_adjustments` for backward compatibility
 * with older extractions.
 *
 * The new schema separates FX into:
 *   - unrealized_fx_cash_flow: non-cash FX from CF operating activities (valid EBITDA adjustment)
 *   - realized_fx_pl: P&L FX line (already in net income — informational only, never adjusts EBITDA)
 *   - foreign_exchange_adjustments: DEPRECATED — ignored when unrealized_fx_cash_flow is present
 *
 * Realized FX is logged when material (>5% of EBITDA) for analyst review.
 */
const REALIZED_FX_MATERIALITY_THRESHOLD = 0.05; // 5% of base EBITDA

function resolveUnrealizedFx(
  adj: AdjustedEBITDAComponents,
  ebitda: number
): number {
  // Prefer the new dedicated field
  const unrealizedFxCf = adj.unrealized_fx_cash_flow ?? null;
  if (unrealizedFxCf != null) return unrealizedFxCf;

  // Backward compat: use deprecated foreign_exchange_adjustments if new field is absent
  return adj.foreign_exchange_adjustments ?? 0;
}

function logRealizedFxIfMaterial(
  adj: AdjustedEBITDAComponents,
  ebitda: number
): void {
  const realizedFx = adj.realized_fx_pl ?? 0;
  if (realizedFx === 0 || ebitda === 0) return;

  if (Math.abs(realizedFx) > Math.abs(ebitda) * REALIZED_FX_MATERIALITY_THRESHOLD) {
    console.warn(
      `⚠️ REVIEW [realized_fx_pl]: Realized FX of ${realizedFx} is material ` +
      `(>${REALIZED_FX_MATERIALITY_THRESHOLD * 100}% of EBITDA ${ebitda}). ` +
      `Verify whether this gain/loss is recurring or one-time. ` +
      `It is already in net income and has NOT been excluded from Adjusted EBITDA.`
    );
  }
}

/**
 * One-time gains cross-field deduplication guard.
 *
 * The AI can place the same disposal/income event into multiple gain fields simultaneously
 * (e.g., a lease extinguishment gain of $7K appearing in both gain_on_asset_sale AND
 * other_one_time_gains). Priority order (highest authority first):
 *   1. gain_on_asset_sale         — explicit asset-sale/disposal gain label
 *   2. other_income_non_operating — aggregate "Other income" line
 *   3. other_one_time_gains       — catch-all for extraordinary gains
 *   4. insurance_proceeds         — specific label
 *
 * When a lower-priority field matches a higher-priority field within 5%, the lower-priority
 * value is zeroed to prevent the double-subtraction.
 */
function deduplicateOneTimeGains(
  rawGainOnAssetSale: number | null | undefined,
  rawOtherIncomeNonOperating: number | null | undefined,
  rawOtherOneTimeGains: number | null | undefined,
  rawInsuranceProceeds: number | null | undefined,
  tolerance: number
): {
  gainOnAssetSale: number | null;
  otherIncomeNonOperating: number | null;
  otherOneTimeGains: number | null;
  insuranceProceeds: number | null;
} {
  let gainOnAssetSale = rawGainOnAssetSale ?? null;
  let otherIncomeNonOperating = rawOtherIncomeNonOperating ?? null;
  let otherOneTimeGains = rawOtherOneTimeGains ?? null;
  let insuranceProceeds = rawInsuranceProceeds ?? null;

  // Normalise to absolute values for comparison (gains are always positive after Math.abs)
  const absGain = gainOnAssetSale != null ? Math.abs(gainOnAssetSale) : null;
  const absOther = otherIncomeNonOperating != null ? Math.abs(otherIncomeNonOperating) : null;
  const absOneTime = otherOneTimeGains != null ? Math.abs(otherOneTimeGains) : null;
  const absInsurance = insuranceProceeds != null ? Math.abs(insuranceProceeds) : null;

  // gain_on_asset_sale vs other_one_time_gains
  if (absGain != null && absOneTime != null && absGain > 0 && absOneTime > 0) {
    if (valuesOverlapWithinTolerance(absGain, absOneTime, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: other_one_time_gains (${otherOneTimeGains}) matches ` +
        `gain_on_asset_sale (${gainOnAssetSale}) within ${tolerance * 100}% — ` +
        `zeroing other_one_time_gains (lower priority)`
      );
      otherOneTimeGains = 0;
    }
  }

  // gain_on_asset_sale vs other_income_non_operating
  if (absGain != null && absOther != null && absGain > 0 && absOther > 0) {
    if (valuesOverlapWithinTolerance(absGain, absOther, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: other_income_non_operating (${otherIncomeNonOperating}) matches ` +
        `gain_on_asset_sale (${gainOnAssetSale}) within ${tolerance * 100}% — ` +
        `zeroing other_income_non_operating (lower priority)`
      );
      otherIncomeNonOperating = 0;
    }
  }

  // other_income_non_operating vs other_one_time_gains (after potential zeroing above)
  const absOtherFinal = otherIncomeNonOperating != null ? Math.abs(otherIncomeNonOperating) : null;
  const absOneTimeFinal = otherOneTimeGains != null ? Math.abs(otherOneTimeGains) : null;
  if (absOtherFinal != null && absOneTimeFinal != null && absOtherFinal > 0 && absOneTimeFinal > 0) {
    if (valuesOverlapWithinTolerance(absOtherFinal, absOneTimeFinal, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: other_one_time_gains (${otherOneTimeGains}) matches ` +
        `other_income_non_operating (${otherIncomeNonOperating}) within ${tolerance * 100}% — ` +
        `zeroing other_one_time_gains (lower priority)`
      );
      otherOneTimeGains = 0;
    }
  }

  // insurance_proceeds vs other_income_non_operating
  if (absInsurance != null && absOtherFinal != null && absInsurance > 0 && absOtherFinal > 0) {
    if (valuesOverlapWithinTolerance(absInsurance, absOtherFinal, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: insurance_proceeds (${insuranceProceeds}) matches ` +
        `other_income_non_operating (${otherIncomeNonOperating}) within ${tolerance * 100}% — ` +
        `zeroing insurance_proceeds (lower priority)`
      );
      insuranceProceeds = 0;
    }
  }

  return { gainOnAssetSale, otherIncomeNonOperating, otherOneTimeGains, insuranceProceeds };
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

  // Shared deduplication tolerance: 5%
  // Tight enough to catch genuine duplicates; wide enough to preserve distinct items with
  // minor rounding differences across document sections.
  const DEDUP_TOLERANCE = 0.05;

  // ─────────────────────────────────────────────────────────────────────────
  // Guard 1: other_non_cash vs finance cost components
  // ─────────────────────────────────────────────────────────────────────────
  const nonCashInterestExpense = metrics.non_cash_interest_expense ?? 0;
  const interestExpense = metrics.interest ?? 0;
  const rawOtherNonCash = adj.other_non_cash ?? 0;
  const deduplicatedOtherNonCash = deduplicateOtherNonCash(
    rawOtherNonCash,
    nonCashInterestExpense,
    interestExpense,
    DEDUP_TOLERANCE
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FX Handling: Use unrealized_fx_cash_flow (non-cash, from CF statement).
  // Realized FX (realized_fx_pl) is already in net income — logged if material
  // but never adjusts EBITDA.
  // ─────────────────────────────────────────────────────────────────────────
  const unrealizedFxValue = resolveUnrealizedFx(adj, ebitda);
  logRealizedFxIfMaterial(adj, ebitda);

  // unrealized_gains_losses is now for non-FX mark-to-market only
  const dedupedUnrealized = adj.unrealized_gains_losses ?? null;

  // ─────────────────────────────────────────────────────────────────────────
  // Guard 4: Cross-field deduplication across one-time gain fields
  // ─────────────────────────────────────────────────────────────────────────
  const {
    gainOnAssetSale,
    otherIncomeNonOperating,
    otherOneTimeGains,
    insuranceProceeds,
  } = deduplicateOneTimeGains(
    adj.gain_on_asset_sale,
    adj.other_income_non_operating,
    adj.other_one_time_gains,
    adj.insurance_proceeds,
    DEDUP_TOLERANCE
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Non-Cash Adjustments (add back)
  // ─────────────────────────────────────────────────────────────────────────
  // NOTE: loss_on_disposal is intentionally EXCLUDED. Disposal losses are already reflected in
  // net income (reducing it) and are NOT added back because:
  // 1. Most companies dispose of assets as a recurring part of operations
  // 2. Conservative underwriting treats disposal losses as operational, not one-time
  // 3. Disposal gains are still subtracted via the one-time gains bucket

  // Sign-aware routing for unrealized items (non-FX mark-to-market).
  // Prompt convention: positive = unrealized loss (non-cash expense → add back);
  //                    negative = unrealized gain (non-cash income → subtract from EBITDA).
  const unrealizedLossAddback =
    dedupedUnrealized != null && dedupedUnrealized > 0 ? dedupedUnrealized : 0;
  const unrealizedGainToSubtract =
    dedupedUnrealized != null && dedupedUnrealized < 0 ? Math.abs(dedupedUnrealized) : 0;

  // Sign-aware routing for unrealized FX (from CF statement).
  // Same convention: positive = unrealized FX loss (add back); negative = unrealized FX gain (subtract).
  const unrealizedFxLossAddback = unrealizedFxValue > 0 ? unrealizedFxValue : 0;
  const unrealizedFxGainToSubtract = unrealizedFxValue < 0 ? Math.abs(unrealizedFxValue) : 0;

  const nonCashAdjustments = [
    adj.stock_based_compensation,
    adj.impairment_charges,
    adj.goodwill_impairment,
    unrealizedLossAddback,        // non-FX unrealized losses (positive values only)
    unrealizedFxLossAddback,      // unrealized FX loss from CF statement (positive = add back)
    adj.deferred_compensation,
    deduplicatedOtherNonCash,     // may be zeroed by Guard 1
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
  //
  // NOTE: Gains/income values should ALWAYS be subtracted from EBITDA.
  // The AI may extract them as negative (due to parentheses in financial statements).
  // We use Math.abs() to normalize: gains are ALWAYS positive, then subtracted.
  // ─────────────────────────────────────────────────────────────────────────

  const oneTimeGains = [
    gainOnAssetSale,            // deduped against other_one_time_gains and other_income_non_operating
    otherIncomeNonOperating,    // deduped against gain_on_asset_sale
    insuranceProceeds,          // deduped against other_income_non_operating
    otherOneTimeGains,          // deduped against gain_on_asset_sale and other_income_non_operating
    unrealizedGainToSubtract,   // non-FX unrealized gain (negative unrealized_gains_losses)
    unrealizedFxGainToSubtract, // unrealized FX gain from CF statement (negative = gain → subtract)
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
  const proFormaAdjustments = [adj.pro_forma_cost_savings, adj.pro_forma_synergies]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  const capitalExpenditures = metrics.capital_expenditures ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate Adjusted EBITDA
  // ─────────────────────────────────────────────────────────────────────────

  // Unrealized FX is now routed through nonCashAdjustments (loss) and oneTimeGains (gain).
  // No separate fx_adjustments term — the deprecated field is zeroed for backward compat.
  const calculatedAdjustedEbitda = parseFloat(
    (
      ebitda +
      nonCashAdjustments +
      oneTimeExpenses +
      ownerManagementAdjustments +
      accountingAdjustments +
      proFormaAdjustments -
      oneTimeGains
    ).toFixed(2)
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Sanity Check: Adj EBITDA should rarely be below base EBITDA
  // ─────────────────────────────────────────────────────────────────────────
  // A negative net adjustment means the one-time gains bucket exceeded all addbacks.
  // This is legitimate when a company has large non-recurring income (e.g. asset sale gains),
  // but suspicious when the shortfall exceeds 10% of base EBITDA — it likely signals that
  // the AI over-excluded from other_non_cash or over-populated other_income_non_operating.
  // This warning does NOT alter the calculation; it surfaces the anomaly for review.
  const netAdjustment = calculatedAdjustedEbitda - ebitda;
  if (ebitda > 0 && netAdjustment < -(ebitda * 0.10)) {
    console.warn(
      `⚠️ ADJ EBITDA SANITY: Calculated Adj EBITDA (${calculatedAdjustedEbitda}) is more than 10% below ` +
      `base EBITDA (${ebitda}). Net adjustment: ${netAdjustment.toFixed(0)}. ` +
      `Breakdown — nonCash: ${nonCashAdjustments}, oneTimeExp: ${oneTimeExpenses}, ` +
      `ownerMgmt: ${ownerManagementAdjustments}, ` +
      `gains subtracted: ${oneTimeGains}. ` +
      `Review other_income_non_operating and other_non_cash for over-exclusion.`
    );
  }

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
      fx_adjustments: 0, // deprecated — FX now routed through non_cash/gains
      unrealized_fx_adjustment: unrealizedFxValue,
      realized_fx_pl: adj.realized_fx_pl ?? 0,
      pro_forma_adjustments: proFormaAdjustments,
      capital_expenditures_not_in_calc: capitalExpenditures,
      uses_reported_value: metrics.reported_adjusted_ebitda != null,
    },
    deduped_components: {
      other_non_cash: deduplicatedOtherNonCash,
    },
  };
}
