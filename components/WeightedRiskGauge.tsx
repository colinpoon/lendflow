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
  Lightbulb,
  FileText,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

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
}

interface WeightedRiskGaugeProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
  debtHealthAssessment: DebtHealthAssessment | null;
}

type RiskLevel = 'very-low' | 'low' | 'moderate' | 'elevated' | 'high';

interface RiskConfig {
  level: RiskLevel;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
}

// Convert FCCR to risk score (0-10, higher = worse)
// FCCR: Higher is better, so invert the scoring
const getFCCRRiskScore = (value: number | null): number => {
  if (value == null) return 5; // Default to moderate if missing
  if (value >= 2.0) return 1;   // Excellent
  if (value >= 1.5) return 3;   // Good
  if (value >= 1.2) return 5;   // Adequate
  if (value >= 1.0) return 7;   // Weak
  if (value >= 0) return 9;     // Poor but positive
  return 10;                    // Negative FCCR is worst
};

// Convert Senior Debt/EBITDA to risk score (0-10, higher = worse)
// Lower ratio is better
const getDebtEBITDARiskScore = (value: number | null): number => {
  if (value == null) return 5;
  if (value <= 1.5) return 1;   // Excellent
  if (value <= 2.5) return 3;   // Good
  if (value <= 3.0) return 5;   // Adequate
  if (value <= 4.0) return 7;   // Weak
  return 9;                     // Poor
};

// Convert Total Debt/Capital to risk score (0-10, higher = worse)
// Lower ratio is better
const getDebtCapitalRiskScore = (value: number | null): number => {
  if (value == null) return 5;
  if (value < 0.3) return 1;    // Excellent
  if (value <= 0.5) return 3;   // Good
  if (value <= 0.6) return 5;   // Adequate
  if (value <= 0.7) return 7;   // Weak
  return 9;                     // Poor
};

// Get risk configuration based on weighted score
const getRiskConfig = (score: number): RiskConfig => {
  if (score <= 2) return {
    level: 'very-low',
    label: 'Very Low Risk',
    color: '#22c55e',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  };
  if (score <= 4) return {
    level: 'low',
    label: 'Low Risk',
    color: '#84cc16',
    bgColor: 'bg-lime-50',
    textColor: 'text-lime-700',
  };
  if (score <= 6) return {
    level: 'moderate',
    label: 'Moderate Risk',
    color: '#eab308',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
  };
  if (score <= 8) return {
    level: 'elevated',
    label: 'Elevated Risk',
    color: '#f97316',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  };
  return {
    level: 'high',
    label: 'High Risk',
    color: '#ef4444',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  };
};

// Get lending decision styling
const getLendingDecisionStyle = (decision: string): { bg: string; text: string } => {
  const lower = decision.toLowerCase();
  if (lower.includes('strong approve') || lower.includes('approve') && !lower.includes('conditional')) {
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

interface RiskGaugeProps {
  score: number;
  size?: number;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, size = 200 }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const config = getRiskConfig(score);
  // Convert score (0-10) to percentage for gauge (invert so low risk shows more fill)
  const percentage = Math.max(0, Math.min(100, ((10 - score) / 10) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
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
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Tick marks */}
      <svg
        width={size}
        height={size}
        className="absolute top-0 left-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {Array.from({ length: 50 }).map((_, i) => {
          const angle = (i / 50) * 360;
          const isLargeTick = i % 5 === 0;
          const tickLength = isLargeTick ? 8 : 4;
          const outerRadius = radius + strokeWidth / 2 + 3;
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
              strokeWidth={isLargeTick ? 2 : 1}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color: config.color }}>
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
      <span
        className="text-lg font-bold"
        style={{ color: config.color }}
      >
        {value != null ? format(value) : 'N/A'}
      </span>
    </div>
  );
};

const WeightedRiskGauge: React.FC<WeightedRiskGaugeProps> = ({
  data,
  debtHealthAssessment,
}) => {
  if (!data || !data.metrics_by_year || Object.keys(data.metrics_by_year).length === 0) {
    return <p className="text-gray-500">No metrics available for risk assessment.</p>;
  }

  // Get most recent year
  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];

  // Calculate individual risk scores
  const fccrScore = getFCCRRiskScore(metrics.fccr);
  const debtEbitdaScore = getDebtEBITDARiskScore(metrics.senior_debt_to_ebitda);
  const debtCapitalScore = getDebtCapitalRiskScore(metrics.total_debt_to_capital);

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
    lending_decision: weightedScore <= 4 ? 'Approve' : weightedScore <= 6 ? 'Conditional Approval' : 'Further Review Required',
    key_risk_factors: [],
    positive_factors: [],
    recommendations: [],
    suggested_loan_structure: '',
  };

  const displayScore = debtHealthAssessment?.weighted_score ?? weightedScore;
  const decisionStyle = getLendingDecisionStyle(assessment.lending_decision);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-800">
          Debt Health Risk Assessment
        </h3>
        <p className="text-sm text-gray-500">
          Fiscal Year {latestYear} | Weighted Score Analysis
        </p>
      </div>

      {/* Main Gauge Section */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* Large Gauge */}
        <div className="flex flex-col items-center">
          <RiskGauge score={displayScore} size={200} />
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
            label="FCCR (50%)"
            value={metrics.fccr}
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
            format={(v) => `${(v * 100).toFixed(0)}%`}
          />
        </div>
      </div>

      {/* AI Recommendations */}
      {(assessment.key_risk_factors?.length > 0 ||
        assessment.positive_factors?.length > 0 ||
        assessment.recommendations?.length > 0 ||
        assessment.suggested_loan_structure) && (
        <Accordion type="multiple" defaultValue={['risks', 'recommendations']} className="w-full space-y-3">
          {/* Key Risk Factors */}
          {assessment.key_risk_factors?.length > 0 && (
            <AccordionItem value="risks" className="border rounded-lg px-4">
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
                      <span className="text-sm text-gray-700">{factor}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Positive Factors */}
          {assessment.positive_factors?.length > 0 && (
            <AccordionItem value="positives" className="border rounded-lg px-4">
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
                      <span className="text-sm text-gray-700">{factor}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Recommendations */}
          {assessment.recommendations?.length > 0 && (
            <AccordionItem value="recommendations" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-blue-500" />
                  <span className="font-semibold text-gray-800">
                    Recommendations
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {assessment.recommendations.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {assessment.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold mt-0.5">•</span>
                      <span className="text-sm text-gray-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Suggested Loan Structure */}
          {assessment.suggested_loan_structure && (
            <AccordionItem value="structure" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-500" />
                  <span className="font-semibold text-gray-800">
                    Suggested Loan Structure
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    {assessment.suggested_loan_structure}
                  </p>
                </div>
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
                  <th className="text-right py-2 px-2">Debt/EBITDA Score</th>
                  <th className="text-right py-2 px-2">Debt/Cap Score</th>
                  <th className="text-right py-2 px-2">Weighted Score</th>
                </tr>
              </thead>
              <tbody>
                {years.map((year) => {
                  const ym = data.metrics_by_year[year];
                  const yFccr = getFCCRRiskScore(ym.fccr);
                  const yDebtEbitda = getDebtEBITDARiskScore(ym.senior_debt_to_ebitda);
                  const yDebtCap = getDebtCapitalRiskScore(ym.total_debt_to_capital);
                  const yWeighted = yFccr * 0.5 + yDebtEbitda * 0.35 + yDebtCap * 0.15;
                  const yConfig = getRiskConfig(yWeighted);

                  return (
                    <tr key={year} className="border-b">
                      <td className="py-2 pr-4 font-medium">{year}</td>
                      <td className="text-right py-2 px-2">{yFccr.toFixed(0)}</td>
                      <td className="text-right py-2 px-2">{yDebtEbitda.toFixed(0)}</td>
                      <td className="text-right py-2 px-2">{yDebtCap.toFixed(0)}</td>
                      <td className="text-right py-2 px-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{ backgroundColor: yConfig.color }}
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
        </div>
      )}
    </div>
  );
};

export default WeightedRiskGauge;
