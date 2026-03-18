/**
 * Client-safe covenant recalculation utility
 *
 * Re-runs only the calculations that are sensitive to covenant configuration
 * (lease debt treatment, CapEx treatment, operating lease treatment) without
 * touching AI-extracted values or EBITDA-level calculations that don't depend
 * on these parameters.
 *
 * All calculators imported here are pure TypeScript functions — no Node.js or
 * server-only APIs — so this module is safe to use in Client Components.
 *
 * Recalculation scope per year:
 *   1. Debt metrics  — senior_debt, total_debt, debt_breakdown
 *   2. Ratio updates — senior_debt_to_ebitda, total_debt_to_capital
 *   3. FCCR          — fccr, fccr_numerator, total_fixed_charges,
 *                       cash_flow_for_debt_servicing, fccr_breakdown
 *
 * Everything else (adjusted_ebitda, dscr, funded_debt, interest_coverage_ratio,
 * current_ratio, debt_to_equity_ratio, all extraction fields) is preserved
 * unchanged from the original server-computed data.
 */

import type {
  ComputedMetrics,
  CapexTreatmentConfig,
  LeaseDebtTreatmentConfig,
  OperatingLeaseConfig,
} from '@/types';
import {
  calculateDebtMetrics,
  calculateFCCR,
  calculateSeniorDebtToEBITDA,
  calculateTotalDebtToCapital,
} from '@/lib/calculations';

// ─────────────────────────────────────────────────────────────────────────────
// Covenant Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CovenantConfig {
  capexTreatment: CapexTreatmentConfig;
  leaseDebtTreatment: LeaseDebtTreatmentConfig;
  operatingLeaseTreatment: OperatingLeaseConfig;
}

export const DEFAULT_COVENANT_CONFIG: CovenantConfig = {
  capexTreatment: { mode: 'unfunded' },
  leaseDebtTreatment: { mode: 'include' },
  operatingLeaseTreatment: { mode: 'exclude' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Recalculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-run covenant-sensitive calculations for every year in the metrics map.
 *
 * The input map is deep-cloned before modification so the caller's original
 * server data is never mutated — callers can store both the raw server copy
 * and the recalculated copy independently.
 *
 * @param metricsMap  - The original metrics_by_year map from the server
 * @param config      - Covenant parameter overrides chosen by the user
 * @returns A new map with updated debt, ratio, and FCCR fields
 */
export function recalculateWithCovenantConfig(
  metricsMap: Record<string, ComputedMetrics>,
  config: CovenantConfig
): Record<string, ComputedMetrics> {
  // Deep clone to guarantee immutability of the original
  const result: Record<string, ComputedMetrics> = JSON.parse(
    JSON.stringify(metricsMap)
  );

  for (const [year, m] of Object.entries(result)) {
    // ── 1. Debt metrics ───────────────────────────────────────────────────
    const debtResult = calculateDebtMetrics(m, config.leaseDebtTreatment);

    m.senior_debt = debtResult.senior_debt;
    m.total_debt = debtResult.total_debt;
    m.debt_breakdown = debtResult.debt_breakdown;

    // ── 2. Leverage ratios (depend on the updated debt figures) ───────────
    const adjustedEbitda = m.adjusted_ebitda;
    const equity = m.shareholders_equity;

    m.senior_debt_to_ebitda = calculateSeniorDebtToEBITDA(
      debtResult.senior_debt,
      adjustedEbitda
    );
    m.total_debt_to_capital = calculateTotalDebtToCapital(
      debtResult.total_debt,
      equity
    );

    // ── 3. FCCR (depends on CapEx and operating lease treatment) ──────────
    const fccrResult = calculateFCCR(
      adjustedEbitda,
      m,
      config.capexTreatment,
      year,
      config.operatingLeaseTreatment
    );

    m.fccr = fccrResult.fccr;
    m.fccr_numerator = fccrResult.fccr_numerator;
    m.total_fixed_charges = fccrResult.total_fixed_charges;
    m.cash_flow_for_debt_servicing = fccrResult.cash_flow_for_debt_servicing;
    m.fccr_breakdown = fccrResult.fccr_breakdown;
  }

  return result;
}
