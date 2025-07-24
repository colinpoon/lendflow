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
  shareholders_equity: number | null;
}

interface FinancialTableProps {
  /** Result returned by the backend: { metrics_by_year: { "2024": {...}, "2023": {...} } } */
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

const rows = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'net_income', label: 'Net Income' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'profit_margins', label: 'Profit Margins' },
  { key: 'interest', label: 'Interest' },
  { key: 'taxes', label: 'Taxes' },
  {
    key: 'depreciation_amortization',
    label: 'Depreciation & Amort.',
  },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'shareholders_equity', label: "Shareholders' Equity" },
];

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
    <div className="p-4 border rounded-lg shadow-md w-full overflow-x-auto">
      <h2 className="text-lg font-semibold mb-2">
        Financial Metrics
      </h2>
      <table className="min-w-full text-sm border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2 text-left">Metric</th>
            {years.map((y) => (
              <th key={y} className="border p-2 text-right">
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="border p-2">{row.label}</td>
              {years.map((y) => (
                <td key={y} className="border p-2 text-right">
                  {fmtCurrency(
                    typeof (data.metrics_by_year[y] as any)?.[
                      row.key
                    ] === 'string'
                      ? parseFloat(
                          (data.metrics_by_year[y] as any)?.[row.key]
                        )
                      : (data.metrics_by_year[y] as any)?.[row.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialTable;
