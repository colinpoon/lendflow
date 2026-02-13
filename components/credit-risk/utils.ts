/**
 * Credit Risk Dashboard Utilities
 * Formatting, color helpers, and data transforms
 */

import type {
  HealthLevel,
  HealthConfig,
  RiskBand,
  LendingDecision,
  YearMetrics,
  TrendDataPoint,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Color & Style Constants
// ─────────────────────────────────────────────────────────────────────────────

export const HEALTH_COLORS: Record<HealthLevel, { color: string; bg: string; text: string }> = {
  excellent: { color: '#22c55e', bg: 'bg-green-500', text: 'text-green-600' },
  good: { color: '#4ade80', bg: 'bg-green-400', text: 'text-green-600' },
  adequate: { color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-600' },
  weak: { color: '#f87171', bg: 'bg-red-400', text: 'text-red-600' },
  poor: { color: '#ef4444', bg: 'bg-red-500', text: 'text-red-600' },
};

export const RISK_BAND_STYLES: Record<RiskBand, { bg: string; text: string; border: string }> = {
  'Low Risk': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  'Moderate Risk': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  'Elevated Risk': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  'High Risk': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  'Distressed': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
};

export const LENDING_DECISION_STYLES: Record<LendingDecision, { bg: string; text: string }> = {
  'Approve': { bg: 'bg-green-100', text: 'text-green-700' },
  'Approve with Conditions': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Review Required': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Decline': { bg: 'bg-red-100', text: 'text-red-700' },
};

// Chart colors for ratio trends
export const CHART_COLORS = {
  fccr: '#3b82f6',        // blue-500
  seniorDebtEbitda: '#8b5cf6', // violet-500
  debtCapital: '#f59e0b',  // amber-500
  currentRatio: '#10b981', // emerald-500
};

// ─────────────────────────────────────────────────────────────────────────────
// Formatting Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format currency values (displayed in thousands)
 */
export const formatCurrency = (value: number | null): string => {
  if (value == null) return 'N/A';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  return `${sign}$${absValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
};

/**
 * Format ratio values (e.g., 1.85x)
 */
export const formatRatio = (value: number | null, decimals: number = 2): string => {
  if (value == null) return 'N/A';
  return `${value.toFixed(decimals)}x`;
};

/**
 * Format percentage values (e.g., 45.2%)
 */
export const formatPercent = (value: number | null, decimals: number = 1): string => {
  if (value == null) return 'N/A';
  return `${(value * 100).toFixed(decimals)}%`;
};

/**
 * Format change percentage with sign
 */
export const formatChange = (value: number | null): string => {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Health Assessment Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get health rating label
 */
export const getHealthLabel = (level: HealthLevel): string => {
  const labels: Record<HealthLevel, string> = {
    excellent: 'Excellent',
    good: 'Good',
    adequate: 'Adequate',
    weak: 'Weak',
    poor: 'Poor',
  };
  return labels[level];
};

/**
 * FCCR health assessment (higher is better)
 * Excellent (2.0+), Good (1.5-1.99), Adequate (1.2-1.49), Weak (1.0-1.19), Poor (<1.0)
 */
export const getFCCRHealth = (value: number): HealthConfig => {
  const config = HEALTH_COLORS;
  if (value >= 2.0) return { level: 'excellent', color: config.excellent.color, bgClass: config.excellent.bg, textClass: config.excellent.text, percentage: 100 };
  if (value >= 1.5) return { level: 'good', color: config.good.color, bgClass: config.good.bg, textClass: config.good.text, percentage: 80 };
  if (value >= 1.2) return { level: 'adequate', color: config.adequate.color, bgClass: config.adequate.bg, textClass: config.adequate.text, percentage: 60 };
  if (value >= 1.0) return { level: 'weak', color: config.weak.color, bgClass: config.weak.bg, textClass: config.weak.text, percentage: 40 };
  return { level: 'poor', color: config.poor.color, bgClass: config.poor.bg, textClass: config.poor.text, percentage: 20 };
};

/**
 * Senior Debt/EBITDA health assessment (lower is better)
 * Excellent (<=1.5), Good (1.5-2.5), Adequate (2.5-3.0), Weak (3.0-4.0), Poor (>4.0)
 */
export const getSeniorDebtEBITDAHealth = (value: number): HealthConfig => {
  const config = HEALTH_COLORS;
  if (value <= 1.5) return { level: 'excellent', color: config.excellent.color, bgClass: config.excellent.bg, textClass: config.excellent.text, percentage: 100 };
  if (value <= 2.5) return { level: 'good', color: config.good.color, bgClass: config.good.bg, textClass: config.good.text, percentage: 80 };
  if (value <= 3.0) return { level: 'adequate', color: config.adequate.color, bgClass: config.adequate.bg, textClass: config.adequate.text, percentage: 60 };
  if (value <= 4.0) return { level: 'weak', color: config.weak.color, bgClass: config.weak.bg, textClass: config.weak.text, percentage: 40 };
  return { level: 'poor', color: config.poor.color, bgClass: config.poor.bg, textClass: config.poor.text, percentage: 20 };
};

/**
 * Total Debt/Capital health assessment (lower is better)
 * Excellent (<30%), Good (30-50%), Adequate (50-60%), Weak (60-70%), Poor (>70%)
 */
export const getDebtCapitalHealth = (value: number): HealthConfig => {
  const config = HEALTH_COLORS;
  if (value < 0.3) return { level: 'excellent', color: config.excellent.color, bgClass: config.excellent.bg, textClass: config.excellent.text, percentage: 100 };
  if (value <= 0.5) return { level: 'good', color: config.good.color, bgClass: config.good.bg, textClass: config.good.text, percentage: 80 };
  if (value <= 0.6) return { level: 'adequate', color: config.adequate.color, bgClass: config.adequate.bg, textClass: config.adequate.text, percentage: 60 };
  if (value <= 0.7) return { level: 'weak', color: config.weak.color, bgClass: config.weak.bg, textClass: config.weak.text, percentage: 40 };
  return { level: 'poor', color: config.poor.color, bgClass: config.poor.bg, textClass: config.poor.text, percentage: 20 };
};

/**
 * Current Ratio health assessment (higher is better)
 * Excellent (>=2.0), Good (1.5-1.99), Adequate (1.2-1.49), Weak (1.0-1.19), Poor (<1.0)
 */
export const getCurrentRatioHealth = (value: number): HealthConfig => {
  const config = HEALTH_COLORS;
  if (value >= 2.0) return { level: 'excellent', color: config.excellent.color, bgClass: config.excellent.bg, textClass: config.excellent.text, percentage: 100 };
  if (value >= 1.5) return { level: 'good', color: config.good.color, bgClass: config.good.bg, textClass: config.good.text, percentage: 80 };
  if (value >= 1.2) return { level: 'adequate', color: config.adequate.color, bgClass: config.adequate.bg, textClass: config.adequate.text, percentage: 60 };
  if (value >= 1.0) return { level: 'weak', color: config.weak.color, bgClass: config.weak.bg, textClass: config.weak.text, percentage: 40 };
  return { level: 'poor', color: config.poor.color, bgClass: config.poor.bg, textClass: config.poor.text, percentage: 20 };
};

// ─────────────────────────────────────────────────────────────────────────────
// Data Transform Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform metrics_by_year to chart data points
 */
export const transformToTrendData = (
  metricsByYear: Record<string, YearMetrics>
): TrendDataPoint[] => {
  const years = Object.keys(metricsByYear).sort();

  return years.map(year => {
    const metrics = metricsByYear[year];
    return {
      year,
      fccr: metrics.fccr,
      seniorDebtEbitda: metrics.senior_debt_to_ebitda,
      debtCapital: metrics.total_debt_to_capital,
      currentRatio: metrics.current_ratio ?? null,
    };
  });
};

/**
 * Get the most recent year from metrics
 * Accepts any record keyed by year string
 */
export const getLatestYear = (metricsByYear: Record<string, unknown>): string => {
  const years = Object.keys(metricsByYear).sort();
  return years[years.length - 1] || '';
};

/**
 * Get risk band from normalized score (0-100)
 */
export const getRiskBandFromScore = (score: number): RiskBand => {
  if (score <= 20) return 'Low Risk';
  if (score <= 40) return 'Moderate Risk';
  if (score <= 60) return 'Elevated Risk';
  if (score <= 80) return 'High Risk';
  return 'Distressed';
};

/**
 * Derive lending decision from risk band
 */
export const getLendingDecisionFromRiskBand = (riskBand: RiskBand): LendingDecision => {
  switch (riskBand) {
    case 'Low Risk':
      return 'Approve';
    case 'Moderate Risk':
      return 'Approve with Conditions';
    case 'Elevated Risk':
      return 'Review Required';
    case 'High Risk':
    case 'Distressed':
      return 'Decline';
  }
};

/**
 * Calculate sparkline data from year values
 * Returns normalized 0-100 values for mini chart
 */
export const calculateSparklineData = (
  values: (number | null)[],
  higherIsBetter: boolean = true
): number[] => {
  const validValues = values.filter((v): v is number => v != null);
  if (validValues.length === 0) return [];

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || 1;

  return values.map(v => {
    if (v == null) return 0;
    const normalized = ((v - min) / range) * 100;
    return higherIsBetter ? normalized : 100 - normalized;
  });
};
