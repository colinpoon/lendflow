/**
 * Risk scoring utilities
 * Centralized health assessment and risk scoring functions
 */

import type { HealthLevel, HealthConfig, RiskConfig } from '@/types';
import {
  FCCR_THRESHOLDS,
  DEBT_EBITDA_THRESHOLDS,
  DEBT_CAPITAL_THRESHOLDS,
  HEALTH_COLORS,
  RISK_WEIGHTS,
} from './constants';

// ─────────────────────────────────────────────────────────────────────────────
// FCCR Health Assessment (higher is better)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get health configuration for FCCR value
 * @param value - FCCR ratio (higher is better)
 */
export function getFCCRHealth(value: number): HealthConfig {
  if (value >= FCCR_THRESHOLDS.EXCELLENT) {
    return { level: 'excellent', color: HEALTH_COLORS.excellent, percentage: 100 };
  }
  if (value >= FCCR_THRESHOLDS.GOOD) {
    return { level: 'good', color: HEALTH_COLORS.good, percentage: 80 };
  }
  if (value >= FCCR_THRESHOLDS.ADEQUATE) {
    return { level: 'adequate', color: HEALTH_COLORS.adequate, percentage: 60 };
  }
  if (value >= FCCR_THRESHOLDS.WEAK) {
    return { level: 'weak', color: HEALTH_COLORS.weak, percentage: 40 };
  }
  return { level: 'poor', color: HEALTH_COLORS.poor, percentage: 20 };
}

/**
 * Get risk score for FCCR (0-10 scale, higher = worse)
 */
export function getFCCRRiskScore(value: number | null): number {
  if (value == null) return 5;
  if (value >= FCCR_THRESHOLDS.EXCELLENT) return 1;
  if (value >= FCCR_THRESHOLDS.GOOD) return 3;
  if (value >= FCCR_THRESHOLDS.ADEQUATE) return 5;
  if (value >= FCCR_THRESHOLDS.WEAK) return 7;
  if (value >= 0) return 9;
  return 10; // Negative FCCR
}

// ─────────────────────────────────────────────────────────────────────────────
// Senior Debt/EBITDA Health Assessment (lower is better)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get health configuration for Senior Debt/EBITDA ratio
 * @param value - Debt to EBITDA ratio (lower is better)
 */
export function getSeniorDebtEBITDAHealth(value: number): HealthConfig {
  if (value <= DEBT_EBITDA_THRESHOLDS.EXCELLENT) {
    return { level: 'excellent', color: HEALTH_COLORS.excellent, percentage: 100 };
  }
  if (value <= DEBT_EBITDA_THRESHOLDS.GOOD) {
    return { level: 'good', color: HEALTH_COLORS.good, percentage: 80 };
  }
  if (value <= DEBT_EBITDA_THRESHOLDS.ADEQUATE) {
    return { level: 'adequate', color: HEALTH_COLORS.adequate, percentage: 60 };
  }
  if (value <= DEBT_EBITDA_THRESHOLDS.WEAK) {
    return { level: 'weak', color: HEALTH_COLORS.weak, percentage: 40 };
  }
  return { level: 'poor', color: HEALTH_COLORS.poor, percentage: 20 };
}

/**
 * Get risk score for Debt/EBITDA (0-10 scale, higher = worse)
 */
export function getDebtEBITDARiskScore(value: number | null): number {
  if (value == null) return 5;
  if (value <= DEBT_EBITDA_THRESHOLDS.EXCELLENT) return 1;
  if (value <= DEBT_EBITDA_THRESHOLDS.GOOD) return 3;
  if (value <= DEBT_EBITDA_THRESHOLDS.ADEQUATE) return 5;
  if (value <= DEBT_EBITDA_THRESHOLDS.WEAK) return 7;
  return 9;
}

// ─────────────────────────────────────────────────────────────────────────────
// Total Debt/Capital Health Assessment (lower is better)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get health configuration for Total Debt/Capital ratio
 * @param value - Debt to capital ratio (lower is better)
 */
export function getTotalDebtCapitalHealth(value: number): HealthConfig {
  if (value < DEBT_CAPITAL_THRESHOLDS.EXCELLENT) {
    return { level: 'excellent', color: HEALTH_COLORS.excellent, percentage: 100 };
  }
  if (value <= DEBT_CAPITAL_THRESHOLDS.GOOD) {
    return { level: 'good', color: HEALTH_COLORS.good, percentage: 80 };
  }
  if (value <= DEBT_CAPITAL_THRESHOLDS.ADEQUATE) {
    return { level: 'adequate', color: HEALTH_COLORS.adequate, percentage: 60 };
  }
  if (value <= DEBT_CAPITAL_THRESHOLDS.WEAK) {
    return { level: 'weak', color: HEALTH_COLORS.weak, percentage: 40 };
  }
  return { level: 'poor', color: HEALTH_COLORS.poor, percentage: 20 };
}

/**
 * Get risk score for Debt/Capital (0-10 scale, higher = worse)
 */
export function getDebtCapitalRiskScore(value: number | null): number {
  if (value == null) return 5;
  if (value < DEBT_CAPITAL_THRESHOLDS.EXCELLENT) return 1;
  if (value <= DEBT_CAPITAL_THRESHOLDS.GOOD) return 3;
  if (value <= DEBT_CAPITAL_THRESHOLDS.ADEQUATE) return 5;
  if (value <= DEBT_CAPITAL_THRESHOLDS.WEAK) return 7;
  return 9;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weighted Risk Score Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate weighted risk score from individual metrics
 * @returns Score 0-10 (higher = worse risk)
 */
export function calculateWeightedRiskScore(
  fccr: number | null,
  debtEbitda: number | null,
  debtCapital: number | null
): number {
  const fccrScore = getFCCRRiskScore(fccr);
  const debtEbitdaScore = getDebtEBITDARiskScore(debtEbitda);
  const debtCapitalScore = getDebtCapitalRiskScore(debtCapital);

  return (
    fccrScore * RISK_WEIGHTS.FCCR +
    debtEbitdaScore * RISK_WEIGHTS.DEBT_EBITDA +
    debtCapitalScore * RISK_WEIGHTS.DEBT_CAPITAL
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get risk configuration from weighted score
 */
export function getRiskConfig(score: number): RiskConfig {
  if (score <= 2) {
    return {
      level: 'very-low',
      label: 'Very Low Risk',
      color: HEALTH_COLORS.excellent,
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    };
  }
  if (score <= 4) {
    return {
      level: 'low',
      label: 'Low Risk',
      color: HEALTH_COLORS.good,
      bgColor: 'bg-lime-50',
      textColor: 'text-lime-700',
    };
  }
  if (score <= 6) {
    return {
      level: 'moderate',
      label: 'Moderate Risk',
      color: HEALTH_COLORS.adequate,
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
    };
  }
  if (score <= 8) {
    return {
      level: 'elevated',
      label: 'Elevated Risk',
      color: HEALTH_COLORS.weak,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
    };
  }
  return {
    level: 'high',
    label: 'High Risk',
    color: HEALTH_COLORS.poor,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lending Decision
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get lending decision from weighted risk score
 */
export function getLendingDecision(score: number): string {
  if (score <= 2) return 'Strong Approve';
  if (score <= 4) return 'Approve';
  if (score <= 6) return 'Conditional Approval';
  if (score <= 8) return 'Further Review Required';
  return 'Decline';
}

/**
 * Get risk band label from weighted score
 */
export function getRiskBand(score: number): string {
  if (score <= 2) return 'Very Low Risk';
  if (score <= 4) return 'Low Risk';
  if (score <= 6) return 'Moderate Risk';
  if (score <= 8) return 'Elevated Risk';
  return 'High Risk';
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get health rating label
 */
export function getRatingLabel(level: HealthLevel): string {
  const labels: Record<HealthLevel, string> = {
    excellent: 'Excellent',
    good: 'Good',
    adequate: 'Adequate',
    weak: 'Weak',
    poor: 'Poor',
  };
  return labels[level];
}

/**
 * Get Tailwind CSS color class for ratio display
 */
export function getRatioColorClass(
  key: 'fccr' | 'senior_debt_to_ebitda' | 'total_debt_to_capital',
  value: number | null
): string {
  if (value == null) return '';

  let health: HealthConfig;
  switch (key) {
    case 'fccr':
      health = getFCCRHealth(value);
      break;
    case 'senior_debt_to_ebitda':
      health = getSeniorDebtEBITDAHealth(value);
      break;
    case 'total_debt_to_capital':
      health = getTotalDebtCapitalHealth(value);
      break;
    default:
      return '';
  }

  const colorMap: Record<HealthLevel, string> = {
    excellent: 'text-green-600 font-semibold',
    good: 'text-lime-600 font-semibold',
    adequate: 'text-yellow-600 font-semibold',
    weak: 'text-orange-600 font-semibold',
    poor: 'text-red-600 font-semibold',
  };

  return colorMap[health.level];
}
