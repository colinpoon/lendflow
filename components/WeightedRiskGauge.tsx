'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
  ChevronRight,
  Activity,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from 'lucide-react';
import { RiskData } from '@/components/RiskAssessment';
import { QuantitativeMetricsTable } from '@/components/QuantitativeRiskCard';
import type { QuantitativeRiskAssessment } from '@/lib/quantitative-risk';

interface DebtHealthAssessment {
  weighted_score: number;
  risk_band: string;
  lending_decision: string;
  key_risk_factors: string[];
  positive_factors: string[];
  recommendations: string[];
  suggested_loan_structure: string;
}

interface YearMetrics {
  fccr: number | null;
  senior_debt_to_ebitda: number | null;
  total_debt_to_capital: number | null;
  adjusted_ebitda: number | null;
  ebitda: number | null;
  fccr_breakdown?: {
    numerator: number;
    denominator: number;
  } | null;
}

interface WeightedRiskGaugeProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
  debtHealthAssessment: DebtHealthAssessment | null;
  riskData?: RiskData | null;
  quantitativeData?: QuantitativeRiskAssessment | null;
  // Custom FCCR adjustment from FCCRBreakdown (total of all custom adjustments)
  customFccrAdjustment?: number;
}

type RiskLevel =
  | 'very-low'
  | 'low'
  | 'moderate'
  | 'elevated'
  | 'high';

interface RiskConfig {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  scoreTextClass: string;
  scoreBgClass: string;
}

// Convert FCCR to risk score (0-10, higher = worse)
const getFCCRRiskScore = (value: number | null): number => {
  if (value == null) return 5;
  if (value >= 2.0) return 1;
  if (value >= 1.5) return 3;
  if (value >= 1.2) return 5;
  if (value >= 1.0) return 7;
  if (value >= 0) return 9;
  return 10;
};

// Convert Senior Debt/EBITDA to risk score (0-10, higher = worse)
const getDebtEBITDARiskScore = (value: number | null): number => {
  if (value == null) return 5;
  if (value <= 1.5) return 1;
  if (value <= 2.5) return 3;
  if (value <= 3.0) return 5;
  if (value <= 4.0) return 7;
  return 9;
};

// Convert Total Debt/Capital to risk score (0-10, higher = worse)
const getDebtCapitalRiskScore = (value: number | null): number => {
  if (value == null) return 5;
  if (value < 0.3) return 1;
  if (value <= 0.5) return 3;
  if (value <= 0.6) return 5;
  if (value <= 0.7) return 7;
  return 9;
};

// Get risk configuration based on weighted score
const getRiskConfig = (score: number): RiskConfig => {
  if (score <= 2)
    return {
      level: 'very-low',
      label: 'Very Low Risk',
      color: '#22c55e',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      scoreTextClass: 'text-green-500',
      scoreBgClass: 'bg-green-500',
    };
  if (score <= 4)
    return {
      level: 'low',
      label: 'Low Risk',
      color: '#84cc16',
      bgColor: 'bg-lime-50',
      textColor: 'text-lime-700',
      scoreTextClass: 'text-lime-500',
      scoreBgClass: 'bg-lime-500',
    };
  if (score <= 6)
    return {
      level: 'moderate',
      label: 'Moderate Risk',
      color: '#eab308',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      scoreTextClass: 'text-yellow-500',
      scoreBgClass: 'bg-yellow-500',
    };
  if (score <= 8)
    return {
      level: 'elevated',
      label: 'Elevated Risk',
      color: '#f97316',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      scoreTextClass: 'text-orange-500',
      scoreBgClass: 'bg-orange-500',
    };
  return {
    level: 'high',
    label: 'High Risk',
    color: '#ef4444',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    scoreTextClass: 'text-red-500',
    scoreBgClass: 'bg-red-500',
  };
};

// Get lending decision styling and icon
const getLendingDecisionConfig = (
  decision: string,
): {
  bg: string;
  border: string;
  text: string;
  labelText: string;
  icon: React.ReactNode;
} => {
  const lower = decision.toLowerCase();

  if (
    lower.includes('strong approve') ||
    (lower.includes('approve') && !lower.includes('conditional'))
  ) {
    return {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      labelText: 'text-green-600',
      icon: <ThumbsUp className="h-5 w-5 text-green-600" />,
    };
  }
  if (lower.includes('conditional')) {
    return {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      labelText: 'text-yellow-600',
      icon: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    };
  }
  if (lower.includes('decline') || lower.includes('reject')) {
    return {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      labelText: 'text-red-600',
      icon: <ThumbsDown className="h-5 w-5 text-red-600" />,
    };
  }
  return {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    labelText: 'text-gray-600',
    icon: <AlertCircle className="h-5 w-5 text-gray-500" />,
  };
};

// Score badge with color coding (for historical table)
const ScoreBadge: React.FC<{ score: number; format?: string }> = ({
  score,
  format = 'raw',
}) => {
  const config = getRiskConfig(score);
  return (
    <span
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium text-white tabular-nums font-mono ${config.scoreBgClass}`}
    >
      {format === 'weighted' ? score.toFixed(1) : score.toFixed(0)}
    </span>
  );
};

const GAUGE_SIZE = 200;

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const size = GAUGE_SIZE;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const config = getRiskConfig(score);
  const percentage = Math.max(
    0,
    Math.min(100, ((10 - score) / 10) * 100),
  );
  const strokeDashoffset =
    circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-[200px] h-[200px]">
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
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      <svg
        width={size}
        height={size}
        className="absolute top-0 left-0 -rotate-90"
      >
        {Array.from({ length: 50 }).map((_, i) => {
          const angle = (i / 50) * 360;
          const isLargeTick = i % 5 === 0;
          const tickLength = isLargeTick ? 8 : 4;
          const outerRadius = radius + strokeWidth / 2 + 3;
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
              strokeWidth={isLargeTick ? 2 : 1}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-4xl font-bold tabular-nums font-mono ${config.scoreTextClass}`}
        >
          {score.toFixed(1)}
        </span>
        <span className="text-sm text-gray-500">/ 10</span>
        <span
          className={`mt-1 px-3 py-1 rounded-full text-xs font-semibold ${config.bgColor} ${config.textColor}`}
        >
          {config.label}
        </span>
      </div>
    </div>
  );
};

interface MetricBadgeProps {
  label: string;
  value: number | null;
  score: number;
  format: (v: number) => string;
}

const MetricBadge: React.FC<MetricBadgeProps> = ({
  label,
  value,
  score,
  format,
}) => {
  const config = getRiskConfig(score);

  return (
    <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
      <span className="text-xs text-gray-500 mb-1 text-center">{label}</span>
      <span className={`text-lg font-bold tabular-nums font-mono ${config.scoreTextClass}`}>
        {value != null ? format(value) : 'N/A'}
      </span>
    </div>
  );
};

// Simple bar chart component for historical metrics
interface HistoricalChartProps {
  data: { metrics_by_year: Record<string, YearMetrics> };
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({ data }) => {
  const years = Object.keys(data.metrics_by_year).sort();

  const chartData = years.map((year) => {
    const m = data.metrics_by_year[year];
    return {
      year,
      fccr: m.fccr,
      debtEbitda: m.senior_debt_to_ebitda,
      debtCapital: m.total_debt_to_capital
        ? m.total_debt_to_capital * 100
        : null,
    };
  });

  const maxFccr = Math.max(...chartData.map((d) => d.fccr ?? 0), 3);
  const maxDebtEbitda = Math.max(
    ...chartData.map((d) => d.debtEbitda ?? 0),
    5,
  );

  return (
    <div className="space-y-6">
      {/* FCCR Chart */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          FCCR (Target: &gt; 1.2x)
        </p>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`fccr-${d.year}`} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12">{d.year}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    d.fccr != null
                      ? d.fccr >= 1.2
                        ? 'bg-green-500'
                        : d.fccr >= 1.0
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                  style={{
                    width:
                      d.fccr != null
                        ? `${Math.min((d.fccr / maxFccr) * 100, 100)}%`
                        : '0%',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 tabular-nums font-mono">
                  {d.fccr != null ? `${d.fccr.toFixed(2)}x` : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Senior Debt / EBITDA Chart */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Senior Debt / EBITDA (Target: &lt; 2.5x)
        </p>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`debt-${d.year}`} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12">{d.year}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    d.debtEbitda != null
                      ? d.debtEbitda <= 2.5
                        ? 'bg-green-500'
                        : d.debtEbitda <= 3.5
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                  style={{
                    width:
                      d.debtEbitda != null
                        ? `${Math.min((d.debtEbitda / maxDebtEbitda) * 100, 100)}%`
                        : '0%',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 tabular-nums font-mono">
                  {d.debtEbitda != null
                    ? `${d.debtEbitda.toFixed(2)}x`
                    : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt / Capital Chart */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Debt / Capital (Target: &lt; 50%)
        </p>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`cap-${d.year}`} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-12">{d.year}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                    d.debtCapital != null
                      ? d.debtCapital <= 50
                        ? 'bg-green-500'
                        : d.debtCapital <= 65
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                      : 'bg-gray-300'
                  }`}
                  style={{
                    width:
                      d.debtCapital != null
                        ? `${Math.min(d.debtCapital, 100)}%`
                        : '0%',
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 tabular-nums font-mono">
                  {d.debtCapital != null
                    ? `${d.debtCapital.toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WeightedRiskGauge: React.FC<WeightedRiskGaugeProps> = ({
  data,
  debtHealthAssessment,
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  riskData,
  quantitativeData,
  customFccrAdjustment = 0,
}) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-gray-500">
        No metrics available for risk assessment.
      </p>
    );
  }

  // Get most recent year
  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];

  // Calculate adjusted FCCR if custom adjustments exist
  const fccrBreakdown = metrics.fccr_breakdown;
  const adjustedFccr =
    customFccrAdjustment !== 0 &&
    fccrBreakdown &&
    fccrBreakdown.denominator > 0
      ? parseFloat(
          (
            (fccrBreakdown.numerator + customFccrAdjustment) /
            fccrBreakdown.denominator
          ).toFixed(2),
        )
      : metrics.fccr;

  // Calculate individual risk scores (use adjusted FCCR if available)
  const fccrScore = getFCCRRiskScore(adjustedFccr);
  const debtEbitdaScore = getDebtEBITDARiskScore(
    metrics.senior_debt_to_ebitda,
  );
  const debtCapitalScore = getDebtCapitalRiskScore(
    metrics.total_debt_to_capital,
  );

  // Calculate weighted score
  const weightedScore =
    fccrScore * 0.5 +
    debtEbitdaScore * 0.35 +
    debtCapitalScore * 0.15;

  const riskConfig = getRiskConfig(weightedScore);

  // Use AI assessment if available, otherwise use calculated values
  const assessment = debtHealthAssessment || {
    weighted_score: weightedScore,
    risk_band: riskConfig.label,
    lending_decision:
      weightedScore <= 4
        ? 'Approve'
        : weightedScore <= 6
        ? 'Conditional Approval'
        : 'Further Review Required',
    key_risk_factors: [],
    positive_factors: [],
    recommendations: [],
    suggested_loan_structure: '',
  };

  const displayScore =
    debtHealthAssessment?.weighted_score ?? weightedScore;
  const decisionConfig = getLendingDecisionConfig(assessment.lending_decision);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm text-gray-500">
          Fiscal Year {latestYear} — Weighted Score Analysis
        </p>
      </div>

      {/* Main Gauge + Metric Badges */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* Large Gauge */}
        <div className="flex flex-col items-center">
          <RiskGauge score={displayScore} />
        </div>

        {/* Component Scores */}
        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
          <MetricBadge
            label={
              customFccrAdjustment !== 0
                ? 'FCCR (50%) *'
                : 'FCCR (50%)'
            }
            value={adjustedFccr}
            score={fccrScore}
            format={(v) => `${v.toFixed(2)}x`}
          />
          <MetricBadge
            label="Senior Debt / EBITDA (35%)"
            value={metrics.senior_debt_to_ebitda}
            score={debtEbitdaScore}
            format={(v) => `${v.toFixed(2)}x`}
          />
          <MetricBadge
            label="Total Debt / Capital (15%)"
            value={metrics.total_debt_to_capital}
            score={debtCapitalScore}
            format={(v) => `${(v * 100).toFixed(1)}%`}
          />
          {customFccrAdjustment !== 0 && (
            <div className="text-xs text-blue-600 bg-blue-50 rounded p-2 text-center">
              * FCCR includes custom adjustments ($
              {customFccrAdjustment > 0 ? '+' : ''}
              {customFccrAdjustment.toLocaleString()}K)
            </div>
          )}
        </div>
      </div>

      {/* Lending Decision Banner */}
      <div
        className={`w-full flex items-center gap-4 px-5 py-4 rounded-lg border ${decisionConfig.bg} ${decisionConfig.border}`}
      >
        {decisionConfig.icon}
        <div className="flex-1">
          <p
            className={`text-xs uppercase tracking-widest font-semibold ${decisionConfig.labelText}`}
          >
            Lending Decision
          </p>
          <p className={`text-xl font-bold mt-0.5 ${decisionConfig.text}`}>
            {assessment.lending_decision}
          </p>
        </div>
      </div>

      {/* Lending Recommendations Section */}
      {(assessment.recommendations?.length > 0 ||
        assessment.suggested_loan_structure) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">
              Lending Recommendations
            </h4>
          </div>

          {assessment.recommendations?.length > 0 && (
            <ul className="space-y-2">
              {assessment.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-blue-800"
                >
                  <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}

          {assessment.suggested_loan_structure && (
            <div className="bg-white rounded-lg border border-blue-100 p-3 mt-2">
              <p className="text-xs text-blue-500 uppercase tracking-wider font-semibold mb-1.5">
                Suggested Loan Structure
              </p>
              <p className="text-sm text-gray-700">
                {assessment.suggested_loan_structure}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Risk Factors Accordion — only Key Risk Factors open by default */}
      {(assessment.key_risk_factors?.length > 0 ||
        assessment.positive_factors?.length > 0) && (
        <Accordion
          type="multiple"
          defaultValue={['risks']}
          className="w-full space-y-3"
        >
          {/* Key Risk Factors */}
          {assessment.key_risk_factors?.length > 0 && (
            <AccordionItem
              value="risks"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="font-semibold text-gray-800">
                    Key Risk Factors
                  </span>
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                    {assessment.key_risk_factors.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-1">
                  {assessment.key_risk_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700">{factor}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Positive Factors */}
          {assessment.positive_factors?.length > 0 && (
            <AccordionItem
              value="positives"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-gray-800">
                    Positive Factors
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {assessment.positive_factors.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-1">
                  {assessment.positive_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700">{factor}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}

      {/* Historical Comparison Table */}
      {years.length > 1 && (
        <div className="pt-4 border-t">
          <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">
            Historical Risk Score Comparison
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Year
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    FCCR Score
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Debt/EBITDA Score
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Debt/Cap Score
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                    Weighted Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => {
                  const ym = data.metrics_by_year[year];
                  const yFccr = getFCCRRiskScore(ym.fccr);
                  const yDebtEbitda = getDebtEBITDARiskScore(
                    ym.senior_debt_to_ebitda,
                  );
                  const yDebtCap = getDebtCapitalRiskScore(
                    ym.total_debt_to_capital,
                  );
                  const yWeighted =
                    yFccr * 0.5 + yDebtEbitda * 0.35 + yDebtCap * 0.15;

                  return (
                    <tr key={year} className="border-b">
                      <td className="py-2 pr-4 font-medium">{year}</td>
                      <td className="text-right py-2 px-2">
                        <ScoreBadge score={yFccr} />
                      </td>
                      <td className="text-right py-2 px-2">
                        <ScoreBadge score={yDebtEbitda} />
                      </td>
                      <td className="text-right py-2 px-2">
                        <ScoreBadge score={yDebtCap} />
                      </td>
                      <td className="text-right py-2 px-2">
                        <ScoreBadge score={yWeighted} format="weighted" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Historical Chart Accordion */}
          <Accordion
            type="single"
            collapsible
            defaultValue="chart"
            className="w-full mt-4"
          >
            <AccordionItem
              value="chart"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <span className="font-semibold text-gray-800">
                    Historical Metrics Chart
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <HistoricalChart data={data} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Trend & Trajectory Analysis — injects quantitative metrics table */}
      {quantitativeData && (
        <div className="pt-4 border-t">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="trend-trajectory"
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-500" />
                  <span className="font-semibold text-gray-800">
                    Trend &amp; Trajectory Analysis
                  </span>
                  {quantitativeData.metrics.length > 0 && (
                    <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {quantitativeData.metrics.length} metrics
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-3">
                  {quantitativeData.trend_summary && (
                    <p className="text-xs text-gray-500">
                      {quantitativeData.trend_summary}
                    </p>
                  )}
                  {quantitativeData.metrics.length > 0 && (
                    <QuantitativeMetricsTable data={quantitativeData} />
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </div>
  );
};

export default WeightedRiskGauge;
