/**
 * Shared test helpers for calculation module tests.
 * Provides factory functions to build ExtractedMetrics without specifying every field.
 */

import type { ExtractedMetrics, DebtComponents, FixedCharges, AdjustedEBITDAComponents } from '@/types';

/** All-null ExtractedMetrics baseline */
const NULL_METRICS: ExtractedMetrics = {
  revenue: null,
  net_income: null,
  expenses: null,
  profit_margins: null,
  interest: null,
  interest_income: null,
  taxes: null,
  depreciation_amortization: null,
  depreciation_equipment: null,
  depreciation_rou: null,
  depreciation_other: null,
  amortization_intangibles: null,
  ebitda: null,
  shareholders_equity: null,
  total_debt: null,
  senior_debt: null,
  current_assets: null,
  current_liabilities: null,
  capital_expenditures: null,
  proceeds_from_long_term_debt: null,
  cash_taxes_paid: null,
  distributions_paid: null,
  ttm_principal_payments: null,
  ttm_interest_expense: null,
  repayment_of_debt: null,
  payment_of_lease_liability: null,
  cash_interest_paid: null,
  non_cash_interest_expense: null,
  debt_components: null,
  fixed_charges: null,
  adjusted_ebitda_components: null,
};

/** Build ExtractedMetrics with only the fields you care about */
export function makeMetrics(overrides: Partial<ExtractedMetrics> = {}): ExtractedMetrics {
  return { ...NULL_METRICS, ...overrides };
}

/** All-null DebtComponents baseline */
const NULL_DEBT_COMPONENTS: DebtComponents = {
  bank_debt_current: null,
  bank_debt_long_term: null,
  term_loans: null,
  revolving_credit_facilities: null,
  overdraft_facilities: null,
  lines_of_credit: null,
  lease_liabilities_current: null,
  lease_liabilities_long_term: null,
  finance_lease_liabilities: null,
  operating_lease_liabilities: null,
  notes_payable: null,
  subordinated_debt: null,
  convertible_debt: null,
  bonds_debentures: null,
  other_borrowings: null,
};

/** Build DebtComponents with only the fields you care about */
export function makeDebtComponents(overrides: Partial<DebtComponents> = {}): DebtComponents {
  return { ...NULL_DEBT_COMPONENTS, ...overrides };
}

/** All-null FixedCharges baseline */
const NULL_FIXED_CHARGES: FixedCharges = {
  senior_debt_interest: null,
  subordinated_debt_interest: null,
  lease_interest: null,
  total_interest_expense: null,
  senior_debt_interest_rate: null,
  minimum_lease_payments: null,
  finance_lease_payments: null,
  operating_lease_payments: null,
  principal_payments: null,
  preferred_dividends: null,
  other_fixed_charges: null,
};

/** Build FixedCharges with only the fields you care about */
export function makeFixedCharges(overrides: Partial<FixedCharges> = {}): FixedCharges {
  return { ...NULL_FIXED_CHARGES, ...overrides };
}

/** All-null AdjustedEBITDAComponents baseline */
const NULL_ADJUSTED_EBITDA_COMPONENTS: AdjustedEBITDAComponents = {
  stock_based_compensation: null,
  impairment_charges: null,
  goodwill_impairment: null,
  unrealized_gains_losses: null,
  deferred_compensation: null,
  loss_on_disposal: null,
  other_non_cash: null,
  restructuring_costs: null,
  severance_costs: null,
  transaction_costs: null,
  legal_settlements: null,
  professional_fees_one_time: null,
  casualty_losses: null,
  other_one_time_expenses: null,
  gain_on_disposal: null,
  gain_on_asset_sale: null,
  other_income_non_operating: null,
  insurance_proceeds: null,
  other_one_time_gains: null,
  owner_compensation_adjustment: null,
  related_party_adjustments: null,
  management_fees_adjustment: null,
  accounting_policy_adjustments: null,
  foreign_exchange_adjustments: null,
  unrealized_fx_cash_flow: null,
  realized_fx_pl: null,
  pro_forma_cost_savings: null,
  pro_forma_synergies: null,
};

/** Build AdjustedEBITDAComponents with only the fields you care about */
export function makeAdjustedEBITDAComponents(
  overrides: Partial<AdjustedEBITDAComponents> = {}
): AdjustedEBITDAComponents {
  return { ...NULL_ADJUSTED_EBITDA_COMPONENTS, ...overrides };
}
