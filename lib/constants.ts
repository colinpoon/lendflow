/**
 * Application constants and configuration
 * Centralized constants for AI processing, health thresholds, and display
 */

// ─────────────────────────────────────────────────────────────────────────────
// AI Processing Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Anthropic Claude configuration for text extraction
export const AI_CONFIG = {
  MODEL: 'claude-sonnet-4-20250514',
  TEMPERATURE: 0,
  MAX_TOKENS: 8192, // Claude supports higher output limits for detailed extraction
  CHUNK_SIZE: 15000, // Larger chunks - Claude has 200k context window
  BATCH_SIZE: 3, // Claude handles concurrent requests well
  BATCH_DELAY_MS: 500, // Lower delay - Anthropic rate limits are generous
  MAX_RETRIES: 3,
  RATE_LIMIT_BACKOFF_MS: 10000, // Anthropic returns retry-after headers
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Chunking Configuration
// Claude Sonnet 4 has 200k context window. Use large chunks to minimize API calls.
// ─────────────────────────────────────────────────────────────────────────────

export const CHUNKING_CONFIG = {
  /** Target size for chunks in characters - use large chunks to minimize API calls */
  TARGET_SIZE: 25000,
  /** Minimum chunk size to prevent tiny chunks */
  MIN_SIZE: 2000,
  /** Maximum chunk size - well under Claude's 200k context limit */
  MAX_SIZE: 50000,
  /** Overlap percentage between chunks (0-100) - reduced to minimize redundancy */
  OVERLAP_PERCENT: 5,
  /** Paragraph boundary pattern */
  PARAGRAPH_BOUNDARY: /\n\n+/,
  /** Table row pattern (lines starting with | or containing tabs) */
  TABLE_ROW_PATTERN: /^[\s]*[|]|^\s*\S+\t/,
  /** Sentence ending pattern */
  SENTENCE_END: /[.!?]\s+/,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Merge Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const MERGE_CONFIG = {
  /** Source type confidence weights (higher = more authoritative) */
  SOURCE_WEIGHTS: {
    table: 0.92,      // Values from tables (highest reliability)
    primary: 0.75,    // Primary financial statement text
    overlap: 0.68,    // Values from chunk overlap regions
    inferred: 0.50,   // Calculated or inferred values
  },
  /** Variance threshold for flagging conflicts (percentage) - 5% matches audit materiality standards */
  CONFLICT_THRESHOLD_PERCENT: 5,
  /** Minimum number of values required for weighted average */
  MIN_VALUES_FOR_AVERAGE: 2,
  /** Consensus tolerance - values within this % are considered "agreeing" */
  CONSENSUS_TOLERANCE: 0.01,
  /** Minimum candidates required for consensus check */
  MIN_CANDIDATES_FOR_CONSENSUS: 3,
  /** Majority threshold for consensus (60% of candidates must agree) */
  CONSENSUS_MAJORITY_THRESHOLD: 0.6,
  /** Variance threshold for escalating to AI reconciliation (percentage) */
  AI_RECONCILIATION_THRESHOLD_PERCENT: 20,
  /** Variance threshold for source quality dominance check (percentage) */
  SOURCE_DOMINANCE_VARIANCE_THRESHOLD: 5,
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
  FCCR: 0.50,
  DEBT_EBITDA: 0.35,
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

// ─────────────────────────────────────────────────────────────────────────────
// Scale Validation Configuration
// Detects and corrects scale mismatches (raw dollars vs thousands vs millions)
// ─────────────────────────────────────────────────────────────────────────────

export const SCALE_VALIDATION = {
  /** Minimum plausible EBITDA margin before suspecting scale error (0.1% - handles thin-margin sectors like grocery/fuel) */
  MIN_EBITDA_MARGIN: 0.001,
  /** Minimum EBITDA margin after correction to accept the correction */
  MIN_CORRECTED_MARGIN: 0.005,
  /** Maximum EBITDA margin after correction to accept the correction (90% - allows SaaS/IP-heavy) */
  MAX_CORRECTED_MARGIN: 0.90,
  /** Scale factor for correction (raw dollars to thousands) */
  SCALE_FACTOR: 1000,
  /** Cross-year mismatch: minimum ratio to suspect scale error */
  CROSS_YEAR_MIN_RATIO: 200,
  /** Cross-year mismatch: maximum ratio (above this is likely data error, not scale) */
  CROSS_YEAR_MAX_RATIO: 2000,
  /** Outlier multiple: value is outlier if > this multiple of reference */
  OUTLIER_MULTIPLE: 50,
  /**
   * Maximum plausible revenue in thousands before suspecting raw dollars.
   * $500B = 500,000,000 in thousands. Only the largest global companies exceed this.
   * Set very high to avoid false positives - rely on ratio checks and AI scale detection instead.
   */
  MAX_PLAUSIBLE_REVENUE_K: 500_000_000,
  /**
   * Minimum plausible revenue in thousands after correction.
   * If correcting would make Revenue < this, don't correct.
   * $10K = 10 in thousands.
   */
  MIN_PLAUSIBLE_REVENUE_K: 10,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Currency Metrics
// Metrics that should be in thousands (used for scale normalization)
// ─────────────────────────────────────────────────────────────────────────────

export const CURRENCY_METRICS = [
  'revenue',
  'net_income',
  'expenses',
  'interest',
  'interest_income',
  'taxes',
  'depreciation_amortization',
  'depreciation_equipment',
  'depreciation_rou',
  'depreciation_other',
  'amortization_intangibles',
  'ebitda',
  'reported_adjusted_ebitda',
  'shareholders_equity',
  'capital_expenditures',
  'proceeds_from_long_term_debt',
  'cash_taxes_paid',
  'distributions_paid',
  'ttm_principal_payments',
  'ttm_interest_expense',
  'repayment_of_debt',
  'payment_of_lease_liability',
  'cash_interest_paid',
  'non_cash_interest_expense',
  'total_debt',
  'senior_debt',
  'current_assets',
  'current_liabilities',
] as const;

export type CurrencyMetric = (typeof CURRENCY_METRICS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Statement Map
// Defines which financial statement is authoritative for each metric.
// Used by the merger to prefer values from the canonical source during conflicts.
// ─────────────────────────────────────────────────────────────────────────────

import type { SourceStatementType } from '@/types/extraction';

export const CANONICAL_STATEMENT_MAP: Record<string, SourceStatementType> = {
  // Income Statement metrics
  revenue: 'income_statement',
  net_income: 'income_statement',
  expenses: 'income_statement',
  profit_margins: 'income_statement',
  interest: 'income_statement',
  interest_income: 'income_statement',
  taxes: 'income_statement',
  depreciation_amortization: 'income_statement',
  depreciation_equipment: 'income_statement',
  depreciation_rou: 'income_statement',
  depreciation_other: 'income_statement',
  amortization_intangibles: 'income_statement',
  ebitda: 'income_statement',

  // Cash Flow Statement metrics
  capital_expenditures: 'cash_flow_statement',
  proceeds_from_long_term_debt: 'cash_flow_statement',
  cash_taxes_paid: 'cash_flow_statement',
  distributions_paid: 'cash_flow_statement',
  repayment_of_debt: 'cash_flow_statement',
  payment_of_lease_liability: 'cash_flow_statement',
  cash_interest_paid: 'cash_flow_statement',
  non_cash_interest_expense: 'cash_flow_statement',
  ttm_principal_payments: 'cash_flow_statement',
  ttm_interest_expense: 'cash_flow_statement',
  reported_adjusted_ebitda: 'cash_flow_statement',

  // Balance Sheet metrics
  shareholders_equity: 'balance_sheet',
  total_debt: 'balance_sheet',
  senior_debt: 'balance_sheet',
  current_assets: 'balance_sheet',
  current_liabilities: 'balance_sheet',
  // debt_components.* — handled by prefix match in merger
  'debt_components.bank_debt_current': 'balance_sheet',
  'debt_components.bank_debt_long_term': 'balance_sheet',
  'debt_components.term_loans': 'balance_sheet',
  'debt_components.revolving_credit_facilities': 'balance_sheet',
  'debt_components.overdraft_facilities': 'balance_sheet',
  'debt_components.lease_liabilities_current': 'balance_sheet',
  'debt_components.lease_liabilities_long_term': 'balance_sheet',
  'debt_components.finance_lease_liabilities': 'balance_sheet',
  'debt_components.operating_lease_liabilities': 'balance_sheet',
  'debt_components.notes_payable': 'balance_sheet',
  'debt_components.subordinated_debt': 'balance_sheet',
  'debt_components.convertible_debt': 'balance_sheet',
  'debt_components.bonds_debentures': 'balance_sheet',
  'debt_components.lines_of_credit': 'balance_sheet',
  'debt_components.other_borrowings': 'balance_sheet',
  // fixed_charges.* — interest from income statement, payments from cash flow
  'fixed_charges.senior_debt_interest': 'income_statement',
  'fixed_charges.subordinated_debt_interest': 'income_statement',
  'fixed_charges.lease_interest': 'income_statement',
  'fixed_charges.total_interest_expense': 'income_statement',
  'fixed_charges.minimum_lease_payments': 'cash_flow_statement',
  'fixed_charges.finance_lease_payments': 'cash_flow_statement',
  'fixed_charges.operating_lease_payments': 'cash_flow_statement',
  'fixed_charges.principal_payments': 'cash_flow_statement',
  'fixed_charges.preferred_dividends': 'income_statement',
  'fixed_charges.other_fixed_charges': 'income_statement',
};
