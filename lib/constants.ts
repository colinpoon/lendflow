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
  BATCH_DELAY_MS: 6000,
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
  FCCR: 0.5,
  DEBT_EBITDA: 0.35,
  DEBT_CAPITAL: 0.15,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Health Colors (Tailwind-compatible hex values)
// ─────────────────────────────────────────────────────────────────────────────

export const HEALTH_COLORS = {
  excellent: '#22c55e', // green-500
  good: '#84cc16',      // lime-500
  adequate: '#eab308',  // yellow-500
  weak: '#f97316',      // orange-500
  poor: '#ef4444',      // red-500
} as const;

/**
 * Tailwind CSS class mappings for health levels
 */
export const HEALTH_TAILWIND_CLASSES = {
  excellent: {
    text: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  good: {
    text: 'text-lime-600',
    bg: 'bg-lime-50',
    border: 'border-lime-200',
  },
  adequate: {
    text: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
  },
  weak: {
    text: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  poor: {
    text: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const PILLAR_KEYS = [
  'profitability_cashflow',
  'leverage',
  'liquidity',
  'debt_service',
  'interest_rate_sensitivity',
  'concentration_sector',
  'governance',
] as const;

export const PILLAR_LABELS: Record<string, string> = {
  profitability_cashflow: 'Profitability & Cash Flow',
  leverage: 'Leverage Position',
  liquidity: 'Liquidity',
  debt_service: 'Debt Service Capacity',
  interest_rate_sensitivity: 'Interest Rate Exposure',
  concentration_sector: 'Industry & Concentration',
  governance: 'Management & Governance',
};

export const PILLAR_WEIGHTS: Record<string, number> = {
  profitability_cashflow: 20,
  leverage: 20,
  liquidity: 20,
  debt_service: 15,
  interest_rate_sensitivity: 10,
  concentration_sector: 15,
  governance: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cache Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const CACHE_CONFIG = {
  DIR_NAME: 'lendflow-cache',
} as const;
