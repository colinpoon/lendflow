/**
 * Validation utilities for AI extraction responses
 * Uses Zod for schema validation with business logic checks
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Validation Result Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: 'schema' | 'business_logic' | 'type_coercion';
  value?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Numeric Value Schema (accepts numbers or numeric strings)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerces string values to numbers where possible
 * Handles common AI output formats: "1,234.56", "$1,234", "(1,234)" for negative
 */
const numericValue = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove currency symbols, commas, spaces
    let cleaned = val.replace(/[$€£¥,\s]/g, '');
    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }
    // Handle percentage suffixes
    cleaned = cleaned.replace(/%$/, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && isFinite(num)) return num;
    // Value is not numeric - this will be caught by the schema
    return val;
  }
  return val;
}, z.number().nullable());

// ─────────────────────────────────────────────────────────────────────────────
// Nested Component Schemas
// ─────────────────────────────────────────────────────────────────────────────

const debtComponentsSchema = z.object({
  bank_debt_current: numericValue.optional(),
  bank_debt_long_term: numericValue.optional(),
  term_loans: numericValue.optional(),
  revolving_credit_facilities: numericValue.optional(),
  overdraft_facilities: numericValue.optional(),
  lines_of_credit: numericValue.optional(),
  lease_liabilities_current: numericValue.optional(),
  lease_liabilities_long_term: numericValue.optional(),
  finance_lease_liabilities: numericValue.optional(),
  operating_lease_liabilities: numericValue.optional(),
  notes_payable: numericValue.optional(),
  subordinated_debt: numericValue.optional(),
  convertible_debt: numericValue.optional(),
  bonds_debentures: numericValue.optional(),
  other_borrowings: numericValue.optional(),
}).passthrough();

const fixedChargesSchema = z.object({
  senior_debt_interest: numericValue.optional(),
  subordinated_debt_interest: numericValue.optional(),
  lease_interest: numericValue.optional(),
  total_interest_expense: numericValue.optional(),
  senior_debt_interest_rate: z.string().nullable().optional(),
  minimum_lease_payments: numericValue.optional(),
  finance_lease_payments: numericValue.optional(),
  operating_lease_payments: numericValue.optional(),
  principal_payments: numericValue.optional(),
  preferred_dividends: numericValue.optional(),
  other_fixed_charges: numericValue.optional(),
}).passthrough();

const adjustedEbitdaComponentsSchema = z.object({
  stock_based_compensation: numericValue.optional(),
  impairment_charges: numericValue.optional(),
  goodwill_impairment: numericValue.optional(),
  unrealized_gains_losses: numericValue.optional(),
  deferred_compensation: numericValue.optional(),
  loss_on_disposal: numericValue.optional(),
  other_non_cash: numericValue.optional(),
  restructuring_costs: numericValue.optional(),
  severance_costs: numericValue.optional(),
  transaction_costs: numericValue.optional(),
  legal_settlements: numericValue.optional(),
  professional_fees_one_time: numericValue.optional(),
  casualty_losses: numericValue.optional(),
  other_one_time_expenses: numericValue.optional(),
  gain_on_disposal: numericValue.optional(),
  gain_on_asset_sale: numericValue.optional(),
  other_income_non_operating: numericValue.optional(),
  insurance_proceeds: numericValue.optional(),
  other_one_time_gains: numericValue.optional(),
  owner_compensation_adjustment: numericValue.optional(),
  related_party_adjustments: numericValue.optional(),
  management_fees_adjustment: numericValue.optional(),
  accounting_policy_adjustments: numericValue.optional(),
  foreign_exchange_adjustments: numericValue.optional(),
  unrealized_fx_cash_flow: numericValue.optional(),
  realized_fx_pl: numericValue.optional(),
  pro_forma_cost_savings: numericValue.optional(),
  pro_forma_synergies: numericValue.optional(),
}).passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// Year Metrics Schema
// ─────────────────────────────────────────────────────────────────────────────

const yearMetricsSchema = z.object({
  // Income Statement
  revenue: numericValue.optional(),
  net_income: numericValue.optional(),
  expenses: numericValue.optional(),
  profit_margins: numericValue.optional(),
  interest: numericValue.optional(),
  taxes: numericValue.optional(),
  depreciation_amortization: numericValue.optional(),
  depreciation_equipment: numericValue.optional(),
  depreciation_rou: numericValue.optional(),
  depreciation_other: numericValue.optional(),
  amortization_intangibles: numericValue.optional(),

  // EBITDA
  ebitda: numericValue.optional(),
  reported_adjusted_ebitda: numericValue.optional(),

  // Balance Sheet
  shareholders_equity: numericValue.optional(),
  total_debt: numericValue.optional(),
  senior_debt: numericValue.optional(),
  current_assets: numericValue.optional(),
  current_liabilities: numericValue.optional(),

  // Cash Flow
  capital_expenditures: numericValue.optional(),
  proceeds_from_long_term_debt: numericValue.optional(),
  cash_taxes_paid: numericValue.optional(),
  distributions_paid: numericValue.optional(),
  ttm_principal_payments: numericValue.optional(),
  ttm_interest_expense: numericValue.optional(),
  repayment_of_debt: numericValue.optional(),
  payment_of_lease_liability: numericValue.optional(),
  cash_interest_paid: numericValue.optional(),
  non_cash_interest_expense: numericValue.optional(),

  // Nested components (can be null or undefined)
  debt_components: debtComponentsSchema.optional().nullable(),
  fixed_charges: fixedChargesSchema.optional().nullable(),
  adjusted_ebitda_components: adjustedEbitdaComponentsSchema.optional().nullable(),
}).passthrough();

// ─────────────────────────────────────────────────────────────────────────────
// AI Extraction Response Schema
// ─────────────────────────────────────────────────────────────────────────────

export const aiExtractionResponseSchema = z.object({
  metrics_by_year: z.record(z.string(), yearMetricsSchema).optional(),
  /**
   * The most recent fiscal year that this document is primarily reporting on.
   * Document-level field (not per-year). Populated by the AI from the document
   * title or the latest year with full financial statements.
   */
  primary_fiscal_year: z.string().nullable().optional(),
}).passthrough();

export type ValidatedAIResponse = z.infer<typeof aiExtractionResponseSchema>;
export type ValidatedYearMetrics = z.infer<typeof yearMetricsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Business Logic Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business logic checks that go beyond schema validation
 * Returns array of validation errors (empty if valid)
 */
export function validateBusinessLogic(
  data: ValidatedAIResponse
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.metrics_by_year) {
    return errors;
  }

  for (const [year, metrics] of Object.entries(data.metrics_by_year)) {
    // EBITDA should generally be less than revenue (unless negative revenue)
    if (
      metrics.ebitda != null &&
      metrics.revenue != null &&
      metrics.revenue > 0 &&
      metrics.ebitda > metrics.revenue * 1.5
    ) {
      errors.push({
        path: `metrics_by_year.${year}.ebitda`,
        message: `EBITDA (${metrics.ebitda}) exceeds 150% of revenue (${metrics.revenue}). This may indicate a scale mismatch.`,
        code: 'business_logic',
        value: metrics.ebitda,
      });
    }

    // Net income should generally be less than revenue
    if (
      metrics.net_income != null &&
      metrics.revenue != null &&
      metrics.revenue > 0 &&
      Math.abs(metrics.net_income) > metrics.revenue * 1.2
    ) {
      errors.push({
        path: `metrics_by_year.${year}.net_income`,
        message: `Net income magnitude (${metrics.net_income}) exceeds 120% of revenue (${metrics.revenue}). Verify accuracy.`,
        code: 'business_logic',
        value: metrics.net_income,
      });
    }

    // Expenses should generally be positive
    if (metrics.expenses != null && metrics.expenses < 0) {
      errors.push({
        path: `metrics_by_year.${year}.expenses`,
        message: `Expenses (${metrics.expenses}) is negative. This is unusual.`,
        code: 'business_logic',
        value: metrics.expenses,
      });
    }

    // Interest should be positive (it's an expense)
    if (metrics.interest != null && metrics.interest < 0) {
      errors.push({
        path: `metrics_by_year.${year}.interest`,
        message: `Interest expense (${metrics.interest}) is negative. Interest expense should be positive.`,
        code: 'business_logic',
        value: metrics.interest,
      });
    }

    // Total debt should be >= senior debt
    if (
      metrics.total_debt != null &&
      metrics.senior_debt != null &&
      metrics.senior_debt > metrics.total_debt
    ) {
      errors.push({
        path: `metrics_by_year.${year}.senior_debt`,
        message: `Senior debt (${metrics.senior_debt}) exceeds total debt (${metrics.total_debt}). Senior debt is a subset of total debt.`,
        code: 'business_logic',
        value: metrics.senior_debt,
      });
    }

    // Profit margin should be between -1 and 1 (decimal format: 0.15 = 15%).
    // The extraction prompt explicitly instructs "output as decimal (0.15 for 15%)".
    // We do NOT auto-coerce percentage values because values like -1.5 (legitimate -150%
    // margin for distressed companies) are indistinguishable from percentage-format input.
    if (
      metrics.profit_margins != null &&
      (metrics.profit_margins < -1 || metrics.profit_margins > 1)
    ) {
      errors.push({
        path: `metrics_by_year.${year}.profit_margins`,
        message: `Profit margin (${(metrics.profit_margins * 100).toFixed(1)}%) is outside expected range (-100% to 100%).`,
        code: 'business_logic',
        value: metrics.profit_margins,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Validate Nested Components
    // ─────────────────────────────────────────────────────────────────────────

    // Validate debt_components - debt values should be positive
    if (metrics.debt_components && typeof metrics.debt_components === 'object') {
      for (const [key, value] of Object.entries(metrics.debt_components)) {
        if (typeof value === 'number' && value < 0) {
          errors.push({
            path: `metrics_by_year.${year}.debt_components.${key}`,
            message: `Debt component ${key} (${value}) is negative. Debt values should be positive.`,
            code: 'business_logic',
            value,
          });
        }
      }
    }

    // Validate fixed_charges - charges should generally be positive (expenses)
    if (metrics.fixed_charges && typeof metrics.fixed_charges === 'object') {
      const chargeFields = [
        'senior_debt_interest',
        'subordinated_debt_interest',
        'lease_interest',
        'total_interest_expense',
        'minimum_lease_payments',
        'finance_lease_payments',
        'operating_lease_payments',
        'principal_payments',
        'preferred_dividends',
        'other_fixed_charges',
      ];
      for (const key of chargeFields) {
        const value = (metrics.fixed_charges as Record<string, unknown>)[key];
        if (typeof value === 'number' && value < 0) {
          errors.push({
            path: `metrics_by_year.${year}.fixed_charges.${key}`,
            message: `Fixed charge ${key} (${value}) is negative. Fixed charges should be positive expenses.`,
            code: 'business_logic',
            value,
          });
        }
      }

      // Interest rate is now a string (e.g., "prime + 2%", "8%") — no numeric range check needed
    }

    // Validate adjusted_ebitda_components - check for unreasonably large adjustments
    if (
      metrics.adjusted_ebitda_components &&
      typeof metrics.adjusted_ebitda_components === 'object' &&
      metrics.revenue != null &&
      metrics.revenue > 0
    ) {
      const adjustmentFields = [
        'stock_based_compensation',
        'impairment_charges',
        'goodwill_impairment',
        'restructuring_costs',
        'severance_costs',
        'transaction_costs',
        'legal_settlements',
      ];
      for (const key of adjustmentFields) {
        const value = (metrics.adjusted_ebitda_components as Record<string, unknown>)[key];
        // Flag adjustments that exceed 50% of revenue as suspicious
        if (typeof value === 'number' && Math.abs(value) > metrics.revenue * 0.5) {
          errors.push({
            path: `metrics_by_year.${year}.adjusted_ebitda_components.${key}`,
            message: `Adjustment ${key} (${value}) exceeds 50% of revenue (${metrics.revenue}). Verify this is accurate.`,
            code: 'business_logic',
            value,
          });
        }
      }
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate an AI extraction response
 * Performs both schema validation and business logic checks
 *
 * @param response - Raw AI response (parsed JSON)
 * @param chunkIndex - Chunk index for error context
 * @returns Validation result with data or errors
 */
export function validateExtractionResponse(
  response: unknown,
  chunkIndex: number
): ValidationResult<ValidatedAIResponse> {
  const errors: ValidationError[] = [];

  // Schema validation
  const schemaResult = aiExtractionResponseSchema.safeParse(response);

  if (!schemaResult.success) {
    // Convert Zod errors to our format
    for (const issue of schemaResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: 'schema',
        value: undefined,
      });
    }

    console.warn(
      `⚠️ Schema validation failed for chunk ${chunkIndex}:`,
      errors.map((e) => `${e.path}: ${e.message}`).join(', ')
    );

    return { success: false, errors };
  }

  // Business logic validation
  const businessErrors = validateBusinessLogic(schemaResult.data);

  if (businessErrors.length > 0) {
    // Log warnings but don't reject - business logic issues are warnings
    console.warn(
      `⚠️ Business logic warnings for chunk ${chunkIndex}:`,
      businessErrors.map((e) => `${e.path}: ${e.message}`).join('; ')
    );
  }

  // Return success with any business logic warnings attached
  return {
    success: true,
    data: schemaResult.data,
    errors: businessErrors.length > 0 ? businessErrors : undefined,
  };
}

/**
 * Check if a value looks like it came from a table or primary financial statement
 * Used for source type scoring in merge - these sources get highest confidence
 */
export function isTableSource(sourceDescription: string): boolean {
  const tablePatterns = [
    // Explicit table references
    /table/i,
    /schedule/i,
    /exhibit/i,
    /summary/i,
    /reconciliation/i,
    // Primary financial statements (highest authority)
    /statement\s+of/i,
    /balance\s+sheet/i,
    /income\s+statement/i,
    /cash\s+flow/i,
    /statement\s+of\s+financial\s+position/i,
    /statement\s+of\s+comprehensive\s+income/i,
    /statement\s+of\s+operations/i,
    /statement\s+of\s+changes/i,
    // Notes with structured data
    /note\s+\d+/i,
    /footnote/i,
    // Specific sections known to have authoritative data
    /debt\s+schedule/i,
    /maturity\s+schedule/i,
    /lease\s+schedule/i,
    /depreciation\s+schedule/i,
    /amortization\s+schedule/i,
    /credit\s+facilit/i,
    /capital\s+structure/i,
    // Line item indicators (suggests tabular format)
    /line\s+\d+/i,
    /row\s+\d+/i,
  ];
  return tablePatterns.some((p) => p.test(sourceDescription));
}

/**
 * Check if a value is from an overlap region
 * Overlap regions have lower confidence as they may be partial
 * @returns false - placeholder for future enhancement when overlap tracking is added
 */
export function isOverlapSource(): boolean {
  // For now, we can't detect overlap without more context
  // This will be enhanced when we track overlap regions in chunking
  return false;
}
