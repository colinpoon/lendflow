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
 * FX / unrealized-gains deduplication guard.
 *
 * HOW THE DOUBLE-COUNT OCCURS (KITS FY2024 example):
 *   - Income statement: "Exchange (gain)/loss (2,673)" — this is a REALIZED FX gain of $2,673K
 *     that already flows through net income (and therefore already into base EBITDA).
 *   - Cash flow statement: "Unrealized foreign exchange (gain) loss (444)" — this is the NON-CASH
 *     portion of FX movements; it is a legitimate adjustment because the cash-flow reconciliation
 *     adds it back to arrive at cash from operations.
 *   - The AI populates BOTH:
 *       foreign_exchange_adjustments = -2,673  (the P&L realized line — already in net income)
 *       unrealized_gains_losses      = -444    (the non-cash adjustment — legitimate)
 *   - Result: Adj EBITDA is over-reduced by $2,673K.
 *
 * DETECTION LOGIC:
 *   The income statement FX line is ALWAYS larger (or equal) in magnitude to the unrealized
 *   portion (unrealized ⊆ realized+unrealized). When:
 *     1. Both fields are non-zero and share the same sign (both gains or both losses), AND
 *     2. |foreign_exchange_adjustments| > |unrealized_gains_losses| × 2
 *   ... then `foreign_exchange_adjustments` almost certainly captured the gross P&L FX line
 *   that is already embedded in net income. Suppress it; retain only `unrealized_gains_losses`.
 *
 * SAFE CASES (guard does NOT trigger):
 *   - Opposite signs: one is a gain, the other a loss — they are distinct items, keep both.
 *   - Similar magnitudes (ratio ≤ 2×): may be the same unrealized amount duplicated across
 *     chunks; the size guard below will catch runaway values if needed.
 *   - Only one field is non-zero: no overlap possible, no action needed.
 */
function deduplicateFxAndUnrealized(
  rawFxAdjustments: number,
  rawUnrealizedGainsLosses: number | null | undefined
): { fxAdjustments: number; unrealizedGainsLosses: number | null } {
  const unrealized = rawUnrealizedGainsLosses ?? null;

  // Guard only applies when both fields are non-zero and same-sign
  if (
    unrealized == null ||
    rawFxAdjustments === 0 ||
    unrealized === 0 ||
    Math.sign(rawFxAdjustments) !== Math.sign(unrealized)
  ) {
    return { fxAdjustments: rawFxAdjustments, unrealizedGainsLosses: unrealized };
  }

  const absFx = Math.abs(rawFxAdjustments);
  const absUnrealized = Math.abs(unrealized);

  if (absFx > absUnrealized * 2) {
    // foreign_exchange_adjustments is >2× larger than unrealized_gains_losses and same-direction.
    // This indicates the AI populated the field with the gross income statement Exchange (gain)/loss
    // line, which is ALREADY embedded in net income (and therefore in base EBITDA).
    // Suppress foreign_exchange_adjustments; the non-cash unrealized portion is correctly
    // captured in unrealized_gains_losses.
    console.warn(
      `⚠️ DEDUP [fx/unrealized]: foreign_exchange_adjustments (${rawFxAdjustments}) is same-direction ` +
      `and >2× the magnitude of unrealized_gains_losses (${unrealized}). ` +
      `The FX field likely contains the income statement Exchange (gain)/loss already embedded ` +
      `in net income — zeroing foreign_exchange_adjustments to prevent double-subtraction.`
    );
    return { fxAdjustments: 0, unrealizedGainsLosses: unrealized };
  }

  // Similar magnitudes: both fields may be capturing the same unrealized amount from different
  // document chunks. Log the overlap for review but do not suppress either.
  console.warn(
    `⚠️ OVERLAP [fx/unrealized]: Both foreign_exchange_adjustments (${rawFxAdjustments}) and ` +
    `unrealized_gains_losses (${unrealized}) are non-zero with the same sign. ` +
    `Values are close in magnitude (ratio ≤ 2×) — both retained. Review extraction for this period.`
  );
  return { fxAdjustments: rawFxAdjustments, unrealizedGainsLosses: unrealized };
}

/**
 * FX size sanity check.
 *
 * A single FX adjustment that moves Adj EBITDA by more than FX_EBITDA_IMPACT_THRESHOLD of
 * base EBITDA is almost certainly double-counting OCI/translation reserve items alongside the
 * P&L FX line, or conflating unrealized and realised FX across chunks.
 *
 * When the threshold is breached after the dedup guard, we log a warning and cap the FX
 * field to the threshold amount. The cap is conservative (20% of EBITDA) — it keeps the FX
 * adjustment material while preventing runaway deductions.
 *
 * NOTE: This guard operates on the already-deduped fxAdjustments value (post-Guard 2).
 */
const FX_EBITDA_IMPACT_THRESHOLD = 0.20; // 20% of base EBITDA

function applyFxSizeGuard(
  fxAdjustments: number,
  ebitda: number
): number {
  if (ebitda <= 0 || fxAdjustments >= 0) return fxAdjustments; // only affects negative (gain) FX
  const maxNegativeImpact = -(ebitda * FX_EBITDA_IMPACT_THRESHOLD);
  if (fxAdjustments < maxNegativeImpact) {
    console.warn(
      `⚠️ FX SIZE GUARD: foreign_exchange_adjustments (${fxAdjustments}) would reduce Adj EBITDA ` +
      `by more than ${FX_EBITDA_IMPACT_THRESHOLD * 100}% of base EBITDA (${ebitda}). ` +
      `This strongly suggests an OCI/translation reserve item is double-counted alongside the P&L FX line. ` +
      `Capping fx_adjustments to ${maxNegativeImpact.toFixed(0)} for this period. ` +
      `Review extraction for "foreign_exchange_adjustments" and "unrealized_gains_losses" values.`
    );
    return maxNegativeImpact;
  }
  return fxAdjustments;
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
  // Guard 2: foreign_exchange_adjustments vs unrealized_gains_losses
  //
  // The income statement "Exchange (gain)/loss" line is already embedded in net income
  // (and therefore in base EBITDA). When the AI places this P&L line into
  // foreign_exchange_adjustments AND also correctly places the non-cash unrealized
  // portion into unrealized_gains_losses, the FX impact is double-subtracted.
  //
  // Fix: when foreign_exchange_adjustments is >2× the magnitude of unrealized_gains_losses
  // (same direction), suppress foreign_exchange_adjustments. The non-cash portion is
  // already correctly handled by unrealized_gains_losses.
  // ─────────────────────────────────────────────────────────────────────────
  const rawFxAdjustments = adj.foreign_exchange_adjustments ?? 0;
  const { fxAdjustments: dedupedFxAdjustments, unrealizedGainsLosses: dedupedUnrealized } =
    deduplicateFxAndUnrealized(rawFxAdjustments, adj.unrealized_gains_losses);

  // ─────────────────────────────────────────────────────────────────────────
  // Guard 3: FX size sanity — cap disproportionately large negative FX values
  // This is a backstop for cases where Guard 2 doesn't fully suppress the P&L FX line.
  // ─────────────────────────────────────────────────────────────────────────
  const guardedFxAdjustments = applyFxSizeGuard(dedupedFxAdjustments, ebitda);

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

  const nonCashAdjustments = [
    adj.stock_based_compensation,
    adj.impairment_charges,
    adj.goodwill_impairment,
    dedupedUnrealized,         // may be zeroed by Guard 2 if FX fully overlaps
    adj.deferred_compensation,
    deduplicatedOtherNonCash,  // may be zeroed by Guard 1
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

  const calculatedAdjustedEbitda = parseFloat(
    (
      ebitda +
      nonCashAdjustments +
      oneTimeExpenses +
      ownerManagementAdjustments +
      accountingAdjustments +
      guardedFxAdjustments +   // uses deduplicated, size-capped FX value
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
      `ownerMgmt: ${ownerManagementAdjustments}, fxAdjustments: ${guardedFxAdjustments}, ` +
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
      fx_adjustments: guardedFxAdjustments,
      pro_forma_adjustments: proFormaAdjustments,
      capital_expenditures_not_in_calc: capitalExpenditures,
      uses_reported_value: metrics.reported_adjusted_ebitda != null,
    },
    deduped_components: {
      other_non_cash: deduplicatedOtherNonCash,
    },
  };
}
