/**
 * Quantitative Risk Scoring Module
 *
 * Implements a 5-metric weighted risk assessment with trend modifiers:
 * - EBITDA Trend (22%)
 * - FCCR (28%)
 * - Senior Leverage (22%)
 * - Debt/Capital (14%)
 * - Current Ratio (14%)
 *
 * Each metric scored 1-5, normalized to 0-100 scale.
 * Trends calculated as average annual change across all available years.
 */

import type { ComputedMetrics } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricScore {
  name: string;
  weight: number;
  values_by_year: Record<string, number | null>;
  current_value: number | null;
  avg_annual_change_pct: number | null;
  trend: 'strong_positive' | 'positive' | 'stable' | 'negative' | 'strong_negative' | null;
  trend_direction: 'improving' | 'stable' | 'worsening' | null;
  base_score: number;
  trend_modifier: number;
  adjusted_score: number;
  rationale: string;
}

export interface QuantitativeRiskAssessment {
  metrics: MetricScore[];
  weighted_raw_score: number;
  normalized_score: number;
  risk_band: 'Low Risk' | 'Moderate Risk' | 'Elevated Risk' | 'High Risk' | 'Distressed';
  trend_summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring Configuration
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_CONFIG = {
  ebitda_trend: {
    name: 'EBITDA Trend',
    weight: 0.22,
    // For EBITDA trend, we score the average annual change itself
    // Higher growth = lower score (better)
    bands: [
      { min: 10, max: Infinity, score: 1 },   // >10% growth
      { min: 3, max: 10, score: 2 },          // 3-10% growth
      { min: -3, max: 3, score: 3 },          // -3% to 3% (flat)
      { min: -10, max: -3, score: 4 },        // -3% to -10% decline
      { min: -Infinity, max: -10, score: 5 }, // <-10% decline
    ],
    higher_is_better: true,
  },
  fccr: {
    name: 'FCCR',
    weight: 0.28,
    bands: [
      { min: 2.0, max: Infinity, score: 1 },  // >=2.00x
      { min: 1.5, max: 2.0, score: 2 },       // 1.50x to 1.99x
      { min: 1.2, max: 1.5, score: 3 },       // 1.20x to 1.49x
      { min: 1.0, max: 1.2, score: 4 },       // 1.00x to 1.19x
      { min: -Infinity, max: 1.0, score: 5 }, // <1.00x
    ],
    higher_is_better: true,
  },
  senior_leverage: {
    name: 'Senior Leverage',
    weight: 0.22,
    bands: [
      { min: -Infinity, max: 1.5, score: 1 }, // <=1.50x
      { min: 1.5, max: 2.5, score: 2 },       // 1.51x to 2.50x
      { min: 2.5, max: 3.5, score: 3 },       // 2.51x to 3.50x
      { min: 3.5, max: 4.5, score: 4 },       // 3.51x to 4.50x
      { min: 4.5, max: Infinity, score: 5 },  // >4.50x
    ],
    higher_is_better: false, // Lower leverage is better
  },
  debt_capital: {
    name: 'Debt / Capital',
    weight: 0.14,
    bands: [
      { min: -Infinity, max: 0.30, score: 1 }, // <=30%
      { min: 0.30, max: 0.45, score: 2 },      // 31% to 45%
      { min: 0.45, max: 0.60, score: 3 },      // 46% to 60%
      { min: 0.60, max: 0.75, score: 4 },      // 61% to 75%
      { min: 0.75, max: Infinity, score: 5 },  // >75%
    ],
    higher_is_better: false, // Lower debt ratio is better
  },
  current_ratio: {
    name: 'Current Ratio',
    weight: 0.14,
    bands: [
      { min: 2.0, max: Infinity, score: 1 },  // >=2.00x
      { min: 1.5, max: 2.0, score: 2 },       // 1.50x to 1.99x
      { min: 1.2, max: 1.5, score: 3 },       // 1.20x to 1.49x
      { min: 1.0, max: 1.2, score: 4 },       // 1.00x to 1.19x
      { min: -Infinity, max: 1.0, score: 5 }, // <1.00x
    ],
    higher_is_better: true,
  },
} as const;

// Trend modifier thresholds (based on avg annual change %)
const TREND_MODIFIERS = [
  { min: 10, max: Infinity, trend: 'strong_positive' as const, modifier: 1.0 },
  { min: 3, max: 10, trend: 'positive' as const, modifier: 0.5 },
  { min: -3, max: 3, trend: 'stable' as const, modifier: 0 },
  { min: -10, max: -3, trend: 'negative' as const, modifier: -0.5 },
  { min: -Infinity, max: -10, trend: 'strong_negative' as const, modifier: -1.0 },
];

// Risk bands based on normalized 0-100 score
const RISK_BANDS = [
  { min: 0, max: 20, band: 'Low Risk' as const },
  { min: 20, max: 40, band: 'Moderate Risk' as const },
  { min: 40, max: 60, band: 'Elevated Risk' as const },
  { min: 60, max: 80, band: 'High Risk' as const },
  { min: 80, max: 100, band: 'Distressed' as const },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate average annual change across all years
 * Returns percentage change (e.g., 8.5 for 8.5%)
 */
function calculateAvgAnnualChange(values: (number | null)[]): number | null {
  const validValues = values.filter((v): v is number => v != null && isFinite(v));

  if (validValues.length < 2) return null;

  const changes: number[] = [];
  for (let i = 1; i < validValues.length; i++) {
    const prev = validValues[i - 1];
    const curr = validValues[i];
    if (prev !== 0) {
      changes.push(((curr - prev) / Math.abs(prev)) * 100);
    }
  }

  if (changes.length === 0) return null;

  const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length;
  return Math.round(avgChange * 10) / 10; // Round to 1 decimal
}

/**
 * Get base score from value using bands
 */
function getBaseScore(
  value: number | null,
  bands: readonly { min: number; max: number; score: number }[]
): number {
  if (value == null || !isFinite(value)) return 3; // Default to middle score

  for (const band of bands) {
    if (value > band.min && value <= band.max) {
      return band.score;
    }
    // Handle edge case for first band (min is -Infinity)
    if (band.min === -Infinity && value <= band.max) {
      return band.score;
    }
  }

  return 3; // Fallback
}

/**
 * Get trend and modifier from average annual change
 * For metrics where higher is better, positive change = improving
 * For metrics where lower is better, negative change = improving
 */
function getTrendModifier(
  avgChange: number | null,
  higherIsBetter: boolean
): { trend: MetricScore['trend']; modifier: number; direction: MetricScore['trend_direction'] } {
  if (avgChange == null) {
    return { trend: null, modifier: 0, direction: null };
  }

  // Normalize change direction based on what's "good"
  const effectiveChange = higherIsBetter ? avgChange : -avgChange;

  for (const t of TREND_MODIFIERS) {
    if (effectiveChange > t.min && effectiveChange <= t.max) {
      const direction: MetricScore['trend_direction'] =
        t.modifier > 0 ? 'improving' :
        t.modifier < 0 ? 'worsening' : 'stable';
      return { trend: t.trend, modifier: t.modifier, direction };
    }
    if (t.min === -Infinity && effectiveChange <= t.max) {
      return { trend: t.trend, modifier: t.modifier, direction: 'worsening' };
    }
  }

  return { trend: 'stable', modifier: 0, direction: 'stable' };
}

/**
 * Get risk band from normalized score
 */
function getRiskBand(normalizedScore: number): QuantitativeRiskAssessment['risk_band'] {
  for (const band of RISK_BANDS) {
    if (normalizedScore >= band.min && normalizedScore < band.max) {
      return band.band;
    }
  }
  return 'Distressed';
}

/**
 * Format value for display in rationale
 */
function formatValue(value: number | null, isPercent: boolean = false): string {
  if (value == null) return 'N/A';
  if (isPercent) return `${(value * 100).toFixed(1)}%`;
  return `${value.toFixed(2)}x`;
}

/**
 * Generate rationale text for a metric
 */
function generateRationale(
  name: string,
  currentValue: number | null,
  baseScore: number,
  avgChange: number | null,
  trendDirection: MetricScore['trend_direction'],
  isPercent: boolean = false
): string {
  const valueStr = formatValue(currentValue, isPercent);
  const scoreLabel = baseScore <= 2 ? 'Strong' : baseScore <= 3 ? 'Good' : baseScore <= 4 ? 'Weak' : 'Poor';

  let rationale = `${name} of ${valueStr} (${scoreLabel}).`;

  if (avgChange != null && trendDirection) {
    const changeStr = avgChange >= 0 ? `+${avgChange}%` : `${avgChange}%`;
    const trendLabel = trendDirection === 'improving' ? 'Improving' :
                       trendDirection === 'worsening' ? 'Declining' : 'Stable';
    rationale += ` ${trendLabel} ${changeStr} avg annually.`;
  }

  return rationale;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calculation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate quantitative risk assessment from financial metrics
 */
export function calculateQuantitativeRisk(
  metricsByYear: Record<string, ComputedMetrics>
): QuantitativeRiskAssessment | null {
  const years = Object.keys(metricsByYear).sort();

  if (years.length === 0) return null;

  const latestYear = years[years.length - 1];
  const latestMetrics = metricsByYear[latestYear];

  const metrics: MetricScore[] = [];

  // 1. EBITDA Trend - special case: we score the trend itself, not a current value
  const ebitdaValues = years.map(y => metricsByYear[y].adjusted_ebitda ?? metricsByYear[y].ebitda);
  const ebitdaAvgChange = calculateAvgAnnualChange(ebitdaValues);
  const ebitdaConfig = METRIC_CONFIG.ebitda_trend;
  const ebitdaBaseScore = ebitdaAvgChange != null
    ? getBaseScore(ebitdaAvgChange, ebitdaConfig.bands)
    : 3;

  metrics.push({
    name: ebitdaConfig.name,
    weight: ebitdaConfig.weight,
    values_by_year: Object.fromEntries(years.map(y => [y, metricsByYear[y].adjusted_ebitda ?? metricsByYear[y].ebitda])),
    current_value: ebitdaAvgChange, // For EBITDA trend, "current value" is the trend %
    avg_annual_change_pct: ebitdaAvgChange,
    trend: ebitdaAvgChange != null ? (ebitdaAvgChange > 3 ? 'positive' : ebitdaAvgChange < -3 ? 'negative' : 'stable') : null,
    trend_direction: ebitdaAvgChange != null ? (ebitdaAvgChange > 3 ? 'improving' : ebitdaAvgChange < -3 ? 'worsening' : 'stable') : null,
    base_score: ebitdaBaseScore,
    trend_modifier: 0, // No additional trend modifier for EBITDA trend - it IS the trend
    adjusted_score: ebitdaBaseScore,
    rationale: ebitdaAvgChange != null
      ? `EBITDA ${ebitdaAvgChange >= 0 ? 'growing' : 'declining'} at ${ebitdaAvgChange >= 0 ? '+' : ''}${ebitdaAvgChange}% avg annually.`
      : 'Insufficient data to calculate EBITDA trend.',
  });

  // 2. FCCR
  const fccrValues = years.map(y => metricsByYear[y].fccr);
  const fccrAvgChange = calculateAvgAnnualChange(fccrValues);
  const fccrConfig = METRIC_CONFIG.fccr;
  const fccrBaseScore = getBaseScore(latestMetrics.fccr, fccrConfig.bands);
  const fccrTrend = getTrendModifier(fccrAvgChange, fccrConfig.higher_is_better);
  const fccrAdjustedScore = Math.max(1, Math.min(5, fccrBaseScore - fccrTrend.modifier));

  metrics.push({
    name: fccrConfig.name,
    weight: fccrConfig.weight,
    values_by_year: Object.fromEntries(years.map(y => [y, metricsByYear[y].fccr])),
    current_value: latestMetrics.fccr,
    avg_annual_change_pct: fccrAvgChange,
    trend: fccrTrend.trend,
    trend_direction: fccrTrend.direction,
    base_score: fccrBaseScore,
    trend_modifier: fccrTrend.modifier,
    adjusted_score: fccrAdjustedScore,
    rationale: generateRationale('FCCR', latestMetrics.fccr, fccrBaseScore, fccrAvgChange, fccrTrend.direction),
  });

  // 3. Senior Leverage (Senior Debt / EBITDA)
  const leverageValues = years.map(y => metricsByYear[y].senior_debt_to_ebitda);
  const leverageAvgChange = calculateAvgAnnualChange(leverageValues);
  const leverageConfig = METRIC_CONFIG.senior_leverage;
  const leverageBaseScore = getBaseScore(latestMetrics.senior_debt_to_ebitda, leverageConfig.bands);
  const leverageTrend = getTrendModifier(leverageAvgChange, leverageConfig.higher_is_better);
  const leverageAdjustedScore = Math.max(1, Math.min(5, leverageBaseScore - leverageTrend.modifier));

  metrics.push({
    name: leverageConfig.name,
    weight: leverageConfig.weight,
    values_by_year: Object.fromEntries(years.map(y => [y, metricsByYear[y].senior_debt_to_ebitda])),
    current_value: latestMetrics.senior_debt_to_ebitda,
    avg_annual_change_pct: leverageAvgChange,
    trend: leverageTrend.trend,
    trend_direction: leverageTrend.direction,
    base_score: leverageBaseScore,
    trend_modifier: leverageTrend.modifier,
    adjusted_score: leverageAdjustedScore,
    rationale: generateRationale('Senior Leverage', latestMetrics.senior_debt_to_ebitda, leverageBaseScore, leverageAvgChange, leverageTrend.direction),
  });

  // 4. Debt / Capital
  const debtCapitalValues = years.map(y => metricsByYear[y].total_debt_to_capital);
  const debtCapitalAvgChange = calculateAvgAnnualChange(debtCapitalValues);
  const debtCapitalConfig = METRIC_CONFIG.debt_capital;
  const debtCapitalBaseScore = getBaseScore(latestMetrics.total_debt_to_capital, debtCapitalConfig.bands);
  const debtCapitalTrend = getTrendModifier(debtCapitalAvgChange, debtCapitalConfig.higher_is_better);
  const debtCapitalAdjustedScore = Math.max(1, Math.min(5, debtCapitalBaseScore - debtCapitalTrend.modifier));

  metrics.push({
    name: debtCapitalConfig.name,
    weight: debtCapitalConfig.weight,
    values_by_year: Object.fromEntries(years.map(y => [y, metricsByYear[y].total_debt_to_capital])),
    current_value: latestMetrics.total_debt_to_capital,
    avg_annual_change_pct: debtCapitalAvgChange,
    trend: debtCapitalTrend.trend,
    trend_direction: debtCapitalTrend.direction,
    base_score: debtCapitalBaseScore,
    trend_modifier: debtCapitalTrend.modifier,
    adjusted_score: debtCapitalAdjustedScore,
    rationale: generateRationale('Debt/Capital', latestMetrics.total_debt_to_capital, debtCapitalBaseScore, debtCapitalAvgChange, debtCapitalTrend.direction, true),
  });

  // 5. Current Ratio
  const currentRatioValues = years.map(y => metricsByYear[y].current_ratio);
  const currentRatioAvgChange = calculateAvgAnnualChange(currentRatioValues);
  const currentRatioConfig = METRIC_CONFIG.current_ratio;
  const currentRatioBaseScore = getBaseScore(latestMetrics.current_ratio, currentRatioConfig.bands);
  const currentRatioTrend = getTrendModifier(currentRatioAvgChange, currentRatioConfig.higher_is_better);
  const currentRatioAdjustedScore = Math.max(1, Math.min(5, currentRatioBaseScore - currentRatioTrend.modifier));

  metrics.push({
    name: currentRatioConfig.name,
    weight: currentRatioConfig.weight,
    values_by_year: Object.fromEntries(years.map(y => [y, metricsByYear[y].current_ratio])),
    current_value: latestMetrics.current_ratio,
    avg_annual_change_pct: currentRatioAvgChange,
    trend: currentRatioTrend.trend,
    trend_direction: currentRatioTrend.direction,
    base_score: currentRatioBaseScore,
    trend_modifier: currentRatioTrend.modifier,
    adjusted_score: currentRatioAdjustedScore,
    rationale: generateRationale('Current Ratio', latestMetrics.current_ratio, currentRatioBaseScore, currentRatioAvgChange, currentRatioTrend.direction),
  });

  // Calculate weighted raw score (1-5 scale)
  const weightedRawScore = metrics.reduce(
    (sum, m) => sum + m.adjusted_score * m.weight,
    0
  );

  // Normalize to 0-100 scale: (score - 1) / 4 * 100
  const normalizedScore = Math.round(((weightedRawScore - 1) / 4) * 100);

  // Determine risk band
  const riskBand = getRiskBand(normalizedScore);

  // Generate trend summary
  const improvingCount = metrics.filter(m => m.trend_direction === 'improving').length;
  const worseningCount = metrics.filter(m => m.trend_direction === 'worsening').length;
  const trendSummary = `${improvingCount} of ${metrics.length} metrics improving, ${worseningCount} worsening`;

  return {
    metrics,
    weighted_raw_score: Math.round(weightedRawScore * 100) / 100,
    normalized_score: normalizedScore,
    risk_band: riskBand,
    trend_summary: trendSummary,
  };
}
