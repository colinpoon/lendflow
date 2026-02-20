'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

interface DebtComponents {
  bank_debt_current: number | null;
  bank_debt_long_term: number | null;
  term_loans: number | null;
  revolving_credit_facilities: number | null;
  overdraft_facilities: number | null;
  lines_of_credit: number | null;
  lease_liabilities_current: number | null;
  lease_liabilities_long_term: number | null;
  finance_lease_liabilities: number | null;
  operating_lease_liabilities: number | null;
  notes_payable: number | null;
  subordinated_debt: number | null;
  convertible_debt: number | null;
  bonds_debentures: number | null;
  other_borrowings: number | null;
}

interface FixedCharges {
  senior_debt_interest: number | null;
  subordinated_debt_interest: number | null;
  lease_interest: number | null;
  total_interest_expense: number | null;
  senior_debt_interest_rate: string | null;
  minimum_lease_payments: number | null;
  finance_lease_payments: number | null;
  operating_lease_payments: number | null;
  principal_payments: number | null;
  preferred_dividends: number | null;
  other_fixed_charges: number | null;
}

interface AdjustedEBITDAComponents {
  stock_based_compensation: number | null;
  impairment_charges: number | null;
  goodwill_impairment: number | null;
  unrealized_gains_losses: number | null;
  deferred_compensation: number | null;
  loss_on_disposal: number | null;
  other_non_cash: number | null;
  restructuring_costs: number | null;
  severance_costs: number | null;
  transaction_costs: number | null;
  legal_settlements: number | null;
  professional_fees_one_time: number | null;
  casualty_losses: number | null;
  other_one_time_expenses: number | null;
  gain_on_disposal: number | null;
  gain_on_asset_sale: number | null;
  other_income_non_operating: number | null;
  insurance_proceeds: number | null;
  other_one_time_gains: number | null;
  owner_compensation_adjustment: number | null;
  related_party_adjustments: number | null;
  management_fees_adjustment: number | null;
  accounting_policy_adjustments: number | null;
  foreign_exchange_adjustments: number | null;
  pro_forma_cost_savings: number | null;
  pro_forma_synergies: number | null;
}

interface FCCRBreakdown {
  adjusted_ebitda: number;
  unfunded_capex: number;
  capex_deduction: number;
  cash_taxes_paid: number;
  distributions_paid: number;
  ttm_principal_payments: number;
  ttm_interest_expense: number;
  lease_payments: number;
  numerator: number;
  denominator: number;
}

interface DSCRBreakdown {
  bank_principal_payments: number;
  bank_interest_expense: number;
  lease_payments: number;
  total_debt_service: number;
  funded_debt: number;
  funded_debt_to_ebitda: number;
}

interface YearMetrics {
  // Income Statement
  revenue: number | null;
  net_income: number | null;
  expenses: number | null;
  profit_margins: number | null;
  interest: number | null;
  taxes: number | null;
  depreciation_amortization: number | null;
  // Depreciation Breakdown
  depreciation_equipment: number | null;
  depreciation_rou: number | null;
  depreciation_other: number | null;
  amortization_intangibles: number | null;
  // EBITDA
  ebitda: number | null;
  ebitda_calculated?: boolean;
  adjusted_ebitda: number | null;
  reported_adjusted_ebitda: number | null;
  calculated_adjusted_ebitda: number | null;
  // Balance Sheet
  total_debt: number | null;
  senior_debt: number | null;
  shareholders_equity: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  // Cash Flow
  capital_expenditures: number | null;
  proceeds_from_long_term_debt: number | null;
  cash_taxes_paid: number | null;
  distributions_paid: number | null;
  repayment_of_debt: number | null;
  payment_of_lease_liability: number | null;
  cash_interest_paid: number | null;
  non_cash_interest_expense: number | null;
  ttm_principal_payments: number | null;
  ttm_interest_expense: number | null;
  // Nested Components
  debt_components: DebtComponents | null;
  fixed_charges: FixedCharges | null;
  adjusted_ebitda_components: AdjustedEBITDAComponents | null;
  // CFADS
  cash_flow_for_debt_servicing: number | null;
  // Breakdowns
  fccr_breakdown: FCCRBreakdown | null;
  dscr_breakdown: DSCRBreakdown | null;
  // Key Ratios
  fccr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  dscr: number | null;
  funded_debt: number | null;
  funded_debt_to_ebitda: number | null;
  interest_coverage_ratio: number | null;
  debt_to_equity_ratio: number | null;
  current_ratio: number | null;
}

interface FinancialTableProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Row Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface RowConfig {
  key: string;
  label: string;
  format?: 'currency' | 'ratio' | 'percent' | 'margin' | 'rate' | 'string';
  highlight?: boolean;
  indent?: boolean;
  nested?: string; // path to nested object (e.g., 'debt_components', 'fixed_charges')
}

interface SectionConfig {
  title: string;
  rows: RowConfig[];
  collapsible?: boolean;
}

// Sections ordered for credit analyst workflow:
// 1. Key Ratios (the "punchline" — can this company pay us back?)
// 2. EBITDA (earnings power backing the ratios)
// 3. Adjusted EBITDA Components (bridge between EBITDA and Adj. EBITDA)
// 4. Income Statement (revenue quality and trend verification)
// 5. Depreciation Breakdown
// 6. Cash Flow (building blocks behind CFADS)
// 7. Fixed Charges
// 8. Balance Sheet (reference — confirms leverage levels)
// 9-11. Debt Components (detail drilldowns)
const sections: SectionConfig[] = [
  {
    title: 'Key Ratios',
    rows: [
      { key: 'dscr', label: 'DSCR', format: 'ratio', highlight: true },
      { key: 'fccr', label: 'FCCR', format: 'ratio', highlight: true },
      { key: 'senior_debt_to_ebitda', label: 'Senior Debt / Adj. EBITDA', format: 'ratio', highlight: true },
      { key: 'funded_debt_to_ebitda', label: 'Funded Debt / EBITDA', format: 'ratio', highlight: true },
      { key: 'total_debt_to_capital', label: 'Total Debt / Capital', format: 'percent', highlight: true },
      { key: 'interest_coverage_ratio', label: 'Interest Coverage Ratio', format: 'ratio', highlight: true },
      { key: 'current_ratio', label: 'Current Ratio', format: 'ratio', highlight: true },
      { key: 'debt_to_equity_ratio', label: 'Debt to Equity Ratio', format: 'ratio' },
    ],
  },
  {
    title: 'EBITDA',
    rows: [
      { key: 'ebitda', label: 'EBITDA', highlight: true },
      { key: 'adjusted_ebitda', label: 'Adjusted EBITDA', highlight: true },
      { key: 'cash_flow_for_debt_servicing', label: 'CFADS', highlight: true },
    ],
  },
  {
    title: 'Adjusted EBITDA Components',
    collapsible: true,
    rows: [
      { key: 'stock_based_compensation', label: 'Stock-Based Compensation', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'impairment_charges', label: 'Impairment Charges', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'goodwill_impairment', label: 'Goodwill Impairment', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'unrealized_gains_losses', label: 'Unrealized Gains/Losses', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'deferred_compensation', label: 'Deferred Compensation', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'loss_on_disposal', label: 'Loss on Disposal', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'gain_on_disposal', label: 'Gain on Disposal', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'other_non_cash', label: 'Other Non-Cash', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'restructuring_costs', label: 'Restructuring Costs', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'severance_costs', label: 'Severance Costs', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'transaction_costs', label: 'Transaction Costs', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'legal_settlements', label: 'Legal Settlements', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'other_income_non_operating', label: 'Other Income (Non-Operating)', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'foreign_exchange_adjustments', label: 'FX Adj. (Deprecated)', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'unrealized_fx_cash_flow', label: 'Unrealized FX (CF)', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'realized_fx_pl', label: 'Realized FX (P&L)', nested: 'adjusted_ebitda_components', indent: true },
      { key: 'owner_compensation_adjustment', label: 'Owner Compensation Adjustment', nested: 'adjusted_ebitda_components', indent: true },
    ],
  },
  {
    title: 'Income Statement',
    rows: [
      { key: 'revenue', label: 'Revenue' },
      { key: 'expenses', label: 'Total Expenses' },
      { key: 'net_income', label: 'Net Income' },
      { key: 'profit_margins', label: 'Profit Margin', format: 'margin' },
      { key: 'interest', label: 'Interest Expense' },
      { key: 'taxes', label: 'Taxes' },
      { key: 'depreciation_amortization', label: 'Depreciation & Amort.' },
    ],
  },
  {
    title: 'Depreciation Breakdown',
    collapsible: true,
    rows: [
      { key: 'depreciation_equipment', label: 'Depreciation of Property & Equipment', indent: true },
      { key: 'depreciation_rou', label: 'ROU Asset Depreciation (IFRS 16)', indent: true },
      { key: 'depreciation_other', label: 'Other Depreciation', indent: true },
      { key: 'amortization_intangibles', label: 'Amortization of Intangibles', indent: true },
      { key: 'depreciation_amortization', label: '= Total D&A', highlight: true },
    ],
  },
  {
    title: 'Cash Flow',
    rows: [
      { key: 'capital_expenditures', label: 'Capital Expenditures (CapEx)' },
      { key: 'cash_interest_paid', label: 'Cash Interest Paid' },
      { key: 'non_cash_interest_expense', label: 'Non-Cash Interest Expense' },
      { key: 'cash_taxes_paid', label: 'Cash Taxes Paid' },
      { key: 'distributions_paid', label: 'Distributions Paid' },
      { key: 'repayment_of_debt', label: 'Repayment of Debt' },
      { key: 'payment_of_lease_liability', label: 'Payment of Lease Liability' },
      { key: 'proceeds_from_long_term_debt', label: 'Proceeds from LT Debt' },
    ],
  },
  {
    title: 'Fixed Charges',
    collapsible: true,
    rows: [
      { key: 'senior_debt_interest', label: 'Senior Debt Interest', nested: 'fixed_charges', indent: true },
      { key: 'subordinated_debt_interest', label: 'Subordinated Debt Interest', nested: 'fixed_charges', indent: true },
      { key: 'lease_interest', label: 'Lease Interest', nested: 'fixed_charges', indent: true },
      { key: 'total_interest_expense', label: 'Total Interest Expense', nested: 'fixed_charges', indent: true },
      { key: 'senior_debt_interest_rate', label: 'Senior Debt Interest Rate', nested: 'fixed_charges', format: 'string', indent: true },
      { key: 'minimum_lease_payments', label: 'Minimum Lease Payments', nested: 'fixed_charges', indent: true },
      { key: 'finance_lease_payments', label: 'Finance Lease Payments', nested: 'fixed_charges', indent: true },
      { key: 'operating_lease_payments', label: 'Operating Lease Payments', nested: 'fixed_charges', indent: true },
      { key: 'principal_payments', label: 'Principal Payments', nested: 'fixed_charges', indent: true },
      { key: 'preferred_dividends', label: 'Preferred Dividends', nested: 'fixed_charges', indent: true },
      { key: 'other_fixed_charges', label: 'Other Fixed Charges', nested: 'fixed_charges', indent: true },
    ],
  },
  {
    title: 'Balance Sheet',
    rows: [
      { key: 'total_debt', label: 'Total Debt', highlight: true },
      { key: 'senior_debt', label: 'Senior Debt', highlight: true },
      { key: 'shareholders_equity', label: "Shareholders' Equity" },
      { key: 'current_assets', label: 'Current Assets' },
      { key: 'current_liabilities', label: 'Current Liabilities' },
    ],
  },
  {
    title: 'Debt Components - Senior',
    collapsible: true,
    rows: [
      { key: 'bank_debt_current', label: 'Bank Debt (Current)', nested: 'debt_components', indent: true },
      { key: 'bank_debt_long_term', label: 'Bank Debt (Long-Term)', nested: 'debt_components', indent: true },
      { key: 'term_loans', label: 'Term Loans', nested: 'debt_components', indent: true },
      { key: 'revolving_credit_facilities', label: 'Revolving Credit Facilities', nested: 'debt_components', indent: true },
      { key: 'overdraft_facilities', label: 'Overdraft Facilities', nested: 'debt_components', indent: true },
      { key: 'lines_of_credit', label: 'Lines of Credit', nested: 'debt_components', indent: true },
    ],
  },
  {
    title: 'Debt Components - Leases',
    collapsible: true,
    rows: [
      { key: 'lease_liabilities_current', label: 'Lease Liabilities (Current)', nested: 'debt_components', indent: true },
      { key: 'lease_liabilities_long_term', label: 'Lease Liabilities (Long-Term)', nested: 'debt_components', indent: true },
      { key: 'finance_lease_liabilities', label: 'Finance Lease Liabilities', nested: 'debt_components', indent: true },
      { key: 'operating_lease_liabilities', label: 'Operating Lease Liabilities', nested: 'debt_components', indent: true },
    ],
  },
  {
    title: 'Debt Components - Subordinated',
    collapsible: true,
    rows: [
      { key: 'notes_payable', label: 'Notes Payable', nested: 'debt_components', indent: true },
      { key: 'subordinated_debt', label: 'Subordinated Debt', nested: 'debt_components', indent: true },
      { key: 'convertible_debt', label: 'Convertible Debt', nested: 'debt_components', indent: true },
      { key: 'bonds_debentures', label: 'Bonds / Debentures', nested: 'debt_components', indent: true },
      { key: 'other_borrowings', label: 'Other Borrowings', nested: 'debt_components', indent: true },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

const getMetricValue = (
  metrics: YearMetrics,
  key: string,
  nested?: string
): number | null => {
  if (nested) {
    const nestedObj = metrics[nested as keyof YearMetrics];
    if (!nestedObj || typeof nestedObj !== 'object') return null;
    const value = (nestedObj as unknown as Record<string, unknown>)[key];
    if (value === null || value === undefined) return null;
    return typeof value === 'number' ? value : null;
  }

  const value = metrics[key as keyof YearMetrics];
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return parseFloat(value) || null;
  return typeof value === 'number' ? value : null;
};

const formatValue = (
  value: number | null,
  format: RowConfig['format'] = 'currency'
): string => {
  if (value === null || value === undefined) return '—';

  switch (format) {
    case 'ratio':
      return `${value.toFixed(2)}x`;
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'margin':
      if (value <= 1 && value >= -1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return `${value.toFixed(1)}%`;
    case 'rate':
      return `${(value * 100).toFixed(2)}%`;
    case 'currency':
    default:
      return fmtCurrency(value);
  }
};

const getRatioColor = (key: string, value: number | null): string => {
  if (value === null) return '';

  switch (key) {
    case 'fccr':
    case 'dscr':
      if (value >= 2.0) return 'text-green-600 font-semibold';
      if (value >= 1.5) return 'text-lime-600 font-semibold';
      if (value >= 1.2) return 'text-yellow-600 font-semibold';
      if (value >= 1.0) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    case 'senior_debt_to_ebitda':
    case 'funded_debt_to_ebitda':
      if (value <= 1.5) return 'text-green-600 font-semibold';
      if (value <= 2.5) return 'text-lime-600 font-semibold';
      if (value <= 3.0) return 'text-yellow-600 font-semibold';
      if (value <= 4.0) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    case 'total_debt_to_capital':
      if (value < 0.3) return 'text-green-600 font-semibold';
      if (value <= 0.5) return 'text-lime-600 font-semibold';
      if (value <= 0.6) return 'text-yellow-600 font-semibold';
      if (value <= 0.7) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    case 'interest_coverage_ratio':
      if (value >= 5.0) return 'text-green-600 font-semibold';
      if (value >= 3.0) return 'text-lime-600 font-semibold';
      if (value >= 2.0) return 'text-yellow-600 font-semibold';
      if (value >= 1.5) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    case 'current_ratio':
      if (value >= 2.0) return 'text-green-600 font-semibold';
      if (value >= 1.5) return 'text-lime-600 font-semibold';
      if (value >= 1.2) return 'text-yellow-600 font-semibold';
      if (value >= 1.0) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    default:
      return '';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const FinancialTable: React.FC<FinancialTableProps> = ({ data }) => {
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(
    new Set(['Depreciation Breakdown', 'Debt Components - Senior', 'Debt Components - Leases',
             'Debt Components - Subordinated', 'Fixed Charges', 'Adjusted EBITDA Components',
             'CFADS Components', 'FCCR Components'])
  );

  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-gray-500">No financial data available.</p>
    );
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse();

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  // Helper to get FCCR breakdown values
  const getFccrBreakdownValue = (year: string, key: string): number | null => {
    const breakdown = data.metrics_by_year[year]?.fccr_breakdown;
    if (!breakdown) return null;
    const value = (breakdown as unknown as Record<string, number>)[key];
    return typeof value === 'number' ? value : null;
  };

  // Check if any year has FCCR breakdown data
  const hasFccrBreakdown = years.some((y) => data.metrics_by_year[y]?.fccr_breakdown != null);

  // Check if section has any data
  const sectionHasData = (section: SectionConfig): boolean => {
    return section.rows.some(row =>
      years.some(y => {
        if (row.format === 'string') {
          const metrics = data.metrics_by_year[y];
          const nestedObj = row.nested ? metrics[row.nested as keyof typeof metrics] : null;
          const rawVal = nestedObj && typeof nestedObj === 'object'
            ? (nestedObj as unknown as Record<string, unknown>)[row.key]
            : metrics[row.key as keyof typeof metrics];
          return typeof rawVal === 'string';
        }
        return getMetricValue(data.metrics_by_year[y], row.key, row.nested) !== null;
      })
    );
  };

  // Render a config-driven section
  const renderSection = (section: SectionConfig) => {
    if (!sectionHasData(section)) return null;

    const isCollapsed = section.collapsible && collapsedSections.has(section.title);

    return (
      <React.Fragment key={section.title}>
        <tr
          className={`bg-gray-50 ${section.collapsible ? 'cursor-pointer hover:bg-gray-100' : ''}`}
          onClick={() => section.collapsible && toggleSection(section.title)}
        >
          <td
            colSpan={years.length + 1}
            className="py-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide border-t border-gray-200"
          >
            <div className="flex items-center gap-2">
              {section.collapsible && (
                <span className="text-gray-400">
                  {isCollapsed ? '▶' : '▼'}
                </span>
              )}
              {section.title}
            </div>
          </td>
        </tr>
        {!isCollapsed && section.rows.map((row) => {
          const hasValue = years.some(
            (y) => getMetricValue(data.metrics_by_year[y], row.key, row.nested) !== null
          );

          if (!hasValue) return null;

          return (
            <tr
              key={`${section.title}-${row.key}`}
              className={`border-b border-gray-100 hover:bg-gray-50 ${
                row.highlight ? 'bg-blue-50/50' : ''
              }`}
            >
              <td className={`py-2 px-4 ${row.highlight ? 'font-medium' : ''} ${row.indent ? 'pl-8' : ''}`}>
                {row.label}
              </td>
              {years.map((y) => {
                if (row.format === 'string') {
                  const metrics = data.metrics_by_year[y];
                  const nestedObj = row.nested ? metrics[row.nested as keyof typeof metrics] : null;
                  const rawVal = nestedObj && typeof nestedObj === 'object'
                    ? (nestedObj as unknown as Record<string, unknown>)[row.key]
                    : metrics[row.key as keyof typeof metrics];
                  return (
                    <td key={y} className={`py-2 px-4 text-right ${row.indent ? '' : ''}`}>
                      {typeof rawVal === 'string' ? rawVal : '—'}
                    </td>
                  );
                }
                const val = getMetricValue(data.metrics_by_year[y], row.key, row.nested);
                const colorClass = row.format === 'ratio' || row.format === 'percent'
                  ? getRatioColor(row.key, val)
                  : '';
                return (
                  <td
                    key={y}
                    className={`py-2 px-4 text-right ${colorClass} ${
                      row.highlight && !colorClass ? 'font-medium' : ''
                    }`}
                  >
                    {formatValue(val, row.format)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </React.Fragment>
    );
  };

  // Render FCCR Components (collapsible, injected after Key Ratios)
  const renderFccrComponents = () => {
    if (!hasFccrBreakdown) return null;

    const isCollapsed = collapsedSections.has('FCCR Components');

    return (
      <React.Fragment key="fccr-components">
        <tr
          className="bg-gray-50 cursor-pointer hover:bg-gray-100"
          onClick={() => toggleSection('FCCR Components')}
        >
          <td
            colSpan={years.length + 1}
            className="py-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide border-t border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">
                {isCollapsed ? '▶' : '▼'}
              </span>
              FCCR Components
            </div>
          </td>
        </tr>
        {!isCollapsed && (
          <>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8">FCCR Numerator (Cash Available)</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right">
                  {formatValue(getFccrBreakdownValue(y, 'numerator'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">Less: Unfunded CapEx</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'unfunded_capex'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8">FCCR Denominator (Fixed Charges)</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right">
                  {formatValue(getFccrBreakdownValue(y, 'denominator'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">TTM Principal Payments</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'ttm_principal_payments'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">TTM Interest Expense</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'ttm_interest_expense'), 'currency')}
                </td>
              ))}
            </tr>
            {years.some((y) => getFccrBreakdownValue(y, 'lease_payments') !== null && getFccrBreakdownValue(y, 'lease_payments') !== 0) && (
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-4 pl-8 text-gray-600">Lease Payments</td>
                {years.map((y) => (
                  <td key={y} className="py-2 px-4 text-right text-gray-600">
                    {formatValue(getFccrBreakdownValue(y, 'lease_payments'), 'currency')}
                  </td>
                ))}
              </tr>
            )}
          </>
        )}
      </React.Fragment>
    );
  };

  // Render CFADS Components (collapsible, injected after EBITDA group)
  const renderCfadsComponents = () => {
    if (!hasFccrBreakdown) return null;

    const isCollapsed = collapsedSections.has('CFADS Components');

    return (
      <React.Fragment key="cfads-components">
        <tr
          className="bg-gray-50 cursor-pointer hover:bg-gray-100"
          onClick={() => toggleSection('CFADS Components')}
        >
          <td
            colSpan={years.length + 1}
            className="py-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide border-t border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">
                {isCollapsed ? '▶' : '▼'}
              </span>
              CFADS Components
            </div>
          </td>
        </tr>
        {!isCollapsed && (
          <>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">Adjusted EBITDA</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'adjusted_ebitda'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">Less: Unfunded CapEx</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'unfunded_capex'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">Less: Cash Taxes Paid</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'cash_taxes_paid'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 px-4 pl-8 text-gray-600">Less: Distributions Paid</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right text-gray-600">
                  {formatValue(getFccrBreakdownValue(y, 'distributions_paid'), 'currency')}
                </td>
              ))}
            </tr>
            <tr className="border-b border-gray-100 hover:bg-gray-50 bg-blue-50/50">
              <td className="py-2 px-4 pl-8 font-medium">= CFADS (= FCCR Numerator)</td>
              {years.map((y) => (
                <td key={y} className="py-2 px-4 text-right font-medium">
                  {formatValue(getFccrBreakdownValue(y, 'numerator'), 'currency')}
                </td>
              ))}
            </tr>
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Financial Metrics
        </h2>
        <span className="text-xs text-gray-500">(Values in thousands)</span>
      </div>
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-gray-300">
            <th className="py-3 px-4 text-left font-semibold text-gray-700">Metric</th>
            {years.map((y) => (
              <th key={y} className="py-3 px-4 text-right font-semibold text-gray-700">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => {
            const rendered = renderSection(section);

            // Inject FCCR Components after Key Ratios
            if (section.title === 'Key Ratios') {
              if (!rendered && !hasFccrBreakdown) return null;
              return (
                <React.Fragment key={`group-${section.title}`}>
                  {rendered}
                  {renderFccrComponents()}
                </React.Fragment>
              );
            }

            // Inject CFADS Components after Adjusted EBITDA Components
            if (section.title === 'Adjusted EBITDA Components') {
              if (!rendered && !hasFccrBreakdown) return null;
              return (
                <React.Fragment key={`group-${section.title}`}>
                  {rendered}
                  {renderCfadsComponents()}
                </React.Fragment>
              );
            }

            return rendered;
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialTable;
