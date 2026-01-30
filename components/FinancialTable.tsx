'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';

interface YearMetrics {
  // Income Statement
  revenue: number | null;
  net_income: number | null;
  expenses: number | null;
  profit_margins: number | null;
  interest: number | null;
  taxes: number | null;
  depreciation_amortization: number | null;
  // EBITDA
  ebitda: number | null;
  ebitda_calculated?: boolean;
  adjusted_ebitda: number | null;
  // Balance Sheet
  total_debt: number | null;
  senior_debt: number | null;
  shareholders_equity: number | null;
  // Cash Flow
  capital_expenditures: number | null;
  // Key Ratios
  fccr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
}

interface FinancialTableProps {
  /** Result returned by the backend: { metrics_by_year: { "2024": {...}, "2023": {...} } } */
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

// Row configuration with sections
interface RowConfig {
  key: keyof YearMetrics;
  label: string;
  format?: 'currency' | 'ratio' | 'percent' | 'margin';
  highlight?: boolean;
}

interface SectionConfig {
  title: string;
  rows: RowConfig[];
}

const sections: SectionConfig[] = [
  {
    title: 'Income Statement',
    rows: [
      { key: 'revenue', label: 'Revenue' },
      { key: 'net_income', label: 'Net Income' },
      { key: 'expenses', label: 'Total Expenses' },
      { key: 'profit_margins', label: 'Profit Margin', format: 'margin' },
      { key: 'interest', label: 'Interest Expense' },
      { key: 'taxes', label: 'Taxes' },
      { key: 'depreciation_amortization', label: 'Depreciation & Amort.' },
    ],
  },
  {
    title: 'EBITDA',
    rows: [
      { key: 'ebitda', label: 'EBITDA', highlight: true },
      { key: 'adjusted_ebitda', label: 'Adjusted EBITDA', highlight: true },
    ],
  },
  {
    title: 'Balance Sheet',
    rows: [
      { key: 'senior_debt', label: 'Senior Debt' },
      { key: 'total_debt', label: 'Total Debt' },
      { key: 'shareholders_equity', label: "Shareholders' Equity" },
    ],
  },
  {
    title: 'Cash Flow',
    rows: [
      { key: 'capital_expenditures', label: 'Capital Expenditures (CapEx)' },
    ],
  },
  {
    title: 'Key Ratios',
    rows: [
      { key: 'fccr', label: 'FCCR', format: 'ratio', highlight: true },
      { key: 'senior_debt_to_ebitda', label: 'Senior Debt / Adj. EBITDA', format: 'ratio', highlight: true },
      { key: 'total_debt_to_capital', label: 'Total Debt / Capital', format: 'percent', highlight: true },
    ],
  },
];

const getMetricValue = (metrics: YearMetrics, key: keyof YearMetrics): number | null => {
  const value = metrics[key];
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
      return `${(value * 100).toFixed(0)}%`;
    case 'margin':
      // Profit margin may come as decimal or percentage
      if (value <= 1 && value >= -1) {
        return `${(value * 100).toFixed(1)}%`;
      }
      return `${value.toFixed(1)}%`;
    case 'currency':
    default:
      return fmtCurrency(value);
  }
};

const getRatioColor = (key: keyof YearMetrics, value: number | null): string => {
  if (value === null) return '';

  switch (key) {
    case 'fccr':
      if (value >= 2.0) return 'text-green-600 font-semibold';
      if (value >= 1.5) return 'text-lime-600 font-semibold';
      if (value >= 1.2) return 'text-yellow-600 font-semibold';
      if (value >= 1.0) return 'text-orange-600 font-semibold';
      return 'text-red-600 font-semibold';
    case 'senior_debt_to_ebitda':
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
    default:
      return '';
  }
};

const FinancialTable: React.FC<FinancialTableProps> = ({ data }) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-gray-500">No financial data available.</p>
    );
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse(); // newest first

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
          {sections.map((section) => (
            <React.Fragment key={section.title}>
              {/* Section Header */}
              <tr className="bg-gray-50">
                <td
                  colSpan={years.length + 1}
                  className="py-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide border-t border-gray-200"
                >
                  {section.title}
                </td>
              </tr>
              {/* Section Rows */}
              {section.rows.map((row) => {
                const value = getMetricValue(data.metrics_by_year[years[0]], row.key);
                const hasValue = years.some(
                  (y) => getMetricValue(data.metrics_by_year[y], row.key) !== null
                );

                // Skip rows with no data across all years
                if (!hasValue) return null;

                return (
                  <tr
                    key={row.key}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      row.highlight ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className={`py-2 px-4 ${row.highlight ? 'font-medium' : ''}`}>
                      {row.label}
                    </td>
                    {years.map((y) => {
                      const val = getMetricValue(data.metrics_by_year[y], row.key);
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialTable;
