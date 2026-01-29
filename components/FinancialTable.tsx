'use client';

import React from 'react';
import { fmtCurrency } from '@/utils/format';

interface YearMetrics {
  revenue: number | null;
  net_income: number | null;
  expenses: number | null;
  profit_margins: number | null;
  interest: number | null;
  taxes: number | null;
  depreciation_amortization: number | null;
  ebitda: number | null;
  ebitda_calculated?: boolean;
  adjusted_ebitda: number | null;
  total_debt: number | null;
  senior_debt: number | null;
  shareholders_equity: number | null;
  capital_expenditures: number | null;
  fccr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
}

interface FinancialTableProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

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
      if (value >= 2.0) return 'text-success font-medium';
      if (value >= 1.5) return 'text-chart-2 font-medium';
      if (value >= 1.2) return 'text-warning font-medium';
      if (value >= 1.0) return 'text-chart-4 font-medium';
      return 'text-danger font-medium';
    case 'senior_debt_to_ebitda':
      if (value <= 1.5) return 'text-success font-medium';
      if (value <= 2.5) return 'text-chart-2 font-medium';
      if (value <= 3.0) return 'text-warning font-medium';
      if (value <= 4.0) return 'text-chart-4 font-medium';
      return 'text-danger font-medium';
    case 'total_debt_to_capital':
      if (value < 0.3) return 'text-success font-medium';
      if (value <= 0.5) return 'text-chart-2 font-medium';
      if (value <= 0.6) return 'text-warning font-medium';
      if (value <= 0.7) return 'text-chart-4 font-medium';
      return 'text-danger font-medium';
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
      <p className="text-sm text-muted-foreground">No financial data available.</p>
    );
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse();

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Financial Metrics</h3>
        <span className="text-xs text-muted-foreground">(Values in thousands)</span>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">
              Metric
            </th>
            {years.map((y) => (
              <th key={y} className="py-3 px-4 text-right text-xs font-medium text-muted-foreground">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <React.Fragment key={section.title}>
              <tr className="border-t border-border bg-muted/30">
                <td
                  colSpan={years.length + 1}
                  className="py-2 px-4 text-xs font-medium text-muted-foreground"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => {
                const hasValue = years.some(
                  (y) => getMetricValue(data.metrics_by_year[y], row.key) !== null
                );

                if (!hasValue) return null;

                return (
                  <tr
                    key={row.key}
                    className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                      row.highlight ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className={`py-2.5 px-4 ${row.highlight ? 'font-medium' : ''}`}>
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
                          className={`py-2.5 px-4 text-right tabular-nums ${colorClass} ${
                            row.highlight && !colorClass ? 'font-medium' : ''
                          } ${!colorClass && !row.highlight ? 'text-muted-foreground' : ''}`}
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
