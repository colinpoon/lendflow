'use client';

import React from 'react';

interface YearMetrics {
  // Calculated ratios
  dscr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  // Source data for calculations
  ebitda: number | null;
  debt_service_payments: number | null;
  interest: number | null;
  senior_debt: number | null;
  total_debt: number | null;
  shareholders_equity: number | null;
}

interface DebtHealthMetersProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

type HealthLevel = 'excellent' | 'good' | 'adequate' | 'weak' | 'poor';

const formatCurrency = (value: number | null): string => {
  if (value == null) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const getRatingLabel = (level: HealthLevel): string => {
  switch (level) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Great';
    case 'adequate': return 'Good';
    case 'weak': return 'Fair';
    case 'poor': return 'Poor';
  }
};

const getDSCRReasoning = (value: number, level: HealthLevel): string => {
  switch (level) {
    case 'excellent':
      return `Very strong cash flow with ${value.toFixed(2)}x coverage. The company generates more than twice the income needed to cover debt obligations.`;
    case 'good':
      return `Highly secure with ${value.toFixed(2)}x coverage. Strong cash flow indicates low repayment risk.`;
    case 'adequate':
      return `Healthy ratio at ${value.toFixed(2)}x. This is the standard range accepted by most commercial lenders.`;
    case 'weak':
      return `Slim cushion at ${value.toFixed(2)}x. The business is near break-even on debt coverage. Lenders may require stricter terms.`;
    case 'poor':
      return `Insufficient coverage at ${value.toFixed(2)}x. The company does not generate enough income to cover debt payments, signaling high default risk.`;
  }
};

const getDebtEBITDAReasoning = (value: number, level: HealthLevel): string => {
  switch (level) {
    case 'excellent':
      return `Very low leverage at ${value.toFixed(2)}x. High financial flexibility with a conservative capital structure.`;
    case 'good':
      return `Healthy debt levels at ${value.toFixed(2)}x. Manageable leverage with strong cash flow coverage.`;
    case 'adequate':
      return `Standard leverage at ${value.toFixed(2)}x. This is the typical "sweet spot" range for senior lenders.`;
    case 'weak':
      return `Elevated leverage at ${value.toFixed(2)}x. Risk increases if cash flows decline. Lenders will scrutinize carefully.`;
    case 'poor':
      return `High leverage at ${value.toFixed(2)}x. Significant risk of financial distress and potential covenant breaches.`;
  }
};

const getDebtCapitalReasoning = (value: number, level: HealthLevel): string => {
  const pct = (value * 100).toFixed(0);
  switch (level) {
    case 'excellent':
      return `Very low debt at ${pct}% of capital. High financial stability with maximum flexibility.`;
    case 'good':
      return `Healthy balance at ${pct}% debt. Reasonable leverage with manageable risk.`;
    case 'adequate':
      return `Moderate reliance on debt at ${pct}%. May be normal for capital-intensive industries.`;
    case 'weak':
      return `High leverage at ${pct}% debt financing. Borrowing may become difficult; vulnerable to downturns.`;
    case 'poor':
      return `Excessive debt at ${pct}% of capital. High risk of financial distress or technical insolvency.`;
  }
};

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

      {/* Calculation Breakdown */}
      <div className="mt-8 space-y-4">
        <h3 className="text-md font-semibold text-gray-800 border-b pb-2">Calculation Details</h3>

        {/* DSCR Calculation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-700">Debt Service Coverage Ratio (DSCR)</h4>
            {metrics.dscr != null && (
              <span
                className="px-2 py-1 rounded text-xs text-white font-medium"
                style={{ backgroundColor: getDSCRHealth(metrics.dscr).color }}
              >
                {getRatingLabel(getDSCRHealth(metrics.dscr).level)}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-mono bg-white px-2 py-1 rounded border">
              DSCR = EBITDA ÷ Debt Service Payments
            </span>
          </div>
          {metrics.ebitda != null && (metrics.debt_service_payments != null || metrics.interest != null) ? (
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">EBITDA:</span>
                <span className="font-medium">{formatCurrency(metrics.ebitda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Debt Service Payments:</span>
                <span className="font-medium">
                  {formatCurrency(metrics.debt_service_payments ?? metrics.interest)}
                  {metrics.debt_service_payments == null && metrics.interest != null && (
                    <span className="text-xs text-gray-400 ml-1">(using interest)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-2">
                <span className="text-gray-700 font-medium">Result:</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(metrics.ebitda)} ÷ {formatCurrency(metrics.debt_service_payments ?? metrics.interest)} = {metrics.dscr?.toFixed(2)}x
                </span>
              </div>
              {metrics.dscr != null && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  {getDSCRReasoning(metrics.dscr, getDSCRHealth(metrics.dscr).level)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Insufficient data to calculate DSCR</p>
          )}
        </div>

        {/* Senior Debt / EBITDA Calculation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-700">Senior Debt / EBITDA</h4>
            {metrics.senior_debt_to_ebitda != null && (
              <span
                className="px-2 py-1 rounded text-xs text-white font-medium"
                style={{ backgroundColor: getSeniorDebtEBITDAHealth(metrics.senior_debt_to_ebitda).color }}
              >
                {getRatingLabel(getSeniorDebtEBITDAHealth(metrics.senior_debt_to_ebitda).level)}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-mono bg-white px-2 py-1 rounded border">
              Debt/EBITDA = Senior Debt ÷ EBITDA
            </span>
          </div>
          {metrics.senior_debt != null && metrics.ebitda != null ? (
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Senior Debt:</span>
                <span className="font-medium">
                  {formatCurrency(metrics.senior_debt)}
                  {metrics.senior_debt === metrics.total_debt && (
                    <span className="text-xs text-gray-400 ml-1">(= Total Debt)</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">EBITDA:</span>
                <span className="font-medium">{formatCurrency(metrics.ebitda)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-2">
                <span className="text-gray-700 font-medium">Result:</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(metrics.senior_debt)} ÷ {formatCurrency(metrics.ebitda)} = {metrics.senior_debt_to_ebitda?.toFixed(2)}x
                </span>
              </div>
              {metrics.senior_debt_to_ebitda != null && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  {getDebtEBITDAReasoning(metrics.senior_debt_to_ebitda, getSeniorDebtEBITDAHealth(metrics.senior_debt_to_ebitda).level)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Insufficient data to calculate Debt/EBITDA</p>
          )}
        </div>

        {/* Total Debt / Total Capital Calculation */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-700">Total Debt / Total Capital</h4>
            {metrics.total_debt_to_capital != null && (
              <span
                className="px-2 py-1 rounded text-xs text-white font-medium"
                style={{ backgroundColor: getTotalDebtCapitalHealth(metrics.total_debt_to_capital).color }}
              >
                {getRatingLabel(getTotalDebtCapitalHealth(metrics.total_debt_to_capital).level)}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-mono bg-white px-2 py-1 rounded border">
              Debt/Capital = Total Debt ÷ (Total Debt + Shareholders&apos; Equity)
            </span>
          </div>
          {metrics.total_debt != null && metrics.shareholders_equity != null ? (
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Debt:</span>
                <span className="font-medium">{formatCurrency(metrics.total_debt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shareholders&apos; Equity:</span>
                <span className="font-medium">{formatCurrency(metrics.shareholders_equity)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Capital:</span>
                <span className="font-medium">{formatCurrency(metrics.total_debt + metrics.shareholders_equity)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-2">
                <span className="text-gray-700 font-medium">Result:</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(metrics.total_debt)} ÷ {formatCurrency(metrics.total_debt + metrics.shareholders_equity)} = {((metrics.total_debt_to_capital ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              {metrics.total_debt_to_capital != null && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  {getDebtCapitalReasoning(metrics.total_debt_to_capital, getTotalDebtCapitalHealth(metrics.total_debt_to_capital).level)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Insufficient data to calculate Debt/Capital</p>
          )}
        </div>
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
