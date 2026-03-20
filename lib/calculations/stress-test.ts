/**
 * Deterministic EBITDA stress testing for sensitivity analysis.
 *
 * Applies percentage haircuts to Adjusted EBITDA and recomputes
 * FCCR and Sr Debt/EBITDA under each scenario. No AI involved —
 * purely arithmetic based on already-extracted metrics.
 */

export interface StressScenario {
  label: string;
  /** Haircut as a decimal (e.g., 0 = base, 0.10 = -10%) */
  haircut: number;
  adjustedEbitda: number;
  fccr: number | null;
  seniorDebtToEbitda: number | null;
}

export interface StressTestResult {
  year: string;
  scenarios: StressScenario[];
}

/**
 * Standard stress haircuts used in commercial banking.
 * Base (0%), Moderate (-10%), Severe (-20%).
 */
const STRESS_HAIRCUTS = [
  { label: 'Base', haircut: 0 },
  { label: 'Moderate (-10%)', haircut: 0.10 },
  { label: 'Severe (-20%)', haircut: 0.20 },
] as const;

interface StressInputs {
  adjustedEbitda: number | null;
  /** FCCR numerator: Adjusted EBITDA - taxes - capex - distributions */
  fccrNumerator: number | null;
  /** Total fixed charges (denominator of FCCR) */
  totalFixedCharges: number | null;
  seniorDebt: number | null;
}

/**
 * Compute stress scenarios for a single year.
 *
 * FCCR stress: The EBITDA haircut flows through to the numerator
 * (EBITDA is the largest component). Fixed charges (denominator)
 * stay constant since they're contractual obligations.
 *
 * Sr Debt/EBITDA stress: Senior debt stays constant; only EBITDA
 * changes. Lower EBITDA = higher leverage ratio.
 */
export function computeStressScenarios(
  year: string,
  inputs: StressInputs
): StressTestResult | null {
  const { adjustedEbitda, fccrNumerator, totalFixedCharges, seniorDebt } = inputs;

  if (adjustedEbitda == null || adjustedEbitda === 0) return null;

  const scenarios: StressScenario[] = STRESS_HAIRCUTS.map(({ label, haircut }) => {
    const stressedEbitda = adjustedEbitda * (1 - haircut);
    const ebitdaDelta = adjustedEbitda * haircut;

    // FCCR: reduce numerator by the same EBITDA delta
    let stressedFccr: number | null = null;
    if (fccrNumerator != null && totalFixedCharges != null && totalFixedCharges !== 0) {
      const stressedNumerator = fccrNumerator - ebitdaDelta;
      stressedFccr = parseFloat((stressedNumerator / totalFixedCharges).toFixed(2));
    }

    // Sr Debt / EBITDA: debt is fixed, EBITDA decreases
    let stressedLeverage: number | null = null;
    if (seniorDebt != null && stressedEbitda !== 0) {
      stressedLeverage = parseFloat((seniorDebt / stressedEbitda).toFixed(2));
    }

    return {
      label,
      haircut,
      adjustedEbitda: parseFloat(stressedEbitda.toFixed(0)),
      fccr: stressedFccr,
      seniorDebtToEbitda: stressedLeverage,
    };
  });

  return { year, scenarios };
}
