'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FCCRBreakdown {
  calculation_type: 'lender_defined';
  // Numerator (simple - just Adjusted EBITDA)
  adjusted_ebitda: number;
  numerator: number;
  // Denominator components (Total Fixed Charges)
  senior_debt_interest: number;
  senior_debt_interest_rate: number;
  senior_debt_balance: number | null;
  subordinated_debt_interest: number;
  lease_payments: number;
  other_fixed_charges: number;
  total_fixed_charges: number;
  denominator: number;
  // Data source flags
  interest_calculated: boolean;
  interest_rate_assumed: boolean;
}

interface DebtBreakdown {
  bank_debt: number;
  lease_liabilities: number;
  notes_payable: number;
  subordinated_debt: number;
  other_non_senior_debt: number;
}

interface YearMetrics {
  // Calculated ratios
  fccr: number | null;
  fccr_numerator: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  total_fixed_charges: number | null;
  // Source data for calculations
  ebitda: number | null;
  adjusted_ebitda: number | null;
  fccr_breakdown: FCCRBreakdown | null;
  debt_breakdown: DebtBreakdown | null;
  senior_debt: number | null;
  total_debt: number | null;
  shareholders_equity: number | null;
}

interface DebtHealthMetersProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

type HealthLevel =
  | 'excellent'
  | 'good'
  | 'adequate'
  | 'weak'
  | 'poor';

/**
 * Format currency values displayed in thousands (as commonly reported in financial statements)
 */
const formatCurrency = (value: number | null): string => {
  if (value == null) return 'N/A';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
};

const getRatingLabel = (level: HealthLevel): string => {
  switch (level) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Great';
    case 'adequate':
      return 'Good';
    case 'weak':
      return 'Fair';
    case 'poor':
      return 'Poor';
  }
};

const getFCCRReasoning = (
  value: number,
  level: HealthLevel,
): string => {
  switch (level) {
    case 'excellent':
      return `Exceptional coverage at ${value.toFixed(2)}x. Adjusted EBITDA covers total fixed charges (interest + lease payments) more than twice over, indicating strong debt service capacity.`;
    case 'good':
      return `Strong coverage at ${value.toFixed(2)}x. Ample cash flow to service all fixed obligations with healthy cushion for variability in earnings.`;
    case 'adequate':
      return `Acceptable coverage at ${value.toFixed(2)}x. Meets typical lender minimum thresholds. Monitor for any earnings volatility.`;
    case 'weak':
      return `Thin margin at ${value.toFixed(2)}x. Cash flow barely covers fixed charges. Lenders will scrutinize and may require tighter covenants.`;
    case 'poor':
      return `Insufficient coverage at ${value.toFixed(2)}x. Adjusted EBITDA does not cover fixed obligations, signaling high default risk.`;
  }
};

const getDebtEBITDAReasoning = (
  value: number,
  level: HealthLevel,
): string => {
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

const getDebtCapitalReasoning = (
  value: number,
  level: HealthLevel,
): string => {
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

// FCCR: Higher is better (more cash flow to cover fixed charges)
// Excellent (2.0+): Very strong coverage, twice the Adjusted EBITDA needed for fixed charges
// Great (1.5–1.99): Strong coverage, comfortable margin for fixed obligations
// Good (1.2–1.49): Acceptable coverage, typical minimum for most lenders
// Fair (1.0–1.19): Break-even or thin cushion, may require additional scrutiny
// Poor (Below 1.0): Insufficient to cover fixed charges, high default risk
const getFCCRHealth = (value: number): HealthConfig => {
  if (value >= 2.0)
    return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value >= 1.5)
    return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value >= 1.2)
    return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value >= 1.0)
    return { level: 'weak', color: '#f97316', percentage: 40 };
  return { level: 'poor', color: '#ef4444', percentage: 20 };
};

// Senior Debt/EBITDA: Lower is better (less leverage)
// Excellent (<1.0x to 1.5x): Very low leverage, high financial flexibility, conservative capital structure
// Great (1.5x to 2.5x): Healthy, manageable debt levels with strong cash flow coverage
// Good/Acceptable (2.5x to 3.0x): Standard range for stable companies, "sweet spot" for senior lenders
// Poor/Elevated (3.0x to 4.0x): High leverage, risk if cash flows decline, lenders scrutinize carefully
// Bad/Distressed (>4.0x): High risk of financial distress, potential covenant breaches
const getSeniorDebtEBITDAHealth = (value: number): HealthConfig => {
  if (value <= 1.5)
    return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value <= 2.5)
    return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value <= 3.0)
    return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value <= 4.0)
    return { level: 'weak', color: '#f97316', percentage: 40 };
  return { level: 'poor', color: '#ef4444', percentage: 20 };
};

// Total Debt/Total Capital: Lower is better (less debt financing)
// Excellent (0.0–0.29): Very low debt, high financial stability, maximum financial flexibility
// Great/Good (0.3–0.5): Healthy balance of debt and equity, manageable risk
// Moderate/Fair (0.5–0.6): Increasingly reliant on debt, may be normal for capital-intensive industries
// Poor/High Risk (0.6–0.7+): High leverage, borrowing may become difficult, vulnerable to downturns
// Bad/Insolvent (>1.0): Total debt exceeds equity, potential technical insolvency
const getTotalDebtCapitalHealth = (value: number): HealthConfig => {
  if (value < 0.3)
    return { level: 'excellent', color: '#22c55e', percentage: 100 };
  if (value <= 0.5)
    return { level: 'good', color: '#84cc16', percentage: 80 };
  if (value <= 0.6)
    return { level: 'adequate', color: '#eab308', percentage: 60 };
  if (value <= 0.7)
    return { level: 'weak', color: '#f97316', percentage: 40 };
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
        <div
          className="relative"
          style={{ width: size, height: size }}
        >
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
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
            <span className="text-2xl font-bold text-gray-400">
              N/A
            </span>
            <span className="text-sm text-gray-500">{label}</span>
          </div>
        </div>
      </div>
    );
  }

  const health = getHealth(value);
  const strokeDashoffset =
    circumference - (health.percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center p-4">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle with tick marks */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
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

            const x1 =
              size / 2 +
              outerRadius * Math.cos((angle * Math.PI) / 180);
            const y1 =
              size / 2 +
              outerRadius * Math.sin((angle * Math.PI) / 180);
            const x2 =
              size / 2 +
              innerRadius * Math.cos((angle * Math.PI) / 180);
            const y2 =
              size / 2 +
              innerRadius * Math.sin((angle * Math.PI) / 180);

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
          <span className="text-sm text-gray-600 text-center px-2">
            {label}
          </span>
        </div>
      </div>
      {subtitle && (
        <span className="text-xs text-gray-500 mt-2">{subtitle}</span>
      )}
    </div>
  );
};

const DebtHealthMeters: React.FC<DebtHealthMetersProps> = ({
  data,
}) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-gray-500">No debt metrics available.</p>
    );
  }

  // Get all years sorted (most recent first)
  const years = Object.keys(data.metrics_by_year).sort().reverse();

  return (
    <div className="space-y-8">
      <div className="flex justify-start items-center">
        <span className="text-xs text-gray-500">
          (Values in thousands)
        </span>
      </div>

      {/* Render gauges for each year */}
      {years.map((year) => {
        const metrics = data.metrics_by_year[year];
        return (
          <div
            key={year}
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Fiscal Year {year}
            </h3>
            <div className="flex flex-wrap justify-center gap-8">
              <CircularGauge
                value={metrics.fccr}
                label="FCCR"
                formatValue={(v) => v.toFixed(2)}
                getHealth={getFCCRHealth}
                subtitle="Target: > 1.2x"
              />

              <CircularGauge
                value={metrics.senior_debt_to_ebitda}
                label="Sr. Debt / EBITDA"
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
          </div>
        );
      })}

      {/* Calculation Breakdowns - show for most recent year */}
      {(() => {
        const latestYear = years[0];
        const metrics = data.metrics_by_year[latestYear];
        return (
          <div className="mt-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Ratio Breakdowns ({latestYear})
            </h3>

            <Accordion type="multiple" className="w-full space-y-3">
              {/* FCCR Breakdown */}
              <AccordionItem
                value="fccr"
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold text-gray-800">
                      Fixed Charge Coverage Ratio (FCCR)
                    </span>
                    {metrics.fccr != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {metrics.fccr.toFixed(2)}x
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{
                            backgroundColor: getFCCRHealth(
                              metrics.fccr,
                            ).color,
                          }}
                        >
                          {getRatingLabel(
                            getFCCRHealth(metrics.fccr).level,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {metrics.fccr_breakdown ? (
                    <>
                      {/* Calculation Formula */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          Adjusted EBITDA ÷ Total Fixed Charges
                        </span>
                        {metrics.fccr_breakdown
                          .interest_calculated && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                            Interest @{' '}
                            {(
                              metrics.fccr_breakdown
                                .senior_debt_interest_rate * 100
                            ).toFixed(0)}
                            %
                            {metrics.fccr_breakdown
                              .interest_rate_assumed && ' (assumed)'}
                          </span>
                        )}
                      </div>

                      {/* Numerator - Adjusted EBITDA */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-blue-700 mb-2">
                          Numerator
                        </div>
                        <div className="pl-4 border-l-2 border-blue-200 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Adjusted EBITDA
                            </span>
                            <span className="font-medium">
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .adjusted_ebitda,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Denominator - Total Fixed Charges */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-orange-700 mb-2">
                          Denominator (Total Fixed Charges)
                        </div>
                        <div className="pl-4 border-l-2 border-orange-200 space-y-1 text-sm">
                          {metrics.fccr_breakdown
                            .senior_debt_interest > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                Cash Interest on Senior Debt
                                {metrics.fccr_breakdown
                                  .interest_calculated &&
                                  metrics.fccr_breakdown
                                    .senior_debt_balance && (
                                    <span className="text-xs text-gray-400 ml-1">
                                      (
                                      {(
                                        metrics.fccr_breakdown
                                          .senior_debt_interest_rate *
                                        100
                                      ).toFixed(0)}
                                      % ×{' '}
                                      {formatCurrency(
                                        metrics.fccr_breakdown
                                          .senior_debt_balance,
                                      )}
                                      )
                                    </span>
                                  )}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(
                                  metrics.fccr_breakdown
                                    .senior_debt_interest,
                                )}
                              </span>
                            </div>
                          )}
                          {metrics.fccr_breakdown
                            .subordinated_debt_interest > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                + Subordinated Note Interest
                              </span>
                              <span className="font-medium">
                                +{' '}
                                {formatCurrency(
                                  metrics.fccr_breakdown
                                    .subordinated_debt_interest,
                                )}
                              </span>
                            </div>
                          )}
                          {metrics.fccr_breakdown.lease_payments >
                            0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                + Finance Lease / Min. Lease Payments
                              </span>
                              <span className="font-medium">
                                +{' '}
                                {formatCurrency(
                                  metrics.fccr_breakdown
                                    .lease_payments,
                                )}
                              </span>
                            </div>
                          )}
                          {metrics.fccr_breakdown
                            .other_fixed_charges > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                + Other Fixed Charges
                              </span>
                              <span className="font-medium">
                                +{' '}
                                {formatCurrency(
                                  metrics.fccr_breakdown
                                    .other_fixed_charges,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t font-semibold text-orange-800">
                          <span>Total Fixed Charges</span>
                          <span>
                            {formatCurrency(
                              metrics.fccr_breakdown
                                .total_fixed_charges,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.fccr != null && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                          {getFCCRReasoning(
                            metrics.fccr,
                            getFCCRHealth(metrics.fccr).level,
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Insufficient data. Minimum required: Adjusted
                      EBITDA and Senior Debt (or Interest Expense).
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Senior Debt / EBITDA Breakdown */}
              <AccordionItem
                value="senior-debt-ebitda"
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold text-gray-800">
                      Senior Debt / Adjusted EBITDA
                    </span>
                    {metrics.senior_debt_to_ebitda != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {metrics.senior_debt_to_ebitda.toFixed(2)}x
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{
                            backgroundColor:
                              getSeniorDebtEBITDAHealth(
                                metrics.senior_debt_to_ebitda,
                              ).color,
                          }}
                        >
                          {getRatingLabel(
                            getSeniorDebtEBITDAHealth(
                              metrics.senior_debt_to_ebitda,
                            ).level,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {metrics.senior_debt != null &&
                  (metrics.adjusted_ebitda != null ||
                    metrics.ebitda != null) ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          Senior Debt ÷ Adjusted EBITDA
                        </span>
                      </div>

                      {/* Senior Debt Breakdown */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-indigo-700 mb-2">
                          Numerator (Senior Debt)
                        </div>
                        <div className="pl-4 border-l-2 border-indigo-200 space-y-1 text-sm">
                          {metrics.debt_breakdown ? (
                            <>
                              {metrics.debt_breakdown.bank_debt >
                                0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Bank Debt (Current + Long-term)
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .bank_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .lease_liabilities > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Lease Liabilities (Current +
                                    Long-term)
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .lease_liabilities,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown.bank_debt ===
                                0 &&
                                metrics.debt_breakdown
                                  .lease_liabilities === 0 && (
                                  <div className="flex justify-between text-gray-500 italic">
                                    <span>
                                      No debt component breakdown
                                      available
                                    </span>
                                    <span>
                                      {formatCurrency(
                                        metrics.senior_debt,
                                      )}
                                    </span>
                                  </div>
                                )}
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Bank Debt (Current + Long-term)
                                </span>
                                <span className="font-medium text-gray-400">
                                  Included
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  + Lease Liabilities (Current +
                                  Long-term)
                                </span>
                                <span className="font-medium text-gray-400">
                                  + Included
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t font-semibold text-indigo-800">
                          <span>Total Senior Debt</span>
                          <span>
                            {formatCurrency(metrics.senior_debt)}
                          </span>
                        </div>
                      </div>

                      {/* EBITDA */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-teal-700 mb-2">
                          Denominator (Adjusted EBITDA)
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t font-semibold text-teal-800">
                          <span>Adjusted EBITDA</span>
                          <span>
                            {formatCurrency(
                              metrics.adjusted_ebitda ??
                                metrics.ebitda,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.senior_debt_to_ebitda != null && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                          {getDebtEBITDAReasoning(
                            metrics.senior_debt_to_ebitda,
                            getSeniorDebtEBITDAHealth(
                              metrics.senior_debt_to_ebitda,
                            ).level,
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Insufficient data to calculate Debt/EBITDA
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Total Debt / Total Capital Breakdown */}
              <AccordionItem
                value="total-debt-capital"
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold text-gray-800">
                      Total Debt / Total Capital
                    </span>
                    {metrics.total_debt_to_capital != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">
                          {(
                            metrics.total_debt_to_capital * 100
                          ).toFixed(0)}
                          %
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{
                            backgroundColor:
                              getTotalDebtCapitalHealth(
                                metrics.total_debt_to_capital,
                              ).color,
                          }}
                        >
                          {getRatingLabel(
                            getTotalDebtCapitalHealth(
                              metrics.total_debt_to_capital,
                            ).level,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {metrics.total_debt != null &&
                  metrics.shareholders_equity != null ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                          Total Debt ÷ (Total Debt +
                          Shareholders&apos; Equity)
                        </span>
                      </div>

                      {/* Total Debt Breakdown */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-rose-700 mb-2">
                          Numerator (Total Debt)
                        </div>
                        <div className="pl-4 border-l-2 border-rose-200 space-y-1 text-sm">
                          {metrics.debt_breakdown ? (
                            <>
                              {/* Senior Debt Components */}
                              {metrics.debt_breakdown.bank_debt >
                                0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Bank Debt
                                  </span>
                                  <span className="font-medium">
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .bank_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .lease_liabilities > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Lease Liabilities
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .lease_liabilities,
                                    )}
                                  </span>
                                </div>
                              )}
                              {/* Non-Senior Debt Components */}
                              {metrics.debt_breakdown.notes_payable >
                                0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Notes Payable
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .notes_payable,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .subordinated_debt > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Subordinated Debt
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .subordinated_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .other_non_senior_debt > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Other Debt
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .other_non_senior_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span className="text-gray-600">
                                  Senior Debt (Bank + Leases)
                                </span>
                                <span className="font-medium">
                                  {formatCurrency(
                                    metrics.senior_debt,
                                  )}
                                </span>
                              </div>
                              {metrics.total_debt !==
                                metrics.senior_debt && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    + Subordinated Debt
                                  </span>
                                  <span className="font-medium">
                                    +{' '}
                                    {formatCurrency(
                                      (metrics.total_debt ?? 0) -
                                        (metrics.senior_debt ?? 0),
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t font-semibold text-rose-800">
                          <span>Total Debt</span>
                          <span>
                            {formatCurrency(metrics.total_debt)}
                          </span>
                        </div>
                      </div>

                      {/* Total Capital Breakdown */}
                      <div className="mb-4">
                        <div className="text-sm font-semibold text-emerald-700 mb-2">
                          Denominator (Total Capital)
                        </div>
                        <div className="pl-4 border-l-2 border-emerald-200 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Total Debt
                            </span>
                            <span className="font-medium">
                              {formatCurrency(metrics.total_debt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              + Shareholders&apos; Equity
                            </span>
                            <span className="font-medium">
                              +{' '}
                              {formatCurrency(
                                metrics.shareholders_equity,
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between mt-2 pt-2 border-t font-semibold text-emerald-800">
                          <span>Total Capital</span>
                          <span>
                            {formatCurrency(
                              metrics.total_debt +
                                metrics.shareholders_equity,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.total_debt_to_capital != null && (
                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                          {getDebtCapitalReasoning(
                            metrics.total_debt_to_capital,
                            getTotalDebtCapitalHealth(
                              metrics.total_debt_to_capital,
                            ).level,
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      Insufficient data to calculate Debt/Capital
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        );
      })()}

      {years.length > 1 && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Historical Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Metric</th>
                  {years.map((yr) => (
                    <th key={yr} className="text-right py-2 px-2">
                      {yr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4">FCCR</td>
                  {years.map((yr) => {
                    const val = data.metrics_by_year[yr].fccr;
                    const health =
                      val != null ? getFCCRHealth(val) : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
                            {val.toFixed(2)}x
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">
                    Senior Debt / Adj. EBITDA
                  </td>
                  {years.map((yr) => {
                    const val =
                      data.metrics_by_year[yr].senior_debt_to_ebitda;
                    const health =
                      val != null
                        ? getSeniorDebtEBITDAHealth(val)
                        : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
                            {val.toFixed(2)}x
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2 pr-4">Total Debt / Capital</td>
                  {years.map((yr) => {
                    const val =
                      data.metrics_by_year[yr].total_debt_to_capital;
                    const health =
                      val != null
                        ? getTotalDebtCapitalHealth(val)
                        : null;
                    return (
                      <td key={yr} className="text-right py-2 px-2">
                        {val != null ? (
                          <span
                            className="px-2 py-0.5 rounded text-xs text-white"
                            style={{ backgroundColor: health?.color }}
                          >
                            {(val * 100).toFixed(0)}%
                          </span>
                        ) : (
                          '—'
                        )}
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
