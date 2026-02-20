/**
 * Financial ratio calculation utilities
 * Calculates leverage and coverage ratios
 */

/**
 * Calculate Total Debt to Total Capital ratio
 * Total Capital = Total Debt + Shareholders Equity
 * @returns Ratio value or null if cannot be calculated
 */
export function calculateTotalDebtToCapital(
  totalDebt: number | null,
  shareholdersEquity: number | null
): number | null {
  if (totalDebt == null || shareholdersEquity == null) return null;

  // Negative equity produces a mathematically correct but analytically meaningless
  // ratio (e.g. 1000%+). Return null so callers display N/A rather than mislead analysts.
  if (shareholdersEquity < 0) return null;

  const totalCapital = totalDebt + shareholdersEquity;
  if (totalCapital === 0) return null;

  return parseFloat((totalDebt / totalCapital).toFixed(4));
}

/**
 * Calculate Senior Debt to EBITDA ratio
 * Uses Adjusted EBITDA for more accurate leverage assessment
 * @returns Ratio value or null if cannot be calculated
 */
export function calculateSeniorDebtToEBITDA(
  seniorDebt: number | null,
  ebitda: number | null
): number | null {
  if (seniorDebt == null || ebitda == null || ebitda === 0) return null;

  // Negative EBITDA produces a meaningless negative leverage ratio that can be
  // mistaken for a low-leverage result. Return null to force an explicit N/A display.
  if (ebitda < 0) return null;

  return parseFloat((seniorDebt / ebitda).toFixed(2));
}

/**
 * Calculate Interest Coverage Ratio
 * ICR = EBITDA / Interest Expense
 * @returns Ratio value or null if cannot be calculated
 */
export function calculateInterestCoverageRatio(
  ebitda: number | null,
  interest: number | null
): number | null {
  if (ebitda == null || interest == null || interest === 0) return null;

  return parseFloat((ebitda / interest).toFixed(2));
}

/**
 * Calculate Debt to Equity Ratio
 * D/E = Total Debt / Shareholders Equity
 * @returns Ratio value or null if cannot be calculated
 */
export function calculateDebtToEquityRatio(
  totalDebt: number | null,
  shareholdersEquity: number | null
): number | null {
  if (totalDebt == null || shareholdersEquity == null || shareholdersEquity === 0) {
    return null;
  }

  // Negative equity flips the sign of D/E, producing a ratio like -2.5x that signals
  // solvency risk but misleads automated scoring. Return null; surface the negative equity
  // condition directly to analysts rather than through a distorted ratio.
  if (shareholdersEquity < 0) return null;

  return parseFloat((totalDebt / shareholdersEquity).toFixed(2));
}

/**
 * Calculate Current Ratio (Liquidity Ratio)
 * Current Ratio = Current Assets / Current Liabilities
 * Measures ability to pay short-term obligations
 * @returns Ratio value or null if cannot be calculated
 */
export function calculateCurrentRatio(
  currentAssets: number | null,
  currentLiabilities: number | null
): number | null {
  if (currentAssets == null || currentLiabilities == null || currentLiabilities === 0) {
    return null;
  }

  return parseFloat((currentAssets / currentLiabilities).toFixed(2));
}
