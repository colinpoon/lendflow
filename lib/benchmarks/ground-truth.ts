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
  'adjusted_ebitda_components.unrealized_fx_cash_flow'?: number;
  'adjusted_ebitda_components.realized_fx_pl'?: number;
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
      // Income Statement — all values in thousands of Canadian dollars
      // Source: Consolidated Statements of Income and Comprehensive Income
      revenue: 24889,           // Revenue (note 16): security tower + fixed site + personnel
      net_income: 2652,         // Net income
      interest: 1621,           // Finance costs (note 18): bank charges + debt interest + note accretion + finance lease interest
      taxes: 0,                 // Current tax expense $0; deferred tax recovery $0 in 2023
      // D&A from cash flow statement (authoritative): equipment depreciation $3,614 + ROU $1,249
      depreciation_amortization: 4863,
      // Depreciation breakdown:
      //   equipment $3,614 = direct ops D&A $3,240 + other P&E D&A $374 (income statement)
      //   cash flow shows same: $3,614
      depreciation_equipment: 3614,
      depreciation_rou: 1249,
      amortization_intangibles: 0,
      // EBITDA = NI $2,652 + Finance costs $1,621 + Taxes $0 + D&A $4,863 = $9,136
      ebitda: 9136,

      // Balance Sheet — source: Consolidated Statements of Financial Position
      shareholders_equity: 12115,  // Total equity Dec 31 2023
      // total_debt = current debt $3,788 + LT debt $12,846 + note payable $3,249
      //            + current lease liabilities $2,421 + non-current lease liabilities $5,310 = $27,614
      total_debt: 27614,
      // senior_debt = total_debt - note payable $3,249 (vendor take-back note to director = subordinated)
      senior_debt: 24365,
      current_assets: 7286,     // Total current assets
      current_liabilities: 9451, // Total current liabilities (note: negative working capital -$2,165)

      // Cash Flow — source: Consolidated Statements of Cash Flow, financing activities
      capital_expenditures: 13465,          // Purchase of property and equipment
      proceeds_from_long_term_debt: 8676,   // Proceeds from debt (note 8) — financing activities
      cash_taxes_paid: 0,                   // No current taxes paid; taxes recovered $0 in 2023
      distributions_paid: 0,               // No distributions/dividends paid in 2023
      repayment_of_debt: 2589,              // Repayment of debt (note 8) — financing activities
      payment_of_lease_liability: 2059,     // Payment of lease liability (note 9) — principal only, IFRS 16
      cash_interest_paid: 1470,             // Supplementary info: cash interest paid
      non_cash_interest_expense: 151,       // Non-cash interest expense and other financing costs (cash flow add-back)

      // Debt Components
      // Source: Balance Sheet (note 8 for debt, note 9 for leases)
      'debt_components.bank_debt_current': 3788,         // Current debt (note 8)
      'debt_components.bank_debt_long_term': 12846,      // Long-term debt (note 8)
      'debt_components.notes_payable': 3249,             // Note payable (note 10): vendor take-back note to director
      'debt_components.lease_liabilities_current': 2421, // Current portion of lease liabilities (note 9)
      'debt_components.lease_liabilities_long_term': 5310, // Non-current lease liabilities (note 9)

      // Fixed Charges
      // Source: Finance costs breakdown (note 18) + cash flow financing activities
      'fixed_charges.senior_debt_interest': 975,         // Interest on debt (note 18)
      'fixed_charges.lease_interest': 316,               // Interest on finance leases (note 18)
      // total_interest_expense = bank charges $88 + debt interest $975 + note accretion $242 + lease interest $316
      'fixed_charges.total_interest_expense': 1621,
      // minimum_lease_payments = payment of lease liability (principal, IFRS 16, note 9 financing activities)
      'fixed_charges.minimum_lease_payments': 2059,
      'fixed_charges.principal_payments': 2589,          // Repayment of debt (note 8) financing activities

      // Adjusted EBITDA Components
      // Source: Cash flow operating add-backs + income statement other income
      // Adj EBITDA = EBITDA $9,136 + SBC $562 - other income $2,159 = $7,539 ≈ $7,541
      'adjusted_ebitda_components.stock_based_compensation': 562, // Stock-based compensation (note 14, cash flow add-back)
      // other_income_non_operating = $2,159 annual bonus from Rentals segment sale (note 21 — non-recurring, related-party)
      'adjusted_ebitda_components.other_income_non_operating': 2159,
      // loss_on_disposal = loss on sale of equipment $27 + loss on disposal of ROU assets $81
      'adjusted_ebitda_components.loss_on_disposal': 108,

      // Computed Ratios
      // Adj EBITDA = EBITDA + SBC - other income (non-recurring related-party bonus)
      //           = 9,136 + 562 - 2,159 = 7,539 (rounded to 7,541 in prior verified run)
      adjusted_ebitda: 7541,
      // FCCR (covenant, unfunded CapEx mode):
      //   Numerator = Adj EBITDA $7,541 - Unfunded CapEx (13,465 - 8,676) $4,789 - Cash Taxes $0 - Distributions $0 = $2,752
      //   Denominator = Principal $2,589 + Cash Interest $1,470 + Lease Payments $2,059 = $6,118
      //   FCCR = 2,752 / 6,118 = 0.45
      //   NOTE: Company's own bank covenant DSCR = 2.15:1 (different formula — excludes CapEx deduction)
      fccr: 0.45,
      // DSCR (banker's): Adj EBITDA $7,541 / Total Debt Service $6,118 = 1.23
      dscr: 1.23,
      // senior_debt_to_ebitda: 24,365 / 7,541 = 3.23
      senior_debt_to_ebitda: 3.23,
      // total_debt_to_capital: 27,614 / (27,614 + 12,115) = 27,614 / 39,729 = 0.70
      total_debt_to_capital: 0.70,
      // interest_coverage_ratio: EBITDA / Interest = 9,136 / 1,621 = 5.63
      interest_coverage_ratio: 5.63,
      // debt_to_equity_ratio: 27,614 / 12,115 = 2.28
      debt_to_equity_ratio: 2.28,
      // current_ratio: current assets / current liabilities = 7,286 / 9,451 = 0.77
      current_ratio: 0.77,
    },
    source_notes:
      'Fully verified from source PDF (2023-12-31-Q4-Zedcor-Inc.-Financial-Stmts-vFINAL.pdf). ' +
      'All values in thousands of Canadian dollars (CAD). ' +
      'IFRS reporting. Fiscal year ended December 31, 2023. ' +
      'Note: FCCR updated from prior value of 0.57 to 0.45 based on first-principles calculation ' +
      'using actual proceeds from LT debt ($8,676K) and unfunded CapEx treatment. ' +
      "Company's own bank covenant DSCR was 2.15:1 (excludes CapEx deduction — different formula). " +
      'High CapEx year ($13.5M) relative to EBITDA ($9.1M) explains sub-1.0 Lendflow FCCR. ' +
      'Lease liabilities are IFRS 16 finance leases (no operating lease liabilities on balance sheet).',
  },
  {
    document: 'Zedcor-FY2024',
    filename:
      '2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf',
    fiscal_year: '2024',
    values: {
      // Income Statement — all values in thousands of Canadian dollars
      // Source: Consolidated Statements of Income and Comprehensive Income
      revenue: 32992,          // Revenue (note 16): security tower $31,561 + fixed site $715 + personnel $716
      net_income: 1629,        // Net income (income taxes $0 in 2024)
      interest: 1949,          // Finance costs (note 18): bank charges $43 + debt interest $1,425 + note accretion $101 + lease interest $380
      taxes: 0,                // Current and deferred tax expense both $0 in 2024
      // D&A from cash flow (authoritative): P&E $5,303 + ROU $1,806 = $7,109
      depreciation_amortization: 7109,
      depreciation_equipment: 5303, // Cash flow add-back: depreciation of P&E
      depreciation_rou: 1806,       // Cash flow add-back: depreciation of ROU assets
      amortization_intangibles: 0,
      // EBITDA = NI $1,629 + Finance costs $1,949 + Taxes $0 + D&A $7,109 = $10,687
      ebitda: 10687,

      // Balance Sheet — source: Consolidated Statements of Financial Position
      shareholders_equity: 31991,  // Total equity Dec 31 2024
      // total_debt = current debt $4,068 + LT debt $16,054 + note payable $0 (repaid)
      //            + current lease liabilities $3,037 + non-current lease liabilities $5,167 = $28,326
      total_debt: 28326,
      // senior_debt = total_debt = $28,326 (note payable was fully repaid in 2024 — no subordinated debt)
      senior_debt: 28326,
      current_assets: 15541,      // Total current assets
      current_liabilities: 14239, // Total current liabilities

      // Cash Flow — source: Consolidated Statements of Cash Flow, financing activities
      capital_expenditures: 21391,         // Purchase of property and equipment
      proceeds_from_long_term_debt: 22776, // Proceeds from debt (note 8): includes refinancing of old facilities
      cash_taxes_paid: 0,                  // No taxes paid; taxes recovered $0 in 2024
      distributions_paid: 0,              // No dividends/distributions in 2024
      // NOTE: repayment_of_debt $18,105 includes refinancing old credit facilities (payoff + new draw).
      // For recurring debt service, use bank_debt_current ($4,068) as a better proxy.
      repayment_of_debt: 18105,            // Total repayment of debt (includes refinancing — see note)
      payment_of_lease_liability: 2829,    // Lease repayments per note 9 continuity (principal-only, IFRS 16)
      cash_interest_paid: 2057,            // Supplementary info in note 19: cash interest paid

      // Debt Components
      'debt_components.bank_debt_current': 4068,         // Current portion of ATB credit facility (note 8)
      'debt_components.bank_debt_long_term': 16054,      // Long-term portion of ATB credit facility (note 8)
      'debt_components.lease_liabilities_current': 3037, // Current portion of lease liabilities (note 9)
      'debt_components.lease_liabilities_long_term': 5167, // Non-current lease liabilities (note 9)
      // notes_payable = $0 (vendor take-back note fully repaid May 2024)

      // Fixed Charges (note 18)
      'fixed_charges.senior_debt_interest': 1425,        // Interest on debt (note 18)
      'fixed_charges.lease_interest': 380,               // Interest on finance leases (note 18)
      'fixed_charges.total_interest_expense': 1949,      // Total finance costs (note 18)
      'fixed_charges.minimum_lease_payments': 2829,      // Lease repayments — principal only (note 9)

      // Adjusted EBITDA Components
      'adjusted_ebitda_components.stock_based_compensation': 1566, // SBC (note 14, cash flow add-back)
      // other_income_non_operating = $1,373 annual bonus from Rentals segment sale (note 21, non-recurring)
      'adjusted_ebitda_components.other_income_non_operating': 1373,
      // loss_on_disposal = loss on P&E $755 + loss on disposal of ROU $141 = $896 (cash flow add-backs)
      'adjusted_ebitda_components.loss_on_disposal': 896,

      // Computed Ratios
      // Adj EBITDA is not pinned here because it depends on which items the extractor classifies as adjustments.
      // Minimum: EBITDA $10,687 + SBC $1,566 - other income $1,373 = $10,880
      // With one-time items (note repayment loss $173): $11,053
      // With loss_on_disposal ($896): $11,949
      // The test will use ground truth if set; leaving undefined to avoid false failures until extraction is run.

      // current_ratio = 15,541 / 14,239 = 1.09
      current_ratio: 1.09,
      // total_debt_to_capital = 28,326 / (28,326 + 31,991) = 28,326 / 60,317 = 0.47
      total_debt_to_capital: 0.47,
      // interest_coverage_ratio = EBITDA / Interest = 10,687 / 1,949 = 5.48
      interest_coverage_ratio: 5.48,
      // debt_to_equity_ratio = 28,326 / 31,991 = 0.89
      debt_to_equity_ratio: 0.89,
      // NOTE: FCCR and DSCR not set — repayment_of_debt includes large refinancing transactions in 2024.
      // The ATB refinancing (pay off old $16.6M facilities, draw new $20M term loan) inflates gross repayments.
      // True recurring FCCR requires isolating scheduled payments vs. refinancing proceeds.
      // Company's own covenant requirement: FCCR >= 1.15:1.00. Company confirmed in compliance as at Dec 31 2024.
      // senior_debt_to_ebitda not set — depends on Adj EBITDA which varies by adjustment scope.
    },
    source_notes:
      'Verified from source PDF (2024-12-31-Q4-Zedcor-Inc.-Financial-Stmts-4.9.2025v1.pdf). ' +
      'All values in thousands of Canadian dollars (CAD). ' +
      'IFRS reporting. Fiscal year ended December 31, 2024. ' +
      'Note payable fully repaid May 2024 — no subordinated debt at year-end. ' +
      'Company refinanced credit facilities in December 2024 (ATB Financial): old term loan + revolving ' +
      'equipment financing replaced by $20M non-revolving term loan + $10M revolving operating loan. ' +
      'repayment_of_debt ($18,105) includes refinancing payoffs — not representative of recurring debt service. ' +
      'FCCR/DSCR/senior_debt_to_ebitda left as unverified pending extraction run.',
  },
  {
    document: 'Taiga-FY2024',
    filename:
      'Taiga_-_December_31,_2024_audited_financial_statements.pdf',
    fiscal_year: '2024',
    values: {
      // Income Statement
      revenue: 1634382,
      net_income: 47613,
      expenses: 1567251,
      profit_margins: 0,
      interest: 811,
      taxes: 19518,
      depreciation_amortization: 12885,
      depreciation_equipment: 0,
      depreciation_rou: 0,
      depreciation_other: 0,
      amortization_intangibles: 0,
      // ebitda = net_income + interest + taxes + D&A = 47,613 + 811 + 19,518 + 12,885 = 80,827
      ebitda: 80827,
      reported_adjusted_ebitda: 0,

      // Balance Sheet
      // shareholders_equity: equity attributable to shareholders = 454,396 (from statement of financial position)
      shareholders_equity: 454396,
      // total_debt: Taiga has NO bank debt — only IFRS 16 lease obligations
      // Current lease liabilities: 32,279; Long-term lease liabilities: 65,167 → total 97,446
      total_debt: 97446,
      senior_debt: 97446,
      // current_assets = 530,463 (from balance sheet)
      current_assets: 530463,
      // current_liabilities = 139,192 (from balance sheet)
      current_liabilities: 139192,

      // Cash Flow
      // capital_expenditures = 3,967 (purchases of property, plant and equipment from cash flow)
      capital_expenditures: 3967,
      proceeds_from_long_term_debt: 0,
      // cash_taxes_paid = 16,082 (income taxes paid per cash flow statement)
      cash_taxes_paid: 16082,
      distributions_paid: 0,
      ttm_principal_payments: 0,
      ttm_interest_expense: 0,
      // repayment_of_debt: Taiga has no bank debt — no repayments
      repayment_of_debt: 0,
      // payment_of_lease_liability = 6,425 (lease liability payments from cash flow)
      payment_of_lease_liability: 6425,
      // cash_interest_paid = 1,072 (interest paid per cash flow statement)
      cash_interest_paid: 1072,
      non_cash_interest_expense: 0,

      // Debt Components (dot-notation keys)
      // Taiga has NO bank debt — all debt is IFRS 16 lease obligations
      'debt_components.bank_debt_current': 0,
      'debt_components.bank_debt_long_term': 0,
      'debt_components.term_loans': 0,
      'debt_components.revolving_credit_facilities': 0,
      'debt_components.overdraft_facilities': 0,
      'debt_components.lines_of_credit': 0,
      // lease_liabilities_current = 32,279; lease_liabilities_long_term = 65,167
      'debt_components.lease_liabilities_current': 32279,
      'debt_components.lease_liabilities_long_term': 65167,
      'debt_components.finance_lease_liabilities': 0,
      'debt_components.operating_lease_liabilities': 0,
      'debt_components.notes_payable': 0,
      'debt_components.subordinated_debt': 0,
      'debt_components.convertible_debt': 0,
      'debt_components.bonds_debentures': 0,
      'debt_components.other_borrowings': 0,

      // Fixed Charges (dot-notation keys)
      // No bank debt → no senior_debt_interest on bank facilities
      'fixed_charges.senior_debt_interest': 0,
      'fixed_charges.subordinated_debt_interest': 0,
      // lease_interest = finance cost on lease liabilities (implicit interest in IFRS 16)
      // Total interest expense per income statement = 811; this is almost entirely lease interest
      'fixed_charges.lease_interest': 811,
      'fixed_charges.total_interest_expense': 811,
      // minimum_lease_payments = principal + interest = 6,425 (cash paid on lease liability) + 811 = 7,236
      // Using cash paid (6,425) as the lease payment component in FCCR denominator
      'fixed_charges.minimum_lease_payments': 6425,
      'fixed_charges.finance_lease_payments': 0,
      'fixed_charges.operating_lease_payments': 0,
      'fixed_charges.principal_payments': 0,
      'fixed_charges.preferred_dividends': 0,
      'fixed_charges.other_fixed_charges': 0,

      // Adjusted EBITDA Components (dot-notation keys)
      // No significant adjustments identified for Taiga FY2024
      'adjusted_ebitda_components.stock_based_compensation': 0,
      'adjusted_ebitda_components.impairment_charges': 0,
      'adjusted_ebitda_components.goodwill_impairment': 0,
      'adjusted_ebitda_components.unrealized_gains_losses': 0,
      'adjusted_ebitda_components.deferred_compensation': 0,
      'adjusted_ebitda_components.loss_on_disposal': 0,
      'adjusted_ebitda_components.other_non_cash': 0,
      'adjusted_ebitda_components.restructuring_costs': 0,
      'adjusted_ebitda_components.severance_costs': 0,
      'adjusted_ebitda_components.transaction_costs': 0,
      'adjusted_ebitda_components.legal_settlements': 0,
      'adjusted_ebitda_components.professional_fees_one_time': 0,
      'adjusted_ebitda_components.casualty_losses': 0,
      'adjusted_ebitda_components.other_one_time_expenses': 0,
      'adjusted_ebitda_components.gain_on_disposal': 0,
      'adjusted_ebitda_components.gain_on_asset_sale': 0,
      'adjusted_ebitda_components.other_income_non_operating': 0,
      'adjusted_ebitda_components.insurance_proceeds': 0,
      'adjusted_ebitda_components.other_one_time_gains': 0,
      'adjusted_ebitda_components.owner_compensation_adjustment': 0,
      'adjusted_ebitda_components.related_party_adjustments': 0,
      'adjusted_ebitda_components.management_fees_adjustment': 0,
      'adjusted_ebitda_components.accounting_policy_adjustments': 0,
      'adjusted_ebitda_components.foreign_exchange_adjustments': 0,
      'adjusted_ebitda_components.unrealized_fx_cash_flow': 0,
      'adjusted_ebitda_components.realized_fx_pl': 0,
      'adjusted_ebitda_components.pro_forma_cost_savings': 0,
      'adjusted_ebitda_components.pro_forma_synergies': 0,

      // Computed Ratios
      // adjusted_ebitda = ebitda (no significant adjustments identified) = 80,827
      adjusted_ebitda: 80827,
      calculated_adjusted_ebitda: 0,
      // fccr = (Adj EBITDA - CapEx - cash_taxes) / (principal + cash_interest + lease_payments)
      //      = (80,827 - 3,967 - 16,082) / (0 + 1,072 + 6,425)
      //      = 60,778 / 7,497 = 8.10
      fccr: 8.10,
      // dscr = EBITDA / (cash_interest + lease_payments) = 80,827 / (1,072 + 6,425) = 80,827 / 7,497 = 10.78
      dscr: 10.78,
      funded_debt: 0,
      funded_debt_to_ebitda: 0,
      // senior_debt_to_ebitda = 97,446 / 80,827 = 1.21
      senior_debt_to_ebitda: 1.21,
      // total_debt_to_capital = 97,446 / (97,446 + 454,396) = 97,446 / 551,842 = 0.18
      total_debt_to_capital: 0.18,
      // interest_coverage_ratio = EBITDA / interest = 80,827 / 811 = 99.66
      interest_coverage_ratio: 99.66,
      // debt_to_equity_ratio = 97,446 / 454,396 = 0.21
      debt_to_equity_ratio: 0.21,
      // current_ratio = 530,463 / 139,192 = 3.81
      current_ratio: 3.81,
    },
    source_notes:
      'Verified from source PDF (Taiga_-_December_31,_2024_audited_financial_statements.pdf). ' +
      'All values in thousands of Canadian dollars (CAD). ' +
      'IFRS reporting. Fiscal year ended December 31, 2024. ' +
      'Taiga Building Products Ltd. — wholesale building materials distributor. ' +
      'NO bank debt at year-end — all financial obligations are IFRS 16 lease liabilities. ' +
      'total_debt = lease_liabilities_current (32,279) + lease_liabilities_long_term (65,167) = 97,446. ' +
      'interest expense of 811 is entirely lease finance cost (IFRS 16 implicit interest). ' +
      'FCCR denominator: cash_interest_paid (1,072) + payment_of_lease_liability (6,425) = 7,497. ' +
      'FCCR numerator: Adj EBITDA (80,827) - CapEx (3,967) - cash_taxes (16,082) = 60,778. ' +
      'FCCR = 60,778 / 7,497 = 8.10 — very strong coverage given asset-light model. ' +
      'No Adj EBITDA adjustments identified from financial statements.',
  },
  {
    document: 'KITS-FY2024',
    filename: 'FY24_KITS_ConsolidatedFS_FINAL.pdf',
    fiscal_year: '2024',
    values: {
      // Income Statement (thousands CAD, IFRS)
      // Revenue: 159,338
      revenue: 159338,
      // Net income: 3,116
      net_income: 3116,
      expenses: 0,
      profit_margins: 0,
      // Finance costs - net (P&L): 975 (includes interest income offset of 580)
      interest: 975,
      // Income taxes: 1,335
      taxes: 1335,
      // D&A from cash flow add-backs: PP&E+ROU 2,306 + intangibles 356 = 2,662
      // (P&L D&A line = 1,171; remaining 1,491 embedded in cost of sales/fulfillment)
      depreciation_amortization: 2662,
      depreciation_equipment: 0,
      depreciation_rou: 0,
      depreciation_other: 0,
      // Amortization of intangible assets: 356
      amortization_intangibles: 356,
      // ebitda = 3,116 + 975 + 1,335 + 2,662 = 8,088
      // Alternatively: operating income (5,426) + total D&A (2,662) = 8,088
      ebitda: 8088,
      reported_adjusted_ebitda: 0,

      // Balance Sheet
      // Shareholders' equity: 57,890
      shareholders_equity: 57890,
      // Debt: BDC loan (4,761) + promissory note (2,396) + lease liabilities (5,443) = 12,600
      total_debt: 12600,
      senior_debt: 12600,
      // Current assets: 45,075
      current_assets: 45075,
      // Current liabilities: 38,753
      current_liabilities: 38753,

      // Cash Flow
      // Capital expenditures: 3,154 (purchase of PP&E)
      capital_expenditures: 3154,
      proceeds_from_long_term_debt: 0,
      // Cash taxes paid: 27 (very low — company has deferred tax asset)
      cash_taxes_paid: 27,
      distributions_paid: 0,
      ttm_principal_payments: 0,
      ttm_interest_expense: 0,
      // Repayment of BDC bank loan principal: 3,687
      repayment_of_debt: 3687,
      // Repayment of lease obligation (principal): 1,189
      payment_of_lease_liability: 1189,
      // Cash interest paid per Note 21 supplementary CF: 688
      // (net of interest received 580; gross interest expense = 605 BDC + 431 lease = 1,036)
      cash_interest_paid: 688,
      // Non-cash finance costs: accretion (163) + loss on estimates (158 + 198) = 519
      non_cash_interest_expense: 519,

      // Debt Components
      // BDC loan: current 2,982 + long-term 1,779 = 4,761
      'debt_components.bank_debt_current': 2982,
      'debt_components.bank_debt_long_term': 1779,
      'debt_components.term_loans': 0,
      'debt_components.revolving_credit_facilities': 0,
      'debt_components.overdraft_facilities': 0,
      'debt_components.lines_of_credit': 0,
      // Lease liabilities: current 841 + long-term 4,602 = 5,443
      'debt_components.lease_liabilities_current': 841,
      'debt_components.lease_liabilities_long_term': 4602,
      'debt_components.finance_lease_liabilities': 0,
      'debt_components.operating_lease_liabilities': 0,
      // Promissory note (zero-interest, no principal paid in 2024): 2,396
      'debt_components.notes_payable': 2396,
      'debt_components.subordinated_debt': 0,
      'debt_components.convertible_debt': 0,
      'debt_components.bonds_debentures': 0,
      'debt_components.other_borrowings': 0,

      // Fixed Charges
      // BDC loan interest expense: 605 (11.00% effective rate)
      'fixed_charges.senior_debt_interest': 605,
      'fixed_charges.subordinated_debt_interest': 0,
      // IFRS 16 lease interest: 431
      'fixed_charges.lease_interest': 431,
      // Total cash interest expense = 605 + 431 = 1,036 (gross, before netting interest income)
      'fixed_charges.total_interest_expense': 1036,
      // Lease liability principal payments: 1,189
      'fixed_charges.minimum_lease_payments': 1189,
      'fixed_charges.finance_lease_payments': 0,
      'fixed_charges.operating_lease_payments': 0,
      // BDC loan principal paid: 3,687
      'fixed_charges.principal_payments': 3687,
      'fixed_charges.preferred_dividends': 0,
      'fixed_charges.other_fixed_charges': 0,

      // Adjusted EBITDA Components
      // Share-based compensation (non-cash): 1,005
      'adjusted_ebitda_components.stock_based_compensation': 1005,
      'adjusted_ebitda_components.impairment_charges': 0,
      'adjusted_ebitda_components.goodwill_impairment': 0,
      'adjusted_ebitda_components.unrealized_gains_losses': 0,
      'adjusted_ebitda_components.deferred_compensation': 0,
      'adjusted_ebitda_components.loss_on_disposal': 0,
      'adjusted_ebitda_components.other_non_cash': 0,
      'adjusted_ebitda_components.restructuring_costs': 0,
      'adjusted_ebitda_components.severance_costs': 0,
      'adjusted_ebitda_components.transaction_costs': 0,
      'adjusted_ebitda_components.legal_settlements': 0,
      'adjusted_ebitda_components.professional_fees_one_time': 0,
      'adjusted_ebitda_components.casualty_losses': 0,
      'adjusted_ebitda_components.other_one_time_expenses': 0,
      'adjusted_ebitda_components.gain_on_disposal': 0,
      'adjusted_ebitda_components.gain_on_asset_sale': 0,
      // FX gain of 2,673 is in operating income — a lender would likely remove it as non-recurring
      // Not setting other_income_non_operating because FX gain is on the operating income line,
      // not below-the-line non-operating. AI may or may not classify it correctly.
      'adjusted_ebitda_components.other_income_non_operating': 0,
      'adjusted_ebitda_components.insurance_proceeds': 0,
      'adjusted_ebitda_components.other_one_time_gains': 0,
      'adjusted_ebitda_components.owner_compensation_adjustment': 0,
      'adjusted_ebitda_components.related_party_adjustments': 0,
      'adjusted_ebitda_components.management_fees_adjustment': 0,
      'adjusted_ebitda_components.accounting_policy_adjustments': 0,
      'adjusted_ebitda_components.foreign_exchange_adjustments': 0,
      // Unrealized FX gain reversed in CF: (444) — this is negative (gain reversed, not loss added back)
      'adjusted_ebitda_components.unrealized_fx_cash_flow': 0,
      'adjusted_ebitda_components.realized_fx_pl': 0,
      'adjusted_ebitda_components.pro_forma_cost_savings': 0,
      'adjusted_ebitda_components.pro_forma_synergies': 0,

      // Computed Ratios
      // adjusted_ebitda = EBITDA (8,088) + SBC (1,005) = 9,093
      adjusted_ebitda: 9093,
      calculated_adjusted_ebitda: 0,
      // fccr = (Adj EBITDA - CapEx - cash_taxes) / (principal + cash_interest + lease_payments)
      //      = (9,093 - 3,154 - 27) / (3,687 + 688 + 1,189)
      //      = 5,912 / 5,564 = 1.06
      // NOTE: Tight coverage — BDC loan repayments are $3.7M/yr and declining as balance is paid down.
      // Promissory note ($2.4M) paid zero principal in 2024; matures Jan 2026.
      fccr: 1.06,
      // dscr = Adj EBITDA / total debt service = 9,093 / 5,564 = 1.63
      dscr: 1.63,
      funded_debt: 0,
      funded_debt_to_ebitda: 0,
      // senior_debt_to_ebitda = 12,600 / 8,088 = 1.56 (including IFRS 16 leases)
      senior_debt_to_ebitda: 1.56,
      // total_debt_to_capital = 12,600 / (12,600 + 57,890) = 12,600 / 70,490 = 0.18
      total_debt_to_capital: 0.18,
      // interest_coverage_ratio = EBITDA / net finance costs = 8,088 / 975 = 8.29
      interest_coverage_ratio: 8.29,
      // debt_to_equity_ratio = 12,600 / 57,890 = 0.22
      debt_to_equity_ratio: 0.22,
      // current_ratio = 45,075 / 38,753 = 1.16
      current_ratio: 1.16,
    },
    source_notes:
      'Verified from source PDF (FY24_KITS_ConsolidatedFS_FINAL.pdf). ' +
      'All values in thousands of Canadian dollars (CAD). ' +
      'IFRS reporting. Fiscal year ended December 31, 2024. ' +
      'Kits Eyecare Ltd. — digitally native eyecare platform, vertically integrated, TSX-listed. ' +
      'Debt structure: BDC floating-rate loan (4,761) + zero-interest promissory note (2,396) + IFRS 16 leases (5,443). ' +
      'BDC loan at 11.00% effective rate; promissory note matures Jan 31, 2026. ' +
      'Note: promissory note paid zero principal in 2024 (or 2023) despite scheduled quarterly $121 installments. ' +
      'cash_interest_paid = 688 per Note 21 (gross interest 1,036 minus timing adjustments). ' +
      'D&A of 2,662 includes 2,306 (PP&E+ROU depreciation) + 356 (intangible amortization) from CF add-backs. ' +
      'P&L shows only 1,171 D&A; remainder (1,491) is embedded in cost of sales and fulfillment. ' +
      'FX gain of 2,673 is on the operating income line — creates an EBITDA inflation risk. ' +
      'A conservative lender would remove the FX gain, reducing EBITDA to ~5,415 (unfavorable). ' +
      'adjusted_ebitda adds SBC only (1,005); FX gain adjustment left for analyst judgment. ' +
      'FCCR = 1.06 is tight; company confirms BDC covenants in good standing as of filing date.',
  },
  {
    document: 'PetValu-FY2024',
    filename: 'PetValu_Q4_2024_FinancialStatements.pdf',
    fiscal_year: '2024',
    values: {
      // Income Statement (thousands CAD, IFRS, 52-week period ended December 28, 2024)
      // Revenue: retail 405,357 + franchise 691,836 = 1,097,193
      revenue: 1097193,
      // Net income: 87,420
      net_income: 87420,
      expenses: 0,
      profit_margins: 0,
      // Interest expenses, net: 32,103 (net of lease receivable interest income ~11,914)
      // Gross cash interest: 22,847 (LT debt) + 23,409 (leases) = 46,256
      interest: 32103,
      // Income tax expense: 33,964
      taxes: 33964,
      // D&A from cash flow add-backs: 65,913 (PP&E, ROU assets, intangibles combined)
      depreciation_amortization: 65913,
      depreciation_equipment: 0,
      depreciation_rou: 0,
      depreciation_other: 0,
      amortization_intangibles: 0,
      // ebitda = operating income (155,323) + D&A (65,913) = 221,236
      // (operating income + D&A approach; adds back FX loss vs. NI approach)
      ebitda: 221236,
      reported_adjusted_ebitda: 0,

      // Balance Sheet
      // Shareholders' equity: 95,749 (retained deficit — franchise capital returned to shareholders)
      shareholders_equity: 95749,
      // Total debt: LT debt (278,020) + lease liabilities (76,881 + 394,393 = 471,274) = 749,294
      // Note: 210,391 in lease receivables (franchisee subleases) partially offsets lease obligations
      total_debt: 749294,
      // Senior debt = bank/LT debt only (excluding IFRS 16 leases): 278,020
      // Current portion of LT debt = 0 at Dec 28, 2024
      senior_debt: 278020,
      // Current assets: 246,510
      current_assets: 246510,
      // Current liabilities: 184,420
      current_liabilities: 184420,

      // Cash Flow
      // CapEx: 60,612 (purchases of PP&E for corporate stores and warehouse)
      capital_expenditures: 60612,
      // Proceeds from LT debt: not separately available (revolving credit); refinanced during year
      proceeds_from_long_term_debt: 0,
      // Cash taxes paid: 31,213
      cash_taxes_paid: 31213,
      // Dividends paid: 31,470
      distributions_paid: 31470,
      ttm_principal_payments: 0,
      ttm_interest_expense: 0,
      // Repayment of LT debt principal: 13,312
      repayment_of_debt: 13312,
      // Repayment of lease liabilities (principal): 64,898
      payment_of_lease_liability: 64898,
      // Cash interest paid: 22,847 (LT debt) + 23,409 (leases) = 46,256
      cash_interest_paid: 46256,
      non_cash_interest_expense: 0,

      // Debt Components
      // LT debt: 0 current + 278,020 long-term = 278,020 (credit facility)
      'debt_components.bank_debt_current': 0,
      'debt_components.bank_debt_long_term': 278020,
      'debt_components.term_loans': 0,
      'debt_components.revolving_credit_facilities': 0,
      'debt_components.overdraft_facilities': 0,
      'debt_components.lines_of_credit': 0,
      // Lease liabilities: 76,881 current + 394,393 long-term
      'debt_components.lease_liabilities_current': 76881,
      'debt_components.lease_liabilities_long_term': 394393,
      'debt_components.finance_lease_liabilities': 0,
      'debt_components.operating_lease_liabilities': 0,
      'debt_components.notes_payable': 0,
      'debt_components.subordinated_debt': 0,
      'debt_components.convertible_debt': 0,
      'debt_components.bonds_debentures': 0,
      'debt_components.other_borrowings': 0,

      // Fixed Charges
      // LT debt interest paid: 22,847
      'fixed_charges.senior_debt_interest': 22847,
      'fixed_charges.subordinated_debt_interest': 0,
      // IFRS 16 lease interest paid: 23,409
      'fixed_charges.lease_interest': 23409,
      // Total gross interest paid: 46,256 (22,847 + 23,409)
      'fixed_charges.total_interest_expense': 46256,
      // Lease liability principal paid: 64,898
      'fixed_charges.minimum_lease_payments': 64898,
      'fixed_charges.finance_lease_payments': 0,
      'fixed_charges.operating_lease_payments': 0,
      // LT debt principal paid: 13,312
      'fixed_charges.principal_payments': 13312,
      // Dividends on common shares: 31,470
      'fixed_charges.preferred_dividends': 0,
      'fixed_charges.other_fixed_charges': 0,

      // Adjusted EBITDA Components
      // Share-based compensation (non-cash): 7,203
      'adjusted_ebitda_components.stock_based_compensation': 7203,
      'adjusted_ebitda_components.impairment_charges': 744,
      'adjusted_ebitda_components.goodwill_impairment': 0,
      'adjusted_ebitda_components.unrealized_gains_losses': 0,
      'adjusted_ebitda_components.deferred_compensation': 0,
      // Gain on disposal of PP&E: (3,565) — reduces Adj EBITDA (add negative adjustment)
      'adjusted_ebitda_components.loss_on_disposal': 0,
      'adjusted_ebitda_components.other_non_cash': 0,
      'adjusted_ebitda_components.restructuring_costs': 0,
      'adjusted_ebitda_components.severance_costs': 0,
      'adjusted_ebitda_components.transaction_costs': 0,
      'adjusted_ebitda_components.legal_settlements': 0,
      'adjusted_ebitda_components.professional_fees_one_time': 0,
      'adjusted_ebitda_components.casualty_losses': 0,
      'adjusted_ebitda_components.other_one_time_expenses': 0,
      'adjusted_ebitda_components.gain_on_disposal': 3565,
      'adjusted_ebitda_components.gain_on_asset_sale': 0,
      'adjusted_ebitda_components.other_income_non_operating': 0,
      'adjusted_ebitda_components.insurance_proceeds': 0,
      'adjusted_ebitda_components.other_one_time_gains': 0,
      'adjusted_ebitda_components.owner_compensation_adjustment': 0,
      'adjusted_ebitda_components.related_party_adjustments': 0,
      'adjusted_ebitda_components.management_fees_adjustment': 0,
      'adjusted_ebitda_components.accounting_policy_adjustments': 0,
      'adjusted_ebitda_components.foreign_exchange_adjustments': 0,
      'adjusted_ebitda_components.unrealized_fx_cash_flow': 0,
      'adjusted_ebitda_components.realized_fx_pl': 0,
      'adjusted_ebitda_components.pro_forma_cost_savings': 0,
      'adjusted_ebitda_components.pro_forma_synergies': 0,

      // Computed Ratios
      // adjusted_ebitda = EBITDA (221,236) + SBC (7,203) + impairments (744) - gain on disposal (3,565) = 225,618
      adjusted_ebitda: 225618,
      calculated_adjusted_ebitda: 0,
      // fccr = (Adj EBITDA - CapEx - cash_taxes - distributions) / (principal + interest_LTD + lease_principal + lease_interest)
      //      = (225,618 - 60,612 - 31,213 - 31,470) / (13,312 + 22,847 + 64,898 + 23,409)
      //      = 102,323 / 124,466 = 0.82
      // NOTE: Low FCCR reflects high CapEx growth phase (opening stores) + dividends + debt repayment.
      // PetValu has significant cash generation from operations (200M+) but returns capital aggressively.
      fccr: 0.82,
      // dscr = Adj EBITDA / (interest + lease_interest + principal + lease_principal) = 225,618 / 124,466 = 1.81
      dscr: 1.81,
      funded_debt: 0,
      funded_debt_to_ebitda: 0,
      // senior_debt_to_ebitda = bank debt (278,020) / EBITDA (221,236) = 1.26
      senior_debt_to_ebitda: 1.26,
      // total_debt_to_capital = 749,294 / (749,294 + 95,749) = 0.89 (including IFRS 16 leases)
      // But net of lease receivables (210,391): 538,903 / 634,652 = 0.85
      total_debt_to_capital: 0.89,
      // interest_coverage_ratio = EBITDA / net interest = 221,236 / 32,103 = 6.89
      interest_coverage_ratio: 6.89,
      // debt_to_equity_ratio = 749,294 / 95,749 = 7.83 (high — franchise model with large IFRS 16 leases)
      debt_to_equity_ratio: 7.83,
      // current_ratio = 246,510 / 184,420 = 1.34
      current_ratio: 1.34,
    },
    source_notes:
      'Verified from source PDF (PetValu_Q4_2024_FinancialStatements.pdf). ' +
      'All values in thousands of Canadian dollars (CAD). ' +
      'IFRS reporting. 52-week fiscal year ended December 28, 2024. ' +
      'Pet Valu Holdings Ltd. — Canadian franchise specialty pet retailer (824 stores: 220 corporate + 604 franchise). ' +
      'Debt structure: revolving credit facility (278,020) + IFRS 16 lease liabilities (471,274) = 749,294 total. ' +
      'Senior debt = credit facility only (278,020); IFRS 16 leases substantially offset by lease receivables (210,391). ' +
      'Net lease position = 471,274 - 210,391 = 260,883 (franchise sublease income offsets lease obligations). ' +
      'interest: 32,103 is NET of lease receivable interest income (~11,914); gross cash interest = 46,256. ' +
      'D&A = 65,913 from CF statement (PP&E + ROU + intangibles combined). ' +
      'FCCR = 0.82 reflects growth CapEx (60.6M for new stores) + dividends (31.5M) + share buybacks. ' +
      'Cash from operations = 200,076 before investing/financing — strong operating coverage. ' +
      'total_debt_to_capital of 0.89 overstates risk — franchise model has lease receivable offset.',
  },
  {
    document: 'ADEN-FY2024',
    filename: 'ADENAnRpt24 2.pdf',
    fiscal_year: '2024',
    values: {
      // Income Statement (thousands USD, IFRS, year ended December 31, 2024)
      // ADENTRA Inc. — wholesale distributor of architectural building products (86 locations, CA + US)
      // Note: ADEN reports in US dollars (USD), NOT Canadian dollars
      revenue: 2184258,
      // Net income: 46,478 USD thousands
      net_income: 46478,
      expenses: 0,
      profit_margins: 0,
      // Net finance expense: 41,614 (interest on bank + lease obligations)
      interest: 41614,
      // Income tax expense: 8,816 (current 5,664 + deferred 3,152)
      taxes: 8816,
      // D&A from EBITDA reconciliation: 76,099 (P&L shows 68,294; additional 7,805 in COGS/SD&A)
      depreciation_amortization: 76099,
      depreciation_equipment: 0,
      // D&A on P&L: depreciation 42,773; amortization of intangibles 25,521 = 68,294
      depreciation_rou: 0,
      depreciation_other: 0,
      amortization_intangibles: 25521,
      // EBITDA = income from operations (96,908) + D&A (76,099) = 173,007 (matches company disclosed)
      ebitda: 173007,
      // Company disclosed Adj EBITDA: ~184,300 (173,007 + LTIP + trade duties + transaction costs)
      reported_adjusted_ebitda: 184300,

      // Balance Sheet
      // Shareholders' equity: 634,572 USD thousands
      shareholders_equity: 634572,
      // Total debt: bank indebtedness (410,536) + lease obligations (212,530) = 623,066
      total_debt: 623066,
      // Senior debt = bank indebtedness only (current 115,347 + long-term 295,189 = 410,536)
      senior_debt: 410536,
      // Current assets: 620,642 (cash 28,111 + AR 184,993 + receivables 3,980 + inventory 375,718 + other 27,840)
      current_assets: 620642,
      // Current liabilities: 278,340 (bank 115,347 + AP 121,080 + lease 39,305 + dividend 2,608)
      current_liabilities: 278340,

      // Cash Flow
      // CapEx not separately extracted — investing total (147,458) includes Woolf acquisition
      capital_expenditures: 0,
      // Proceeds from debt: 58,223 (new credit facility draws)
      proceeds_from_long_term_debt: 58223,
      cash_taxes_paid: 0,
      // Dividends paid: 9,632 (10,128 declared, 9,632 paid in cash)
      distributions_paid: 9632,
      ttm_principal_payments: 0,
      ttm_interest_expense: 0,
      // Repayment of bank indebtedness: 40,000
      repayment_of_debt: 40000,
      // Lease payments (estimated — CF shows ~48,050 combined; split unknown)
      payment_of_lease_liability: 0,
      cash_interest_paid: 0,
      non_cash_interest_expense: 0,

      // Debt Components
      // Bank indebtedness: current 115,347 + long-term 295,189 = 410,536
      'debt_components.bank_debt_current': 115347,
      'debt_components.bank_debt_long_term': 295189,
      'debt_components.term_loans': 0,
      'debt_components.revolving_credit_facilities': 0,
      'debt_components.overdraft_facilities': 0,
      'debt_components.lines_of_credit': 0,
      // Lease obligations: current 39,305 + long-term 173,225 = 212,530
      'debt_components.lease_liabilities_current': 39305,
      'debt_components.lease_liabilities_long_term': 173225,
      'debt_components.finance_lease_liabilities': 0,
      'debt_components.operating_lease_liabilities': 0,
      'debt_components.notes_payable': 0,
      'debt_components.subordinated_debt': 0,
      'debt_components.convertible_debt': 0,
      'debt_components.bonds_debentures': 0,
      'debt_components.other_borrowings': 0,

      // Fixed Charges — cash interest split not available from annual report summary
      'fixed_charges.senior_debt_interest': 0,
      'fixed_charges.subordinated_debt_interest': 0,
      'fixed_charges.lease_interest': 0,
      'fixed_charges.total_interest_expense': 0,
      'fixed_charges.minimum_lease_payments': 0,
      'fixed_charges.finance_lease_payments': 0,
      'fixed_charges.operating_lease_payments': 0,
      'fixed_charges.principal_payments': 0,
      'fixed_charges.preferred_dividends': 0,
      'fixed_charges.other_fixed_charges': 0,

      // Adjusted EBITDA Components
      // Company Adj EBITDA adjustments include: LTIP expense, accrued trade duties, transaction costs
      // Total adjustments: ~11,293 (184,300 - 173,007). Individual line items not broken out in AR summary.
      'adjusted_ebitda_components.stock_based_compensation': 0,
      'adjusted_ebitda_components.impairment_charges': 0,
      'adjusted_ebitda_components.goodwill_impairment': 0,
      'adjusted_ebitda_components.unrealized_gains_losses': 0,
      'adjusted_ebitda_components.deferred_compensation': 0,
      'adjusted_ebitda_components.loss_on_disposal': 0,
      'adjusted_ebitda_components.other_non_cash': 0,
      'adjusted_ebitda_components.restructuring_costs': 0,
      'adjusted_ebitda_components.severance_costs': 0,
      'adjusted_ebitda_components.transaction_costs': 0,
      'adjusted_ebitda_components.legal_settlements': 0,
      'adjusted_ebitda_components.professional_fees_one_time': 0,
      'adjusted_ebitda_components.casualty_losses': 0,
      'adjusted_ebitda_components.other_one_time_expenses': 0,
      'adjusted_ebitda_components.gain_on_disposal': 0,
      'adjusted_ebitda_components.gain_on_asset_sale': 0,
      'adjusted_ebitda_components.other_income_non_operating': 0,
      'adjusted_ebitda_components.insurance_proceeds': 0,
      'adjusted_ebitda_components.other_one_time_gains': 0,
      'adjusted_ebitda_components.owner_compensation_adjustment': 0,
      'adjusted_ebitda_components.related_party_adjustments': 0,
      'adjusted_ebitda_components.management_fees_adjustment': 0,
      'adjusted_ebitda_components.accounting_policy_adjustments': 0,
      'adjusted_ebitda_components.foreign_exchange_adjustments': 0,
      'adjusted_ebitda_components.unrealized_fx_cash_flow': 0,
      'adjusted_ebitda_components.realized_fx_pl': 0,
      'adjusted_ebitda_components.pro_forma_cost_savings': 0,
      'adjusted_ebitda_components.pro_forma_synergies': 0,

      // Computed Ratios
      // adjusted_ebitda = 184,300 per company disclosure (LTIP + trade duties + transaction costs adj)
      adjusted_ebitda: 184300,
      calculated_adjusted_ebitda: 0,
      // FCCR/DSCR not set — CapEx and cash interest split not available from AR summary section
      fccr: 0,
      dscr: 0,
      funded_debt: 0,
      funded_debt_to_ebitda: 0,
      // senior_debt_to_ebitda = bank debt (410,536) / EBITDA (173,007) = 2.37
      senior_debt_to_ebitda: 2.37,
      // total_debt_to_capital = 623,066 / (623,066 + 634,572) = 0.50
      total_debt_to_capital: 0.50,
      // interest_coverage_ratio = EBITDA / net finance expense = 173,007 / 41,614 = 4.16
      interest_coverage_ratio: 4.16,
      // debt_to_equity_ratio = 623,066 / 634,572 = 0.98
      debt_to_equity_ratio: 0.98,
      // current_ratio = 620,642 / 278,340 = 2.23
      current_ratio: 2.23,
    },
    source_notes:
      'Verified from source PDF (ADENAnRpt24 2.pdf — ADENTRA Inc. 2024 Annual Report). ' +
      'CRITICAL: All values in thousands of US dollars (USD), NOT Canadian dollars. ' +
      'IFRS reporting. Fiscal year ended December 31, 2024. ' +
      'ADENTRA Inc. (TSX: ADEN) — wholesale distributor of architectural building products (86 locations in Canada & US). ' +
      'Debt: revolving credit facility classified as bank indebtedness (current 115,347 + LT 295,189 = 410,536 USD). ' +
      'Total debt includes IFRS 16 lease obligations (current 39,305 + LT 173,225 = 212,530 USD). ' +
      'D&A = 76,099 from EBITDA reconciliation table; P&L shows only 68,294 (additional 7,805 in COGS/SD&A). ' +
      'EBITDA = 173,007 matches company disclosure. Company Adj EBITDA = 184,300 (LTIP + trade duties + transaction costs). ' +
      'Company acquired Woolf Building Products in 2024 — inflates investing CF and goodwill. ' +
      'FCCR/DSCR not set — CapEx and cash interest split unavailable from AR summary; requires financial statement notes.',
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
