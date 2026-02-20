/**
 * Accuracy Calculation Utilities for Extraction Debugging
 *
 * Compares extracted values against ground truth to determine
 * accuracy of the text extraction pipeline.
 *
 * Methodology:
 * - Variance = abs((extracted - truth) / truth) * 100
 * - Green: <5% variance
 * - Amber: 5-20% variance
 * - Red: >20% variance
 * - Missing: extracted value is null
 */

import type { GroundTruthValues } from './ground-truth';
import type { ComputedMetrics } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AccuracyStatus = 'green' | 'amber' | 'red' | 'missing';

export type MetricCategory =
  | 'Income Statement'
  | 'Balance Sheet'
  | 'Cash Flow'
  | 'Debt Components'
  | 'Fixed Charges'
  | 'EBITDA Adjustments'
  | 'Computed Ratios';

export interface AccuracyResult {
  metric: string;
  label: string;
  category: MetricCategory;
  truth: number;
  extracted: number | null;
  variance_pct: number | null;
  status: AccuracyStatus;
}

export interface AccuracySummary {
  results: AccuracyResult[];
  accuracy_pct: number;
  metrics_compared: number;
  green_count: number;
  amber_count: number;
  red_count: number;
  missing_count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Definitions — key doubles as the dot-notation path into ComputedMetrics
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricDef {
  label: string;
  category: MetricCategory;
}

const METRIC_DEFINITIONS: Record<string, MetricDef> = {
  // Income Statement
  revenue: { label: 'Revenue', category: 'Income Statement' },
  net_income: { label: 'Net Income', category: 'Income Statement' },
  expenses: { label: 'Expenses', category: 'Income Statement' },
  profit_margins: { label: 'Profit Margins', category: 'Income Statement' },
  interest: { label: 'Interest', category: 'Income Statement' },
  taxes: { label: 'Taxes', category: 'Income Statement' },
  depreciation_amortization: { label: 'Depreciation & Amortization', category: 'Income Statement' },
  depreciation_equipment: { label: 'Depreciation (Equipment)', category: 'Income Statement' },
  depreciation_rou: { label: 'Depreciation (ROU)', category: 'Income Statement' },
  depreciation_other: { label: 'Depreciation (Other)', category: 'Income Statement' },
  amortization_intangibles: { label: 'Amortization (Intangibles)', category: 'Income Statement' },
  ebitda: { label: 'EBITDA', category: 'Income Statement' },
  reported_adjusted_ebitda: { label: 'Reported Adjusted EBITDA', category: 'Income Statement' },

  // Balance Sheet
  shareholders_equity: { label: "Shareholders' Equity", category: 'Balance Sheet' },
  total_debt: { label: 'Total Debt', category: 'Balance Sheet' },
  senior_debt: { label: 'Senior Debt', category: 'Balance Sheet' },
  current_assets: { label: 'Current Assets', category: 'Balance Sheet' },
  current_liabilities: { label: 'Current Liabilities', category: 'Balance Sheet' },

  // Cash Flow
  capital_expenditures: { label: 'Capital Expenditures', category: 'Cash Flow' },
  proceeds_from_long_term_debt: { label: 'Proceeds from LT Debt', category: 'Cash Flow' },
  cash_taxes_paid: { label: 'Cash Taxes Paid', category: 'Cash Flow' },
  distributions_paid: { label: 'Distributions Paid', category: 'Cash Flow' },
  ttm_principal_payments: { label: 'TTM Principal Payments', category: 'Cash Flow' },
  ttm_interest_expense: { label: 'TTM Interest Expense', category: 'Cash Flow' },
  repayment_of_debt: { label: 'Repayment of Debt', category: 'Cash Flow' },
  payment_of_lease_liability: { label: 'Payment of Lease Liability', category: 'Cash Flow' },
  cash_interest_paid: { label: 'Cash Interest Paid', category: 'Cash Flow' },
  non_cash_interest_expense: { label: 'Non-Cash Interest Expense', category: 'Cash Flow' },

  // Debt Components
  'debt_components.bank_debt_current': { label: 'Bank Debt (Current)', category: 'Debt Components' },
  'debt_components.bank_debt_long_term': { label: 'Bank Debt (Long-Term)', category: 'Debt Components' },
  'debt_components.term_loans': { label: 'Term Loans', category: 'Debt Components' },
  'debt_components.revolving_credit_facilities': { label: 'Revolving Credit', category: 'Debt Components' },
  'debt_components.overdraft_facilities': { label: 'Overdraft Facilities', category: 'Debt Components' },
  'debt_components.lines_of_credit': { label: 'Lines of Credit', category: 'Debt Components' },
  'debt_components.lease_liabilities_current': { label: 'Lease Liabilities (Current)', category: 'Debt Components' },
  'debt_components.lease_liabilities_long_term': { label: 'Lease Liabilities (Long-Term)', category: 'Debt Components' },
  'debt_components.finance_lease_liabilities': { label: 'Finance Lease Liabilities', category: 'Debt Components' },
  'debt_components.operating_lease_liabilities': { label: 'Operating Lease Liabilities', category: 'Debt Components' },
  'debt_components.notes_payable': { label: 'Notes Payable', category: 'Debt Components' },
  'debt_components.subordinated_debt': { label: 'Subordinated Debt', category: 'Debt Components' },
  'debt_components.convertible_debt': { label: 'Convertible Debt', category: 'Debt Components' },
  'debt_components.bonds_debentures': { label: 'Bonds/Debentures', category: 'Debt Components' },
  'debt_components.other_borrowings': { label: 'Other Borrowings', category: 'Debt Components' },

  // Fixed Charges
  'fixed_charges.senior_debt_interest': { label: 'Senior Debt Interest', category: 'Fixed Charges' },
  'fixed_charges.subordinated_debt_interest': { label: 'Sub Debt Interest', category: 'Fixed Charges' },
  'fixed_charges.lease_interest': { label: 'Lease Interest', category: 'Fixed Charges' },
  'fixed_charges.total_interest_expense': { label: 'Total Interest Expense', category: 'Fixed Charges' },
  'fixed_charges.minimum_lease_payments': { label: 'Min Lease Payments', category: 'Fixed Charges' },
  'fixed_charges.finance_lease_payments': { label: 'Finance Lease Payments', category: 'Fixed Charges' },
  'fixed_charges.operating_lease_payments': { label: 'Operating Lease Payments', category: 'Fixed Charges' },
  'fixed_charges.principal_payments': { label: 'Principal Payments', category: 'Fixed Charges' },
  'fixed_charges.preferred_dividends': { label: 'Preferred Dividends', category: 'Fixed Charges' },
  'fixed_charges.other_fixed_charges': { label: 'Other Fixed Charges', category: 'Fixed Charges' },

  // EBITDA Adjustments
  'adjusted_ebitda_components.stock_based_compensation': { label: 'Stock-Based Compensation', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.impairment_charges': { label: 'Impairment Charges', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.goodwill_impairment': { label: 'Goodwill Impairment', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.unrealized_gains_losses': { label: 'Unrealized Gains/Losses', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.deferred_compensation': { label: 'Deferred Compensation', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.loss_on_disposal': { label: 'Loss on Disposal', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.other_non_cash': { label: 'Other Non-Cash', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.restructuring_costs': { label: 'Restructuring Costs', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.severance_costs': { label: 'Severance Costs', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.transaction_costs': { label: 'Transaction Costs', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.legal_settlements': { label: 'Legal Settlements', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.professional_fees_one_time': { label: 'Professional Fees (One-Time)', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.casualty_losses': { label: 'Casualty Losses', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.other_one_time_expenses': { label: 'Other One-Time Expenses', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.gain_on_disposal': { label: 'Gain on Disposal', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.gain_on_asset_sale': { label: 'Gain on Asset Sale', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.other_income_non_operating': { label: 'Other Non-Operating Income', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.insurance_proceeds': { label: 'Insurance Proceeds', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.other_one_time_gains': { label: 'Other One-Time Gains', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.owner_compensation_adjustment': { label: 'Owner Compensation Adj.', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.related_party_adjustments': { label: 'Related Party Adj.', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.management_fees_adjustment': { label: 'Management Fees Adj.', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.accounting_policy_adjustments': { label: 'Accounting Policy Adj.', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.foreign_exchange_adjustments': { label: 'FX Adjustments', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.pro_forma_cost_savings': { label: 'Pro Forma Cost Savings', category: 'EBITDA Adjustments' },
  'adjusted_ebitda_components.pro_forma_synergies': { label: 'Pro Forma Synergies', category: 'EBITDA Adjustments' },

  // Computed Ratios
  // NOTE: Ratio fields (fccr, dscr, etc.) use the same percentage-variance formula as dollar values.
  // A truth of 1.20 vs extracted 1.30 = 8.3% variance (amber), even though the absolute difference
  // is only 0.10x. This is intentional — small ratio differences can be material for lending decisions.
  // For dollar-denominated fields like adjusted_ebitda/funded_debt, the thresholds are more intuitive.
  adjusted_ebitda: { label: 'Adjusted EBITDA', category: 'Computed Ratios' },
  calculated_adjusted_ebitda: { label: 'Calculated Adjusted EBITDA', category: 'Computed Ratios' },
  fccr: { label: 'FCCR', category: 'Computed Ratios' },
  dscr: { label: 'DSCR', category: 'Computed Ratios' },
  funded_debt: { label: 'Funded Debt', category: 'Computed Ratios' },
  funded_debt_to_ebitda: { label: 'Funded Debt / EBITDA', category: 'Computed Ratios' },
  senior_debt_to_ebitda: { label: 'Senior Debt / EBITDA', category: 'Computed Ratios' },
  total_debt_to_capital: { label: 'Total Debt / Total Capital', category: 'Computed Ratios' },
  interest_coverage_ratio: { label: 'Interest Coverage Ratio', category: 'Computed Ratios' },
  debt_to_equity_ratio: { label: 'Debt / Equity', category: 'Computed Ratios' },
  current_ratio: { label: 'Current Ratio', category: 'Computed Ratios' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-built indices (computed once at module load)
// ─────────────────────────────────────────────────────────────────────────────

const METRICS_BY_CATEGORY: Record<MetricCategory, { key: string; def: MetricDef }[]> =
  {} as Record<MetricCategory, { key: string; def: MetricDef }[]>;

for (const [key, def] of Object.entries(METRIC_DEFINITIONS)) {
  if (!METRICS_BY_CATEGORY[def.category]) {
    METRICS_BY_CATEGORY[def.category] = [];
  }
  METRICS_BY_CATEGORY[def.category].push({ key, def });
}

/** Ordered list of metric categories — stable module-level constant */
export const METRIC_CATEGORIES: MetricCategory[] = [
  'Computed Ratios',
  'Income Statement',
  'Balance Sheet',
  'Cash Flow',
  'Debt Components',
  'Fixed Charges',
  'EBITDA Adjustments',
];

const ALL_METRIC_KEYS = Object.keys(METRIC_DEFINITIONS);

// ─────────────────────────────────────────────────────────────────────────────
// Thresholds
// ─────────────────────────────────────────────────────────────────────────────

const GREEN_THRESHOLD = 5;   // <5% variance
const AMBER_THRESHOLD = 20;  // 5-20% variance

// ─────────────────────────────────────────────────────────────────────────────
// Core Functions
// ─────────────────────────────────────────────────────────────────────────────

export function calculateVariance(
  extracted: number | null | undefined,
  truth: number
): number | null {
  if (extracted === null || extracted === undefined) {
    return null;
  }

  if (truth === 0) {
    if (extracted === 0) return 0;
    return 100;
  }

  return Math.abs((extracted - truth) / truth) * 100;
}

export function getStatus(variance: number | null): AccuracyStatus {
  if (variance === null) return 'missing';
  if (variance < GREEN_THRESHOLD) return 'green';
  if (variance < AMBER_THRESHOLD) return 'amber';
  return 'red';
}

/**
 * Resolve a dot-notation path on a ComputedMetrics object.
 * e.g., 'debt_components.bank_debt_current' -> metrics.debt_components?.bank_debt_current
 */
function resolveMetricPath(
  metrics: ComputedMetrics,
  path: string
): number | null {
  const parts = path.split('.');
  let current: unknown = metrics;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === 'number' ? current : null;
}

/**
 * Get all metric definitions for a given category (O(1) lookup)
 */
export function getMetricsByCategory(category: MetricCategory): { key: string; def: MetricDef }[] {
  return METRICS_BY_CATEGORY[category] ?? [];
}

/**
 * Get a metric definition by key
 */
export function getMetricDef(key: string): MetricDef | undefined {
  return METRIC_DEFINITIONS[key];
}

/**
 * Calculate extraction accuracy by comparing ground truth against extracted metrics.
 */
export function calculateExtractionAccuracy(
  truth: GroundTruthValues,
  metrics: ComputedMetrics | null,
): AccuracySummary {
  const results: AccuracyResult[] = [];

  for (const [truthKey, truthValue] of Object.entries(truth)) {
    if (truthValue === undefined || truthValue === null) continue;

    const def = METRIC_DEFINITIONS[truthKey];
    if (!def) continue;

    const extracted = metrics ? resolveMetricPath(metrics, truthKey) : null;
    const variance = calculateVariance(extracted, truthValue);
    const status = getStatus(variance);

    results.push({
      metric: truthKey,
      label: def.label,
      category: def.category,
      truth: truthValue,
      extracted,
      variance_pct: variance,
      status,
    });
  }

  const metricsCompared = results.length;
  const greenCount = results.filter((r) => r.status === 'green').length;
  const amberCount = results.filter((r) => r.status === 'amber').length;
  const redCount = results.filter((r) => r.status === 'red').length;
  const missingCount = results.filter((r) => r.status === 'missing').length;

  const accuratePct =
    metricsCompared > 0 ? (greenCount / metricsCompared) * 100 : 0;

  return {
    results,
    accuracy_pct: accuratePct,
    metrics_compared: metricsCompared,
    green_count: greenCount,
    amber_count: amberCount,
    red_count: redCount,
    missing_count: missingCount,
  };
}

/**
 * Get all defined metric keys (stable module-level array)
 */
export function getAllMetricKeys(): string[] {
  return ALL_METRIC_KEYS;
}

/**
 * Get the label for a metric key
 */
export function getMetricLabel(key: string): string {
  return METRIC_DEFINITIONS[key]?.label ?? key;
}

/**
 * Resolve a metric value from ComputedMetrics by ground truth key
 */
export function resolveMetricValue(
  metrics: ComputedMetrics,
  key: string,
): number | null {
  const def = METRIC_DEFINITIONS[key];
  if (!def) return null;
  return resolveMetricPath(metrics, key);
}
