/**
 * Credit Risk Dashboard Types
 * Shared TypeScript interfaces for the credit-risk components
 */

import type { QuantitativeRiskAssessment, MetricScore } from '@/lib/quantitative-risk';
import type { FinancialData as MainFinancialData } from '@/types';

// Re-export for convenience
export type { QuantitativeRiskAssessment, MetricScore };

// Re-export main FinancialData type for components that need full type compatibility
export type { MainFinancialData };

// Health level classification
export type HealthLevel = 'excellent' | 'good' | 'adequate' | 'weak' | 'poor';

// Risk band from quantitative scoring
export type RiskBand = 'Low Risk' | 'Moderate Risk' | 'Elevated Risk' | 'High Risk' | 'Distressed';

// Lending decision classification
export type LendingDecision = 'Approve' | 'Approve with Conditions' | 'Review Required' | 'Decline';

// Health configuration for styling
export interface HealthConfig {
  level: HealthLevel;
  color: string;
  bgClass: string;
  textClass: string;
  percentage: number;
}

// Debt health assessment from AI
export interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

// FCCR breakdown data structure
export interface FCCRBreakdownData {
  calculation_type: string;
  capex_treatment: 'unfunded' | 'all' | 'none' | 'custom';
  capex_custom_percentage?: number;
  adjusted_ebitda: number;
  capital_expenditures: number;
  proceeds_from_lt_debt: number;
  unfunded_capex: number;
  capex_deduction: number;
  cash_taxes_paid: number;
  distributions_paid: number;
  numerator: number;
  ttm_principal_payments: number;
  ttm_interest_expense: number;
  lease_payments: number;
  denominator: number;
  sources?: {
    capital_expenditures_extracted: number | null;
    proceeds_from_lt_debt_extracted: number | null;
    cash_taxes_paid_extracted: number | null;
    distributions_paid_extracted: number | null;
    ttm_principal_payments_extracted: number | null;
    repayment_of_debt_fallback: number | null;
    ttm_interest_expense_extracted: number | null;
    cash_interest_paid_fallback: number | null;
    interest_accrual_fallback: number | null;
    lease_payments_extracted: number | null;
  };
}

// Debt breakdown structure
export interface DebtBreakdown {
  bank_debt: number;
  lease_liabilities: number;
  notes_payable: number;
  subordinated_debt: number;
  other_non_senior_debt: number;
}

// Year metrics from financial data
export interface YearMetrics {
  // Calculated ratios
  fccr: number | null;
  fccr_numerator: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  total_fixed_charges: number | null;
  current_ratio?: number | null;
  // Source data
  ebitda: number | null;
  adjusted_ebitda: number | null;
  reported_adjusted_ebitda: number | null;
  fccr_breakdown: FCCRBreakdownData | null;
  debt_breakdown: DebtBreakdown | null;
  senior_debt: number | null;
  total_debt: number | null;
  shareholders_equity: number | null;
}

// Financial data structure (re-export from @/types for convenience)
// Components should use @/types/FinancialData directly for full type compatibility
export interface FinancialData {
  metrics_by_year: Record<string, YearMetrics>;
}

// Chart data point for trend visualization
export interface TrendDataPoint {
  year: string;
  fccr: number | null;
  seniorDebtEbitda: number | null;
  debtCapital: number | null;
  currentRatio?: number | null;
}

// Metric card configuration
export interface MetricCardConfig {
  id: string;
  title: string;
  shortTitle: string;
  getValue: (metrics: YearMetrics) => number | null;
  formatValue: (value: number) => string;
  getHealth: (value: number) => HealthConfig;
  target: string;
  tooltip: string;
  higherIsBetter: boolean;
}

// Risk factor item
export interface RiskFactor {
  type: 'risk' | 'positive';
  text: string;
  severity?: 'high' | 'medium' | 'low';
}

// Year source info for multi-document context
export interface YearSourceInfo {
  year: string;
  fileName: string;
}

// Adjusted EBITDA breakdown (re-exported from financial types for convenience)
export interface AdjustedEBITDABreakdown {
  reported_ebitda: number;
  non_cash_adjustments: number;
  one_time_expenses: number;
  one_time_gains: number;
  owner_management_adjustments: number;
  accounting_adjustments: number;
  fx_adjustments: number;
  pro_forma_adjustments: number;
  capital_expenditures_not_in_calc: number;
  uses_reported_value: boolean;
}

// Adjusted EBITDA components (individual line items)
export interface AdjustedEBITDAComponents {
  // Non-cash adjustments
  stock_based_compensation: number | null;
  impairment_charges: number | null;
  goodwill_impairment: number | null;
  unrealized_gains_losses: number | null;
  deferred_compensation: number | null;
  loss_on_disposal: number | null;
  other_non_cash: number | null;
  // One-time expenses
  restructuring_costs: number | null;
  severance_costs: number | null;
  transaction_costs: number | null;
  legal_settlements: number | null;
  professional_fees_one_time: number | null;
  casualty_losses: number | null;
  other_one_time_expenses: number | null;
  // One-time gains
  gain_on_disposal: number | null;
  gain_on_asset_sale: number | null;
  other_income_non_operating: number | null;
  insurance_proceeds: number | null;
  other_one_time_gains: number | null;
  // Owner/management adjustments
  owner_compensation_adjustment: number | null;
  related_party_adjustments: number | null;
  management_fees_adjustment: number | null;
  // Other adjustments
  accounting_policy_adjustments: number | null;
  foreign_exchange_adjustments: number | null;
  pro_forma_cost_savings: number | null;
  pro_forma_synergies: number | null;
}

// Risk data from pillar-based assessment (for compatibility with RiskData type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RiskDataInput = any;

// Props for CreditRiskDashboard
export interface CreditRiskDashboardProps {
  financialData: FinancialData | null;
  quantitativeRiskAssessment: QuantitativeRiskAssessment | null;
  debtHealthAssessment: DebtHealthAssessment | null;
  riskData?: RiskDataInput | null;
  customFccrAdjustment?: number;
  // Project-specific context
  yearSourceInfo?: YearSourceInfo;
  showSourceBanner?: boolean;
}
