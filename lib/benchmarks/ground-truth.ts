/**
 * Ground Truth Data for Benchmark Testing
 *
 * These values are manually verified from source PDF documents.
 * They serve as the baseline for accuracy comparison of text extraction.
 *
 * IMPORTANT: Values marked with TODO must be manually verified
 * from the source PDFs before benchmarking is meaningful.
 */

/**
 * localStorage key prefix for persisted ground truth overrides
 */
export const GROUND_TRUTH_STORAGE_KEY = 'lendflow_gt_v1';

/**
 * All possible ground truth fields, including dot-notation sub-fields
 * for nested objects (debt_components, fixed_charges, adjusted_ebitda_components).
 */
export type GroundTruthValues = {
  // Income Statement
  revenue?: number;
  net_income?: number;
  expenses?: number;
  profit_margins?: number;
  interest?: number;
  taxes?: number;
  depreciation_amortization?: number;
  depreciation_equipment?: number;
  depreciation_rou?: number;
  depreciation_other?: number;
  amortization_intangibles?: number;
  ebitda?: number;
  reported_adjusted_ebitda?: number;

  // Balance Sheet
  shareholders_equity?: number;
  total_debt?: number;
  senior_debt?: number;
  current_assets?: number;
  current_liabilities?: number;

  // Cash Flow
  capital_expenditures?: number;
  proceeds_from_long_term_debt?: number;
  cash_taxes_paid?: number;
  distributions_paid?: number;
  ttm_principal_payments?: number;
  ttm_interest_expense?: number;
  repayment_of_debt?: number;
  payment_of_lease_liability?: number;
  cash_interest_paid?: number;
  non_cash_interest_expense?: number;

  // Debt Components (dot-notation keys)
  'debt_components.bank_debt_current'?: number;
  'debt_components.bank_debt_long_term'?: number;
  'debt_components.term_loans'?: number;
  'debt_components.revolving_credit_facilities'?: number;
  'debt_components.overdraft_facilities'?: number;
  'debt_components.lines_of_credit'?: number;
  'debt_components.lease_liabilities_current'?: number;
  'debt_components.lease_liabilities_long_term'?: number;
  'debt_components.finance_lease_liabilities'?: number;
  'debt_components.operating_lease_liabilities'?: number;
  'debt_components.notes_payable'?: number;
  'debt_components.subordinated_debt'?: number;
  'debt_components.convertible_debt'?: number;
  'debt_components.bonds_debentures'?: number;
  'debt_components.other_borrowings'?: number;

  // Fixed Charges (dot-notation keys)
  'fixed_charges.senior_debt_interest'?: number;
  'fixed_charges.subordinated_debt_interest'?: number;
  'fixed_charges.lease_interest'?: number;
  'fixed_charges.total_interest_expense'?: number;
  'fixed_charges.minimum_lease_payments'?: number;
  'fixed_charges.finance_lease_payments'?: number;
  'fixed_charges.operating_lease_payments'?: number;
  'fixed_charges.principal_payments'?: number;
  'fixed_charges.preferred_dividends'?: number;
  'fixed_charges.other_fixed_charges'?: number;

  // Adjusted EBITDA Components (dot-notation keys)
  'adjusted_ebitda_components.stock_based_compensation'?: number;
  'adjusted_ebitda_components.impairment_charges'?: number;
  'adjusted_ebitda_components.goodwill_impairment'?: number;
  'adjusted_ebitda_components.unrealized_gains_losses'?: number;
  'adjusted_ebitda_components.deferred_compensation'?: number;
  'adjusted_ebitda_components.loss_on_disposal'?: number;
  'adjusted_ebitda_components.other_non_cash'?: number;
  'adjusted_ebitda_components.restructuring_costs'?: number;
  'adjusted_ebitda_components.severance_costs'?: number;
  'adjusted_ebitda_components.transaction_costs'?: number;
  'adjusted_ebitda_components.legal_settlements'?: number;
  'adjusted_ebitda_components.professional_fees_one_time'?: number;
  'adjusted_ebitda_components.casualty_losses'?: number;
  'adjusted_ebitda_components.other_one_time_expenses'?: number;
  'adjusted_ebitda_components.gain_on_disposal'?: number;
  'adjusted_ebitda_components.gain_on_asset_sale'?: number;
  'adjusted_ebitda_components.other_income_non_operating'?: number;
  'adjusted_ebitda_components.insurance_proceeds'?: number;
  'adjusted_ebitda_components.other_one_time_gains'?: number;
  'adjusted_ebitda_components.owner_compensation_adjustment'?: number;
  'adjusted_ebitda_components.related_party_adjustments'?: number;
  'adjusted_ebitda_components.management_fees_adjustment'?: number;
  'adjusted_ebitda_components.accounting_policy_adjustments'?: number;
  'adjusted_ebitda_components.foreign_exchange_adjustments'?: number;
  'adjusted_ebitda_components.pro_forma_cost_savings'?: number;
  'adjusted_ebitda_components.pro_forma_synergies'?: number;

  // Computed Ratios
  adjusted_ebitda?: number;
  calculated_adjusted_ebitda?: number;
  fccr?: number;
  dscr?: number;
  funded_debt?: number;
  funded_debt_to_ebitda?: number;
  senior_debt_to_ebitda?: number;
  total_debt_to_capital?: number;
  interest_coverage_ratio?: number;
  debt_to_equity_ratio?: number;
  current_ratio?: number;
};

/**
 * Ground truth entry for a single fiscal year of a document
 */
export interface GroundTruthEntry {
  /** Document identifier (e.g., "Zedcor-FY2024") */
  document: string;
  /** Exact filename in public/financialReports/ */
  filename: string;
  /** Fiscal year as string (e.g., "2024") */
  fiscal_year: string;
  /** Verified financial values */
  values: GroundTruthValues;
  /** Source documentation (e.g., "From consolidated income statement p.3") */
  source_notes?: string;
}

/**
 * Ground truth values for benchmark documents.
 *
 * IMPORTANT: Only include values that have been manually verified.
 * Unverified fields should be left as undefined (not 0).
 * AI-extracted values should NOT be used as ground truth.
 */
export const GROUND_TRUTH: GroundTruthEntry[] = [
  {
    document: 'Zedcor-FY2023',
    filename: '2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf',
    fiscal_year: '2023',
    values: {
      revenue: 24889,
      net_income: 2652,
      ebitda: 9136,
      adjusted_ebitda: 7541,
      shareholders_equity: 12115,
      total_debt: 27614,
      senior_debt: 24365,
      fccr: 0.57,
    },
    source_notes:
      'Partially verified from source PDF. Remaining fields require manual verification.',
  },
  {
    document: 'Zedcor-FY2024',
    filename:
      '2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf',
    fiscal_year: '2024',
    values: {
      // TODO: Manually verify from source PDF before benchmarking
    },
    source_notes:
      'No values verified yet - requires manual verification from PDF',
  },
  {
    document: 'Taiga-FY2024',
    filename:
      'Taiga_-_December_31,_2024_audited_financial_statements.pdf',
    fiscal_year: '2024',
    values: {
      // TODO: Manually verify from source PDF before benchmarking
    },
    source_notes:
      'No values verified yet - requires manual verification from PDF',
  },
];

/**
 * Get ground truth by filename (partial match) and fiscal year.
 *
 * Matching strategy: Case-insensitive partial match on filename or document name.
 *
 * @param filename - Full or partial filename to match
 * @param fiscalYear - Fiscal year to match (e.g., "2024")
 * @returns Matching GroundTruthEntry or undefined if not found
 */
export function getGroundTruth(
  filename: string,
  fiscalYear: string,
): GroundTruthEntry | undefined {
  const normalizedInput = filename.toLowerCase();

  return GROUND_TRUTH.find((entry) => {
    if (entry.fiscal_year !== fiscalYear) {
      return false;
    }

    const entryFilename = entry.filename.toLowerCase();
    const documentName = entry.document.toLowerCase().split('-')[0];

    return (
      normalizedInput === entryFilename ||
      normalizedInput.includes(entryFilename) ||
      entryFilename.includes(normalizedInput) ||
      normalizedInput.includes(documentName)
    );
  });
}

/**
 * Get all ground truth entries for a specific document (all years)
 */
export function getGroundTruthByDocument(
  documentPrefix: string,
): GroundTruthEntry[] {
  const normalizedPrefix = documentPrefix.toLowerCase();
  return GROUND_TRUTH.filter((entry) =>
    entry.document.toLowerCase().startsWith(normalizedPrefix),
  );
}

/**
 * Check if ground truth values have been populated (not all empty)
 */
export function isGroundTruthPopulated(
  entry: GroundTruthEntry,
): boolean {
  const values = entry.values;
  return Object.values(values).some(
    (v) => v !== undefined && v !== null,
  );
}

/**
 * Check if all ground truth entries are populated
 */
export function areAllGroundTruthsPopulated(): boolean {
  return GROUND_TRUTH.every(isGroundTruthPopulated);
}
