'use client';

import React from 'react';

interface YearMetrics {
  dscr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
}

interface DebtHealthMetersProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

type HealthLevel = 'excellent' | 'good' | 'adequate' | 'weak' | 'poor';

interface HealthConfig {
  level: HealthLevel;
  label: string;
  color: string;
  bgColor: string;
  percentage: number;
}

// DSCR: Higher is better (more cash flow to cover debt)
const getDSCRHealth = (value: number): HealthConfig => {
  if (value >= 2.0) return { level: 'excellent', label: 'Excellent', color: 'bg-green-500', bgColor: 'bg-green-100', percentage: 100 };
  if (value >= 1.5) return { level: 'good', label: 'Good', color: 'bg-green-400', bgColor: 'bg-green-100', percentage: 80 };
  if (value >= 1.25) return { level: 'adequate', label: 'Adequate', color: 'bg-yellow-400', bgColor: 'bg-yellow-100', percentage: 60 };
  if (value >= 1.0) return { level: 'weak', label: 'Weak', color: 'bg-orange-400', bgColor: 'bg-orange-100', percentage: 40 };
  return { level: 'poor', label: 'Poor', color: 'bg-red-500', bgColor: 'bg-red-100', percentage: 20 };
};

// Senior Debt/EBITDA: Lower is better (less leverage)
const getSeniorDebtEBITDAHealth = (value: number): HealthConfig => {
  if (value <= 2.0) return { level: 'excellent', label: 'Excellent', color: 'bg-green-500', bgColor: 'bg-green-100', percentage: 100 };
  if (value <= 3.0) return { level: 'good', label: 'Good', color: 'bg-green-400', bgColor: 'bg-green-100', percentage: 80 };
  if (value <= 4.0) return { level: 'adequate', label: 'Adequate', color: 'bg-yellow-400', bgColor: 'bg-yellow-100', percentage: 60 };
  if (value <= 5.0) return { level: 'weak', label: 'Weak', color: 'bg-orange-400', bgColor: 'bg-orange-100', percentage: 40 };
  return { level: 'poor', label: 'Poor', color: 'bg-red-500', bgColor: 'bg-red-100', percentage: 20 };
};

// Total Debt/Total Capital: Lower is better (less debt financing)
const getTotalDebtCapitalHealth = (value: number): HealthConfig => {
  if (value <= 0.3) return { level: 'excellent', label: 'Excellent', color: 'bg-green-500', bgColor: 'bg-green-100', percentage: 100 };
  if (value <= 0.4) return { level: 'good', label: 'Good', color: 'bg-green-400', bgColor: 'bg-green-100', percentage: 80 };
  if (value <= 0.5) return { level: 'adequate', label: 'Adequate', color: 'bg-yellow-400', bgColor: 'bg-yellow-100', percentage: 60 };
  if (value <= 0.7) return { level: 'weak', label: 'Weak', color: 'bg-orange-400', bgColor: 'bg-orange-100', percentage: 40 };
  return { level: 'poor', label: 'Poor', color: 'bg-red-500', bgColor: 'bg-red-100', percentage: 20 };
};

interface HealthMeterProps {
  title: string;
  value: number | null;
  formatValue: (v: number) => string;
  getHealth: (v: number) => HealthConfig;
  description: string;
  benchmark: string;
}

const HealthMeter: React.FC<HealthMeterProps> = ({
  title,
  value,
  formatValue,
  getHealth,
  description,
  benchmark,
}) => {
  if (value == null) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <p className="text-gray-400 text-sm mt-2">Data not available</p>
      </div>
    );
  }

  const health = getHealth(value);

  return (
    <div className={`p-4 border rounded-lg ${health.bgColor}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium text-white ${health.color}`}>
          {health.label}
        </span>
      </div>

      <div className="text-3xl font-bold text-gray-900 mb-2">
        {formatValue(value)}
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${health.color}`}
          style={{ width: `${health.percentage}%` }}
        />
      </div>

      <p className="text-xs text-gray-600 mb-1">{description}</p>
      <p className="text-xs text-gray-500 italic">{benchmark}</p>
    </div>
  );
};

const DebtHealthMeters: React.FC<DebtHealthMetersProps> = ({ data }) => {
  if (!data || !data.metrics_by_year || Object.keys(data.metrics_by_year).length === 0) {
    return <p className="text-gray-500">No debt metrics available.</p>;
  }

  // Get the most recent year's data
  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Debt Health Indicators</h2>
        <span className="text-sm text-gray-500">Fiscal Year {latestYear}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <HealthMeter
          title="Debt Service Coverage Ratio"
          value={metrics.dscr}
          formatValue={(v) => `${v.toFixed(2)}x`}
          getHealth={getDSCRHealth}
          description="Measures ability to pay debt obligations from operating cash flow"
          benchmark="Target: > 1.5x"
        />

        <HealthMeter
          title="Senior Debt / EBITDA"
          value={metrics.senior_debt_to_ebitda}
          formatValue={(v) => `${v.toFixed(2)}x`}
          getHealth={getSeniorDebtEBITDAHealth}
          description="Measures leverage relative to earnings capacity"
          benchmark="Target: < 3.0x"
        />

        <HealthMeter
          title="Total Debt / Total Capital"
          value={metrics.total_debt_to_capital}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          getHealth={getTotalDebtCapitalHealth}
          description="Measures proportion of capital structure financed by debt"
          benchmark="Target: < 50%"
        />
      </div>

      {years.length > 1 && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Historical Comparison</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Metric</th>
                  {years.map((yr) => (
                    <th key={yr} className="text-right py-2 px-2">{yr}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">DSCR</td>
                  {years.map((yr) => {
                    const val = data.metrics_by_year[yr].dscr;
                    const health = val != null ? getDSCRHealth(val) : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${health?.color} text-white`}>
                            {val.toFixed(2)}x
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Senior Debt / EBITDA</td>
                  {years.map((yr) => {
                    const val = data.metrics_by_year[yr].senior_debt_to_ebitda;
                    const health = val != null ? getSeniorDebtEBITDAHealth(val) : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${health?.color} text-white`}>
                            {val.toFixed(2)}x
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2 pr-4">Total Debt / Capital</td>
                  {years.map((yr) => {
                    const val = data.metrics_by_year[yr].total_debt_to_capital;
                    const health = val != null ? getTotalDebtCapitalHealth(val) : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span className={`px-2 py-0.5 rounded text-xs ${health?.color} text-white`}>
                            {(val * 100).toFixed(0)}%
                          </span>
                        ) : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtHealthMeters;
