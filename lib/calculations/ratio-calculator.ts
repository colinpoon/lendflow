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

  const totalCapital = totalDebt + shareholdersEquity;
  // When total capital is zero (equity exactly offsets debt), ratio is undefined.
  if (totalCapital === 0) return null;

  // Negative equity produces a ratio > 100%, which is a critical distress signal.
  // Return the actual value so analysts can see the severity rather than N/A.
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

  // Negative EBITDA produces a negative leverage ratio (e.g. -3x) that is a
  // critical distress signal — return the actual value so analysts can quantify it.
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

  // Negative equity produces a negative D/E ratio (e.g. -2.5x), which is a
  // critical solvency signal — return the actual value so analysts can see it.
  return parseFloat((totalDebt / shareholdersEquity).toFixed(2));
}

/**
 * Calculate Net Profit Margin
 * Profit Margin = Net Income / Revenue
 * @returns Decimal value (e.g., 0.15 for 15%) or null if cannot be calculated
 */
export function calculateProfitMargin(
  netIncome: number | null,
  revenue: number | null
): number | null {
  if (netIncome == null || revenue == null || revenue === 0) return null;

  return parseFloat((netIncome / revenue).toFixed(4));
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
