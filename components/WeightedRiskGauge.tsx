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
} from 'lucide-react';
import { RiskData } from '@/components/RiskAssessment';

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

// Get lending decision styling
const getLendingDecisionStyle = (
  decision: string,
): { bg: string; text: string } => {
  const lower = decision.toLowerCase();
  if (
    lower.includes('strong approve') ||
    (lower.includes('approve') && !lower.includes('conditional'))
  ) {
    return { bg: 'bg-green-100', text: 'text-green-800' };
  }
  if (lower.includes('conditional')) {
    return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  }
  if (lower.includes('decline') || lower.includes('reject')) {
    return { bg: 'bg-red-100', text: 'text-red-800' };
  }
  return { bg: 'bg-gray-100', text: 'text-gray-800' };
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
    <div className="relative w-50 h-50">
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
          className={`text-4xl font-bold ${config.scoreTextClass}`}
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
      <span className="text-xs text-gray-500 mb-1">{label}</span>
      <span className={`text-lg font-bold ${config.scoreTextClass}`}>
        {value != null ? format(value) : 'N/A'}
      </span>
    </div>
  );
};

// Simple bar chart component for historical metrics
interface HistoricalChartProps {
  data: { metrics_by_year: Record<string, YearMetrics> };
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({
  data,
}) => {
  const years = Object.keys(data.metrics_by_year).sort();

  // Calculate metrics for each year
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

  // Get max values for scaling
  const maxFccr = Math.max(...chartData.map((d) => d.fccr ?? 0), 3);
  const maxDebtEbitda = Math.max(
    ...chartData.map((d) => d.debtEbitda ?? 0),
    5,
  );

  return (
    <div className="space-y-6">
      {/* FCCR Chart */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 mb-2">
          FCCR (Target: &gt; 1.2x)
        </h5>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div
              key={`fccr-${d.year}`}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-gray-500 w-12">
                {d.year}
              </span>
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
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                  {d.fccr != null ? `${d.fccr.toFixed(2)}x` : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Senior Debt / EBITDA Chart */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 mb-2">
          Senior Debt / EBITDA (Target: &lt; 2.5x)
        </h5>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div
              key={`debt-${d.year}`}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-gray-500 w-12">
                {d.year}
              </span>
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
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
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
        <h5 className="text-sm font-medium text-gray-700 mb-2">
          Debt / Capital (Target: &lt; 50%)
        </h5>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div
              key={`cap-${d.year}`}
              className="flex items-center gap-2"
            >
              <span className="text-xs text-gray-500 w-12">
                {d.year}
              </span>
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
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
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
  const decisionStyle = getLendingDecisionStyle(
    assessment.lending_decision,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-800">
          Risk Assessment
        </h3>
        <p className="text-sm text-gray-500">
          Fiscal Year {latestYear} | Weighted Score Analysis
        </p>
      </div>

      {/* Main Gauge Section */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* Large Gauge */}
        <div className="flex flex-col items-center">
          <RiskGauge score={displayScore} />
          <div className="mt-4 text-center">
            <span
              className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${decisionStyle.bg} ${decisionStyle.text}`}
            >
              {assessment.lending_decision}
            </span>
          </div>
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

      {/* Lending Recommendations Section */}
      {(assessment.recommendations?.length > 0 ||
        assessment.suggested_loan_structure) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">
              Lending Recommendations
            </h4>
          </div>

          {assessment.recommendations?.length > 0 && (
            <ul className="space-y-2 mb-3">
              {assessment.recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-blue-800"
                >
                  <span className="text-blue-500 font-bold mt-0.5">
                    -
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}

          {assessment.suggested_loan_structure && (
            <div className="bg-white rounded p-3 mt-2">
              <p className="text-xs text-gray-500 mb-1">
                Suggested Structure:
              </p>
              <p className="text-sm text-gray-700">
                {assessment.suggested_loan_structure}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Risk Factors Accordion */}
      {(assessment.key_risk_factors?.length > 0 ||
        assessment.positive_factors?.length > 0) && (
        <Accordion
          type="multiple"
          defaultValue={['risks', 'positives']}
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
                <ul className="space-y-2">
                  {assessment.key_risk_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700">
                        {factor}
                      </span>
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
                <ul className="space-y-2">
                  {assessment.positive_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-700">
                        {factor}
                      </span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      )}

      {/* Historical Comparison */}
      {years.length > 1 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Historical Risk Score Comparison
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Year</th>
                  <th className="text-right py-2 px-2">FCCR Score</th>
                  <th className="text-right py-2 px-2">
                    Debt/EBITDA Score
                  </th>
                  <th className="text-right py-2 px-2">
                    Debt/Cap Score
                  </th>
                  <th className="text-right py-2 px-2">
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
                    yFccr * 0.5 +
                    yDebtEbitda * 0.35 +
                    yDebtCap * 0.15;
                  const yConfig = getRiskConfig(yWeighted);

                  return (
                    <tr key={year} className="border-b">
                      <td className="py-2 pr-4 font-medium">
                        {year}
                      </td>
                      <td className="text-right py-2 px-2">
                        {yFccr.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {yDebtEbitda.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2">
                        {yDebtCap.toFixed(0)}
                      </td>
                      <td className="text-right py-2 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs text-white font-medium ${yConfig.scoreBgClass}`}
                        >
                          {yWeighted.toFixed(1)}
                        </span>
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

      {/* Credit Risk Pillar Observations - temporarily disabled */}
      {/* {riskData && riskData.pillars && Object.keys(riskData.pillars).length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <Accordion type="single" collapsible defaultValue="pillars" className="w-full">
            <AccordionItem value="pillars" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="font-semibold text-gray-800">
                    Credit Risk Pillar Analysis
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    {PILLAR_KEYS.filter(k => riskData.pillars[k]).length} pillars
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {PILLAR_KEYS.map((key) => {
                    const p = riskData.pillars[key] as PillarScore | undefined;
                    if (!p) return null;

                    return (
                      <div key={key} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-800 text-sm">
                            {PILLAR_LABELS[key] || key.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            {p.impact && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getImpactStyle(p.impact)}`}>
                                {p.impact}
                              </span>
                            )}
                            {p.score != null && (
                              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                {typeof p.score === 'number' && p.score > 10
                                  ? (p.score / 10).toFixed(1)
                                  : p.score.toFixed(1)}/10
                              </span>
                            )}
                          </div>
                        </div>
                        {p.observations && (
                          <p className="text-xs text-gray-600">
                            {typeof p.observations === 'string' ? p.observations : ''}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )} */}
    </div>
  );
};

export default WeightedRiskGauge;
