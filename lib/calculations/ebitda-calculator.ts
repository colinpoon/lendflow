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
 * - Adjusted EBITDA: $8,062K
 * - Calculation: EBITDA $8,088K + SBC $1,005K - unrealized FX gain $444K
 *   - lease extinguishment gain $7K - interest income $580K = $8,062K
 * - Finance costs — net $975K = gross $1,555K - interest income $580K (Note 15c)
 * - Guard 5: realized_fx_pl vs other_income_non_operating dedup
 * - Guard 6: interest_income vs other_income_non_operating dedup
 * - Guard 7: finance cost sub-component dedup (other_non_cash + other_one_time_expenses vs interest)
 *
 * Reference Values (Taiga FY2024):
 * - Adjusted EBITDA: ~$80,720K
 * - EBITDA: $80,831K (interest $811K from gross fallback — P&L net was -$261K)
 * - Interest income: $5,877K — NOT subtracted (usedGrossFallback=true)
 * - Other Non-Cash: $241K — zeroed by Check 1c (sub-component of gross fallback $811K)
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
    other_one_time_expenses: number;
  };
}

/**
 * Tagged EBITDA result that carries metadata about which interest source was used.
 * This is critical for downstream decisions like interest income exclusion.
 */
export interface EBITDAResult {
  value: number;
  /**
   * true = the primary P&L `interest` field was negative or null and a fallback
   * (fixed_charges, ttm_interest_expense, or cash_interest_paid) was used.
   * This means the interest value is GROSS borrowing costs, and interest income
   * is NOT embedded in it. Subtracting interest_income in Adjusted EBITDA
   * would be a double-subtraction.
   *
   * false = the primary P&L `interest` field was positive and used directly.
   * This may be a net figure (gross - interest income) for companies that present
   * "Finance costs — net". Interest income may inflate EBITDA and should be subtracted.
   */
  usedGrossFallback: boolean;
}

/**
 * Calculate EBITDA from income statement components
 * EBITDA = Net Income + Interest + Taxes + Depreciation & Amortization
 */
export function calculateEBITDA(metrics: ExtractedMetrics): EBITDAResult | null {
  // If EBITDA is already provided, use it
  if (metrics.ebitda != null) return { value: metrics.ebitda, usedGrossFallback: false };

  const netIncome = metrics.net_income;

  // CRITICAL: Interest expense should ALWAYS be positive for EBITDA.
  // Negative values occur when net finance income exceeds costs (e.g., Taiga earns
  // more interest on $192M cash than it pays on leases). Reject negatives at every
  // level and prefer the first positive source found.
  const rawInterest = metrics.interest;
  let interest: number | null = null;
  let usedGrossFallback = false;

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
          usedGrossFallback = true;
        }
        interest = candidate.value;
        break;
      }
    }
  }
  const taxes = metrics.taxes;
  // ── D&A Resolution with Completeness Gate ──────────────────────────────
  // The CF operating-activities add-back (depreciation_amortization) is the canonical
  // authoritative total — it includes ALL asset classes (equipment, ROU, intangibles,
  // leasehold improvements, software, etc.). IS sub-components may only capture a
  // subset disclosed in the notes.
  //
  // Strategy:
  //   1. If the CF aggregate exists, it is the ceiling (canonical source).
  //   2. If IS sub-components exist AND their sum >= the CF aggregate, prefer the sum
  //      (sub-components provide better audit trail and the sum is at least as complete).
  //   3. If IS sub-components exist but sum < CF aggregate, the sub-components are
  //      incomplete — use the CF aggregate to avoid understating D&A.
  //   4. If no CF aggregate exists, fall back to whatever sub-components we have.
  const componentDepAmort = [
    metrics.depreciation_equipment,
    metrics.depreciation_rou,
    metrics.depreciation_other,
    metrics.amortization_intangibles,
  ].filter((v): v is number => v != null);

  const componentSum = componentDepAmort.length > 0
    ? componentDepAmort.reduce((sum, v) => sum + v, 0)
    : 0;

  const cfAggregate = metrics.depreciation_amortization ?? null;

  let depAmort: number | null;
  if (cfAggregate != null && componentDepAmort.length > 0) {
    // Both sources available — use whichever is larger (completeness gate)
    if (componentSum >= cfAggregate) {
      depAmort = componentSum;
    } else {
      console.warn(
        `⚠️ D&A COMPLETENESS GATE: Sub-components sum (${componentSum}) < CF aggregate ` +
        `(${cfAggregate}) by ${(cfAggregate - componentSum).toFixed(0)}. ` +
        `Sub-components likely incomplete — using CF aggregate as canonical total.`
      );
      depAmort = cfAggregate;
    }
  } else if (cfAggregate != null) {
    depAmort = cfAggregate;
  } else if (componentDepAmort.length > 0) {
    depAmort = componentSum;
  } else {
    depAmort = null;
  }

  // Need at minimum net_income and depreciation to calculate meaningful EBITDA
  if (netIncome != null && depAmort != null) {
    return {
      value: parseFloat(
        (netIncome + (interest ?? 0) + (taxes ?? 0) + depAmort).toFixed(2)
      ),
      usedGrossFallback,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared deduplication tolerance: 5%.
 * Tight enough to catch genuine duplicates; wide enough to preserve distinct items
 * with minor rounding differences across document sections.
 */
const DEDUP_TOLERANCE = 0.05;

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
  tolerance: number,
  usedGrossFallback: boolean = false
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

  // Check 1b: Sub-component of non_cash_interest_expense.
  // When non_cash_interest_expense is populated and other_non_cash is a sizable fraction
  // (>=30%) of it, the AI likely extracted the same finance cost breakdown at two
  // granularity levels. E.g., KITS: non_cash_interest_expense=$361K, other_non_cash=$163K
  // (45% — accretion sub-item already in the $361K).
  // The 30% floor prevents false-positives from unrelated small non-cash items
  // (e.g., $50K straight-line rent when non_cash_interest_expense is $400K).
  if (nonCashInterestExpense > 0 &&
      rawOtherNonCash > 0 &&
      rawOtherNonCash < nonCashInterestExpense &&
      rawOtherNonCash >= nonCashInterestExpense * 0.30) {
    console.warn(
      `⚠️ DEDUP [other_non_cash]: value (${rawOtherNonCash}) is ${((rawOtherNonCash / nonCashInterestExpense) * 100).toFixed(0)}% of ` +
      `non_cash_interest_expense (${nonCashInterestExpense}) — likely a sub-component ` +
      `already in finance costs, zeroing other_non_cash`
    );
    return 0;
  }

  // Check 1c: Fallback-sourced interest (net-finance-income companies like Taiga).
  // When the P&L net finance line was negative and the fallback chain provided a
  // gross borrowing cost, ALL finance cost sub-components (including amortization of
  // deferred financing costs) are already inside that gross figure. If other_non_cash
  // is under 35% of the fallback interest value AND non_cash_interest_expense was not
  // separately extracted (meaning the AI didn't route the amortization there), treat
  // it as a sub-component and zero it.
  //
  // Threshold calibrated on Taiga FY2024: $241K / $811K = 30%. The 35% ceiling
  // accommodates minor extraction rounding. False-positive risk exists for legitimate
  // non-cash items (pension accruals, warranty reserves) on larger net-finance-income
  // companies — the nonCashInterestExpense === 0 gate mitigates this by ensuring
  // Checks 1/1b have no anchor to compare against before this heuristic fires.
  if (usedGrossFallback &&
      nonCashInterestExpense === 0 &&
      interestExpense > 0 &&
      rawOtherNonCash > 0 &&
      rawOtherNonCash <= interestExpense * 0.35) {
    console.warn(
      `⚠️ DEDUP [other_non_cash GROSS-FALLBACK]: value (${rawOtherNonCash}) is ` +
      `${((rawOtherNonCash / interestExpense) * 100).toFixed(0)}% of gross fallback interest ` +
      `(${interestExpense}) and non_cash_interest_expense is absent — ` +
      `presumed finance cost sub-component, zeroing other_non_cash`
    );
    return 0;
  }

  // Check 2: Warning only — other_non_cash may overlap with P&L interest.
  // We do NOT zero here because the size relationship alone is insufficient evidence.
  // Legitimate non-cash items (warranty provisions, pension costs, environmental accruals)
  // can be smaller than interest expense without being financing-related.
  // Suppression requires an explicit non_cash_interest_expense match (Check 1/1b)
  // or gross fallback signal (Check 1c).
  if (interestExpense > 0 && nonCashInterestExpense === 0 && !usedGrossFallback &&
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
 * Guard 7: Finance cost sub-component dedup for other_one_time_expenses.
 *
 * When the AI reads a Finance Costs note (e.g., KITS Note 15c), it may extract
 * fair-value changes (loss on loan estimate changes, loss on promissory note
 * estimate changes) into other_one_time_expenses. But these items are already
 * part of the top-level "interest" field — adding them back double-counts.
 *
 * Condition: when non_cash_interest_expense > 0 (proving the AI read the
 * finance cost note) AND the sum of non_cash_interest_expense + other_one_time_expenses
 * fits within the total interest envelope, the expenses are finance cost sub-items.
 */
function deduplicateFinanceCostExpenses(
  rawOtherOneTimeExpenses: number,
  nonCashInterestExpense: number,
  interestExpense: number,
  tolerance: number
): number {
  if (rawOtherOneTimeExpenses <= 0 || nonCashInterestExpense <= 0 || interestExpense <= 0) {
    return rawOtherOneTimeExpenses;
  }

  // Materiality gate: non_cash_interest_expense must be >= 25% of total interest.
  // This proves the AI found a material non-cash component from the finance cost note,
  // not just a small amortization item. Without this, the envelope test could
  // false-positive on companies with small non-cash interest and coincidentally
  // similar-sized legitimate one-time expenses.
  const nonCashRatio = nonCashInterestExpense / interestExpense;
  if (nonCashRatio < 0.25) {
    return rawOtherOneTimeExpenses;
  }

  // The finance cost envelope includes both cash and non-cash components.
  // If the non-cash portion + the suspected expenses fit within total interest,
  // these expenses are likely sub-line-items from the finance cost note.
  // LIMITATION: This is an arithmetic proxy, not an identity check. The prompt's
  // FINANCE COST SUB-COMPONENT CHECK is the primary prevention; this guard
  // catches cases where the AI ignores that instruction.
  const financeCostSubtotal = nonCashInterestExpense + rawOtherOneTimeExpenses;
  const envelopeMax = interestExpense * (1 + tolerance);

  if (financeCostSubtotal <= envelopeMax) {
    console.warn(
      `⚠️ DEDUP [finance_cost_expenses]: other_one_time_expenses (${rawOtherOneTimeExpenses}) + ` +
      `non_cash_interest_expense (${nonCashInterestExpense}) = ${financeCostSubtotal} ` +
      `fits within interest envelope (${interestExpense}), and non_cash_interest is ` +
      `${(nonCashRatio * 100).toFixed(0)}% of interest (>25% materiality gate). ` +
      `These are likely finance cost sub-components. Zeroing other_one_time_expenses.`
    );
    return 0;
  }

  return rawOtherOneTimeExpenses;
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

function resolveUnrealizedFx(adj: AdjustedEBITDAComponents): number {
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
  rawGainOnDisposal: number | null | undefined,
  tolerance: number
): {
  gainOnAssetSale: number | null;
  otherIncomeNonOperating: number | null;
  otherOneTimeGains: number | null;
  insuranceProceeds: number | null;
  gainOnDisposal: number | null;
} {
  const gainOnAssetSale = rawGainOnAssetSale ?? null;
  let otherIncomeNonOperating = rawOtherIncomeNonOperating ?? null;
  let otherOneTimeGains = rawOtherOneTimeGains ?? null;
  let insuranceProceeds = rawInsuranceProceeds ?? null;
  let gainOnDisposal = rawGainOnDisposal ?? null;

  // Normalise to absolute values for comparison (gains are always positive after Math.abs)
  const absGain = gainOnAssetSale != null ? Math.abs(gainOnAssetSale) : null;
  const absOther = otherIncomeNonOperating != null ? Math.abs(otherIncomeNonOperating) : null;
  const absOneTime = otherOneTimeGains != null ? Math.abs(otherOneTimeGains) : null;
  const absInsurance = insuranceProceeds != null ? Math.abs(insuranceProceeds) : null;
  const absDisposal = gainOnDisposal != null ? Math.abs(gainOnDisposal) : null;

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

  // gain_on_disposal vs gain_on_asset_sale (same economic event, different label)
  if (absDisposal != null && absGain != null && absDisposal > 0 && absGain > 0) {
    if (valuesOverlapWithinTolerance(absDisposal, absGain, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: gain_on_disposal (${gainOnDisposal}) matches ` +
        `gain_on_asset_sale (${gainOnAssetSale}) within ${tolerance * 100}% — ` +
        `zeroing gain_on_disposal (lower priority)`
      );
      gainOnDisposal = 0;
    }
  }

  // gain_on_disposal vs other_one_time_gains
  const absOneTimeAfterGain = otherOneTimeGains != null ? Math.abs(otherOneTimeGains) : null;
  const absDisposalAfterSale = gainOnDisposal != null ? Math.abs(gainOnDisposal) : null;
  if (absDisposalAfterSale != null && absOneTimeAfterGain != null && absDisposalAfterSale > 0 && absOneTimeAfterGain > 0) {
    if (valuesOverlapWithinTolerance(absDisposalAfterSale, absOneTimeAfterGain, tolerance)) {
      console.warn(
        `⚠️ DEDUP [gains]: gain_on_disposal (${gainOnDisposal}) matches ` +
        `other_one_time_gains (${otherOneTimeGains}) within ${tolerance * 100}% — ` +
        `zeroing gain_on_disposal (lower priority)`
      );
      gainOnDisposal = 0;
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

  return { gainOnAssetSale, otherIncomeNonOperating, otherOneTimeGains, insuranceProceeds, gainOnDisposal };
}

/**
 * Calculate Adjusted EBITDA from EBITDA and adjustment components
 * Adjusted EBITDA = EBITDA + Non-cash + One-time Expenses - One-time Gains
 */
export function calculateAdjustedEBITDA(
  ebitda: number,
  metrics: ExtractedMetrics,
  usedGrossFallback: boolean = false
): EBITDACalculationResult {
  const adj = (metrics.adjusted_ebitda_components || {}) as AdjustedEBITDAComponents;

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
    DEDUP_TOLERANCE,
    usedGrossFallback
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FX Handling: Use unrealized_fx_cash_flow (non-cash, from CF statement).
  // Realized FX (realized_fx_pl) is already in net income — logged if material
  // but never adjusts EBITDA.
  // ─────────────────────────────────────────────────────────────────────────
  const unrealizedFxValue = resolveUnrealizedFx(adj);
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
    gainOnDisposal,
  } = deduplicateOneTimeGains(
    adj.gain_on_asset_sale,
    adj.other_income_non_operating,
    adj.other_one_time_gains,
    adj.insurance_proceeds,
    adj.gain_on_disposal,
    DEDUP_TOLERANCE
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Guard 5: Realized FX vs other_income_non_operating dedup
  //
  // The AI sometimes classifies the income statement "Exchange (gain)/loss"
  // line into BOTH realized_fx_pl (informational, correct) AND
  // other_income_non_operating (subtracted from EBITDA, WRONG).
  // Since realized FX is already embedded in net income → already in EBITDA,
  // subtracting it again via other_income_non_operating double-counts it.
  //
  // When the two values match within tolerance, zero out
  // other_income_non_operating to prevent the double-subtraction.
  // ─────────────────────────────────────────────────────────────────────────
  let dedupedOtherIncomeNonOperating = otherIncomeNonOperating;
  const realizedFxPl = adj.realized_fx_pl ?? 0;

  if (
    dedupedOtherIncomeNonOperating != null &&
    Math.abs(dedupedOtherIncomeNonOperating) > 0 &&
    Math.abs(realizedFxPl) > 0 &&
    valuesOverlapWithinTolerance(dedupedOtherIncomeNonOperating, realizedFxPl, DEDUP_TOLERANCE)
  ) {
    console.warn(
      `⚠️ DEDUP [realized_fx]: other_income_non_operating (${dedupedOtherIncomeNonOperating}) matches ` +
      `realized_fx_pl (${realizedFxPl}) within ${DEDUP_TOLERANCE * 100}% — ` +
      `zeroing other_income_non_operating to prevent double-subtraction ` +
      `(realized FX is already in net income → already in EBITDA)`
    );
    dedupedOtherIncomeNonOperating = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Insurance Proceeds materiality check (H8)
  //
  // LIMITATION: The extraction schema does not distinguish business interruption
  // (BI) proceeds from property damage proceeds. BI proceeds represent lost
  // revenue/profit and should remain in EBITDA (not excluded); property damage
  // proceeds are a non-recurring capital recovery and should be excluded.
  // Until the extraction prompt is updated to separate these, flag material
  // insurance proceeds for analyst review rather than silently excluding them.
  // ─────────────────────────────────────────────────────────────────────────
  const insuranceProceedsDeduped = insuranceProceeds ?? 0;
  if (insuranceProceedsDeduped > 0 && ebitda > 0 && insuranceProceedsDeduped / ebitda > 0.05) {
    console.warn(
      `⚠️ INSURANCE PROCEEDS: ${insuranceProceedsDeduped} is ` +
      `>${((insuranceProceedsDeduped / ebitda) * 100).toFixed(1)}% of EBITDA. ` +
      `Review whether this is business interruption (should remain in EBITDA) ` +
      `or property damage (correctly excluded).`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Non-Cash Adjustments (add back)
  // ─────────────────────────────────────────────────────────────────────────
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
    adj.loss_on_disposal,         // non-cash loss on asset disposal (add back)
    deduplicatedOtherNonCash,     // may be zeroed by Guard 1
  ]
    .filter((v): v is number => v != null && v !== 0)
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Guard 7: Finance cost sub-component dedup for other_one_time_expenses
  //
  // When the AI reads a Finance Costs note, it may extract fair-value changes
  // (e.g., "loss on loan estimate changes") into other_one_time_expenses.
  // These are already in the top-level interest field — adding them back
  // double-counts. Check if the sum fits within the interest envelope.
  // ─────────────────────────────────────────────────────────────────────────
  const deduplicatedOtherOneTimeExpenses = deduplicateFinanceCostExpenses(
    adj.other_one_time_expenses ?? 0,
    nonCashInterestExpense,
    interestExpense,
    DEDUP_TOLERANCE
  );

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
    deduplicatedOtherOneTimeExpenses,  // may be zeroed by Guard 7
  ]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Interest Income Exclusion
  //
  // Interest income earned on cash balances is a treasury function, not an
  // operating function. Standard commercial lending removes it from Adjusted
  // EBITDA because:
  // 1. It is rate-sensitive and balance-sensitive (cash may be deployed)
  // 2. It creates asymmetry in coverage analysis (inflates numerator)
  // 3. Virtually all credit agreement EBITDA definitions exclude it
  //
  // GATE: Only subtract when the P&L interest figure was used directly in
  // the EBITDA formula (usedGrossFallback === false). When the fallback
  // chain provided a gross borrowing cost (because the P&L net figure was
  // negative for net-finance-income companies like Taiga), interest income
  // was never added into EBITDA — subtracting it would be a double-deduction.
  //
  // SECONDARY GATE (belt-and-suspenders): If interest_income > interest,
  // the company earns more than it pays. The interest field CANNOT be
  // net-of-income (a net figure would be negative, which calculateEBITDA
  // rejects). So interest income is not embedded in EBITDA and must not
  // be subtracted. This catches edge cases where usedGrossFallback is
  // false but the primary P&L interest is still a gross figure.
  // ─────────────────────────────────────────────────────────────────────────
  const rawInterestIncome = metrics.interest_income ?? 0;
  let interestIncomeExcluded = 0;

  if (rawInterestIncome > 0) {
    if (usedGrossFallback) {
      // Fallback was used — interest field is gross borrowing costs.
      // Interest income was never in EBITDA. Do NOT subtract.
      console.warn(
        `⚠️ INTEREST INCOME GATE: Suppressing ${rawInterestIncome} interest income exclusion — ` +
        `EBITDA used gross fallback interest (P&L net was negative/null). ` +
        `Interest income was never added to EBITDA; subtracting it would double-deduct.`
      );
    } else if (rawInterestIncome > interestExpense && interestExpense > 0) {
      // Arithmetic heuristic: interest_income > interest means the company
      // earns more than it pays. The interest field cannot be net-of-income
      // (net would be negative → rejected). Suppress subtraction.
      console.warn(
        `⚠️ INTEREST INCOME GATE: Suppressing ${rawInterestIncome} interest income exclusion — ` +
        `interest_income (${rawInterestIncome}) > interest (${interestExpense}). ` +
        `Interest field cannot be net-of-income; suppressing to avoid double-deduction.`
      );
    } else {
      // Primary P&L interest was used. This may be a net figure (gross - interest income).
      // Interest income inflates EBITDA and must be subtracted.
      interestIncomeExcluded = rawInterestIncome;

      if (ebitda > 0) {
        const materialityPct = interestIncomeExcluded / ebitda;
        if (materialityPct > 0.05) {
          console.warn(
            `⚠️ INTEREST INCOME EXCLUSION: Removing ${interestIncomeExcluded} interest income from ` +
            `Adjusted EBITDA (${(materialityPct * 100).toFixed(1)}% of base EBITDA). ` +
            `Non-operating treasury income. If structural, analyst may elect to retain it.`
          );
        }
      }
    }
  }

  // Guard 6: interest_income vs other_income_non_operating dedup
  // If the AI lumps interest income into other_income_non_operating AND also
  // extracts interest_income separately, we'd subtract it twice. When the two
  // values match within tolerance, zero out other_income_non_operating.
  if (
    interestIncomeExcluded > 0 &&
    dedupedOtherIncomeNonOperating != null &&
    Math.abs(dedupedOtherIncomeNonOperating) > 0 &&
    valuesOverlapWithinTolerance(interestIncomeExcluded, dedupedOtherIncomeNonOperating, DEDUP_TOLERANCE)
  ) {
    console.warn(
      `⚠️ DEDUP [interest_income]: interest_income (${interestIncomeExcluded}) matches ` +
      `other_income_non_operating (${dedupedOtherIncomeNonOperating}) within ${DEDUP_TOLERANCE * 100}% — ` +
      `zeroing other_income_non_operating (interest_income is more specific)`
    );
    dedupedOtherIncomeNonOperating = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // One-Time Gains (subtract)
  //
  // NOTE: Gains/income values should ALWAYS be subtracted from EBITDA.
  // The AI may extract them as negative (due to parentheses in financial statements).
  // We use Math.abs() to normalize: gains are ALWAYS positive, then subtracted.
  // ─────────────────────────────────────────────────────────────────────────

  const oneTimeGains = [
    gainOnAssetSale,                  // deduped against other_one_time_gains and other_income_non_operating
    gainOnDisposal,                   // deduped against gain_on_asset_sale and other_one_time_gains
    dedupedOtherIncomeNonOperating,   // deduped against gain_on_asset_sale, realized_fx_pl, AND interest_income
    insuranceProceeds,                // deduped against other_income_non_operating
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

  // ─────────────────────────────────────────────────────────────────────────
  // Pro Forma Adjustments with 15% cap
  //
  // Uncapped pro forma adjustments (cost savings, synergies) can materially
  // inflate Adjusted EBITDA without supporting evidence. Conservative
  // commercial lending practice caps pro forma additions at 15% of base
  // EBITDA to limit the risk of speculative forward-looking adjustments.
  // ─────────────────────────────────────────────────────────────────────────
  const PRO_FORMA_CAP_PCT = 0.15;

  const rawProFormaAdjustments = [adj.pro_forma_cost_savings, adj.pro_forma_synergies]
    .filter((v): v is number => v != null)
    .reduce((sum, v) => sum + v, 0);

  const proFormaCap = Math.abs(ebitda) * PRO_FORMA_CAP_PCT;
  const proFormaAdjustments =
    rawProFormaAdjustments > proFormaCap && ebitda !== 0
      ? proFormaCap
      : rawProFormaAdjustments;

  if (rawProFormaAdjustments > proFormaCap && ebitda !== 0) {
    console.warn(
      `⚠️ PRO FORMA CAP: Raw pro forma adjustments (${rawProFormaAdjustments}) exceed ` +
      `${PRO_FORMA_CAP_PCT * 100}% of EBITDA (${ebitda}). Capped at ${proFormaCap.toFixed(2)}.`
    );
  }

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
      oneTimeGains -
      interestIncomeExcluded
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
      `gains subtracted: ${oneTimeGains}, interest_income: ${interestIncomeExcluded}. ` +
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
      interest_income_excluded: interestIncomeExcluded,
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
      other_one_time_expenses: deduplicatedOtherOneTimeExpenses,
    },
  };
}
