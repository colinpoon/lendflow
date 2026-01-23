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
  color: string;
  percentage: number;
}

// DSCR: Higher is better (more cash flow to cover debt)
// Excellent (2.0+): Very strong cash flow, twice the income needed to cover debt
// Great (1.5–1.99): Highly secure, strong cash flow, low repayment risk
// Good (1.25–1.49): Healthy/standard ratio accepted by most commercial lenders
// Fair (1.0–1.24): Break-even or slim cushion, stricter terms may apply
// Poor (Below 1.0): Insufficient income to cover debt, high risk of default
const getDSCRHealth = (value: number): HealthConfig => {
  if (value >= 2.0) return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value >= 1.5) return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value >= 1.25) return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value >= 1.0) return { level: 'weak', color: '#f97316', percentage: 40 };
  return { level: 'poor', color: '#ef4444', percentage: 20 };
};

// Senior Debt/EBITDA: Lower is better (less leverage)
// Excellent (<1.0x to 1.5x): Very low leverage, high financial flexibility, conservative capital structure
// Great (1.5x to 2.5x): Healthy, manageable debt levels with strong cash flow coverage
// Good/Acceptable (2.5x to 3.0x): Standard range for stable companies, "sweet spot" for senior lenders
// Poor/Elevated (3.0x to 4.0x): High leverage, risk if cash flows decline, lenders scrutinize carefully
// Bad/Distressed (>4.0x): High risk of financial distress, potential covenant breaches
const getSeniorDebtEBITDAHealth = (value: number): HealthConfig => {
  if (value <= 1.5) return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value <= 2.5) return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value <= 3.0) return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value <= 4.0) return { level: 'weak', color: '#f97316', percentage: 40 };
  return { level: 'poor', color: '#ef4444', percentage: 20 };
};

// Total Debt/Total Capital: Lower is better (less debt financing)
// Excellent (0.0–0.29): Very low debt, high financial stability, maximum financial flexibility
// Great/Good (0.3–0.5): Healthy balance of debt and equity, manageable risk
// Moderate/Fair (0.5–0.6): Increasingly reliant on debt, may be normal for capital-intensive industries
// Poor/High Risk (0.6–0.7+): High leverage, borrowing may become difficult, vulnerable to downturns
// Bad/Insolvent (>1.0): Total debt exceeds equity, potential technical insolvency
const getTotalDebtCapitalHealth = (value: number): HealthConfig => {
  if (value < 0.3) return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value <= 0.5) return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value <= 0.6) return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value <= 0.7) return { level: 'weak', color: '#f97316', percentage: 40 };
  return { level: 'poor', color: '#ef4444', percentage: 20 };
};

interface CircularGaugeProps {
  value: number | null;
  label: string;
  formatValue: (v: number) => string;
  getHealth: (v: number) => HealthConfig;
  subtitle?: string;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  label,
  formatValue,
  getHealth,
  subtitle,
}) => {
  const size = 160;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  if (value == null) {
    return (
      <div className="flex flex-col items-center p-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-400">N/A</span>
            <span className="text-sm text-gray-500">{label}</span>
          </div>
        </div>
      </div>
    );
  }

  const health = getHealth(value);
  const strokeDashoffset = circumference - (health.percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-4">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle with tick marks */}
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={health.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Tick marks */}
        <svg
          width={size}
          height={size}
          className="absolute top-0 left-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {Array.from({ length: 60 }).map((_, i) => {
            const angle = (i / 60) * 360;
            const isLargeTick = i % 5 === 0;
            const tickLength = isLargeTick ? 6 : 3;
            const outerRadius = radius + strokeWidth / 2 + 2;
            const innerRadius = outerRadius - tickLength;

            const x1 = size / 2 + outerRadius * Math.cos((angle * Math.PI) / 180);
            const y1 = size / 2 + outerRadius * Math.sin((angle * Math.PI) / 180);
            const x2 = size / 2 + innerRadius * Math.cos((angle * Math.PI) / 180);
            const y2 = size / 2 + innerRadius * Math.sin((angle * Math.PI) / 180);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#d1d5db"
                strokeWidth={isLargeTick ? 1.5 : 0.75}
              />
            );
          })}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">
            {formatValue(value)}
          </span>
          <span className="text-sm text-gray-600 text-center px-2">{label}</span>
        </div>
      </div>
      {subtitle && (
        <span className="text-xs text-gray-500 mt-2">{subtitle}</span>
      )}
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Debt Health Indicators</h2>
        <span className="text-sm text-gray-500">Fiscal Year {latestYear}</span>
      </div>

      <div className="flex flex-wrap justify-center gap-8">
        <CircularGauge
          value={metrics.dscr}
          label="DSCR"
          formatValue={(v) => v.toFixed(2)}
          getHealth={getDSCRHealth}
          subtitle="Target: > 1.5x"
        />

        <CircularGauge
          value={metrics.senior_debt_to_ebitda}
          label="Debt / EBITDA"
          formatValue={(v) => v.toFixed(2)}
          getHealth={getSeniorDebtEBITDAHealth}
          subtitle="Target: < 2.5x"
        />

        <CircularGauge
          value={metrics.total_debt_to_capital}
          label="Debt / Capital"
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          getHealth={getTotalDebtCapitalHealth}
          subtitle="Target: < 30%"
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
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
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
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
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
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
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
