/**
 * Application constants and configuration
 * Centralized constants for AI processing, health thresholds, and display
 */

// ─────────────────────────────────────────────────────────────────────────────
// AI Processing Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const AI_CONFIG = {
  MODEL: 'gpt-4-turbo-2024-04-09',
  TEMPERATURE: 0,
  MAX_TOKENS: 2000,
  CHUNK_SIZE: 8000,
  BATCH_SIZE: 2,
  BATCH_DELAY_MS: 3000,
  MAX_RETRIES: 3,
  RATE_LIMIT_BACKOFF_MS: 15000,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Health Threshold Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FCCR (Fixed Charge Coverage Ratio) thresholds
 * Higher is better - measures ability to cover fixed charges
 */
export const FCCR_THRESHOLDS = {
  EXCELLENT: 2.0,
  GOOD: 1.5,
  ADEQUATE: 1.2,
  WEAK: 1.0,
} as const;

/**
 * Senior Debt to EBITDA thresholds
 * Lower is better - measures leverage
 */
export const DEBT_EBITDA_THRESHOLDS = {
  EXCELLENT: 1.5,
  GOOD: 2.5,
  ADEQUATE: 3.0,
  WEAK: 4.0,
} as const;

/**
 * Total Debt to Capital thresholds
 * Lower is better - measures capital structure
 */
export const DEBT_CAPITAL_THRESHOLDS = {
  EXCELLENT: 0.3,
  GOOD: 0.5,
  ADEQUATE: 0.6,
  WEAK: 0.7,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Risk Scoring Weights
// ─────────────────────────────────────────────────────────────────────────────

export const RISK_WEIGHTS = {
  FCCR: 0.45,
  DEBT_EBITDA: 0.40,
  DEBT_CAPITAL: 0.15,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Health Colors (Tailwind-compatible hex values)
// See lib/design-tokens.ts for the complete design system
// ─────────────────────────────────────────────────────────────────────────────

export const HEALTH_COLORS = {
  excellent: '#059669', // emerald-600 - outstanding performance
  good: '#16a34a',      // green-600 - solid performance
  adequate: '#d97706',  // amber-600 - acceptable, room for improvement
  weak: '#ea580c',      // orange-600 - concerning
  poor: '#dc2626',      // red-600 - critical attention needed
} as const;

/**
 * Tailwind CSS class mappings for health levels
 * Improved contrast ratios for WCAG AA compliance
 */
export const HEALTH_TAILWIND_CLASSES = {
  excellent: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    bgSolid: 'bg-emerald-600',
  },
  good: {
    text: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-300',
    bgSolid: 'bg-green-600',
  },
  adequate: {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    bgSolid: 'bg-amber-600',
  },
  weak: {
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    bgSolid: 'bg-orange-600',
  },
  poor: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-300',
    bgSolid: 'bg-red-600',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const PILLAR_KEYS = [
  'debt_service_capacity',
  'leverage',
  'profitability',
  'cash_flow',
  'financial_trajectory',
] as const;

export const PILLAR_LABELS: Record<string, string> = {
  debt_service_capacity: 'Debt Service Capacity',
  leverage: 'Leverage & Capital Structure',
  profitability: 'Profitability',
  cash_flow: 'Cash Flow Adequacy',
  financial_trajectory: 'Financial Trajectory',
};

export const PILLAR_WEIGHTS: Record<string, number> = {
  debt_service_capacity: 30,
  leverage: 25,
  profitability: 20,
  cash_flow: 15,
  financial_trajectory: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const CACHE_CONFIG = {
  DIR_NAME: 'lendflow-cache',
} as const;
