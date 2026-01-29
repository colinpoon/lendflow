'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { RiskData, PillarScore } from '@/components/RiskAssessment';

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
  riskData?: RiskData | null;
}

type RiskLevel = 'very-low' | 'low' | 'moderate' | 'elevated' | 'high';

interface RiskConfig {
  level: RiskLevel;
  label: string;
  color: string;
}

// Pillar keys for lending analysis
const PILLAR_KEYS = [
  'profitability_cashflow',
  'leverage',
  'liquidity',
  'debt_service',
  'interest_rate_sensitivity',
  'concentration_sector',
  'governance',
] as const;

// Pillar display names aligned with lending focus
const PILLAR_LABELS: Record<string, string> = {
  profitability_cashflow: 'Profitability & Cash Flow',
  leverage: 'Leverage Position',
  liquidity: 'Liquidity',
  debt_service: 'Debt Service Capacity',
  interest_rate_sensitivity: 'Interest Rate Exposure',
  concentration_sector: 'Industry & Concentration',
  governance: 'Management & Governance',
};

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
  if (score <= 2) return {
    level: 'very-low',
    label: 'VERY LOW',
    color: 'oklch(0.72 0.18 145)',
  };
  if (score <= 4) return {
    level: 'low',
    label: 'LOW',
    color: 'oklch(0.75 0.15 130)',
  };
  if (score <= 6) return {
    level: 'moderate',
    label: 'MODERATE',
    color: 'oklch(0.75 0.15 85)',
  };
  if (score <= 8) return {
    level: 'elevated',
    label: 'ELEVATED',
    color: 'oklch(0.70 0.18 55)',
  };
  return {
    level: 'high',
    label: 'HIGH',
    color: 'oklch(0.65 0.20 25)',
  };
};

// Get lending decision styling
const getLendingDecisionStyle = (decision: string): string => {
  const lower = decision.toLowerCase();
  if (lower.includes('strong approve') || (lower.includes('approve') && !lower.includes('conditional'))) {
    return 'text-success border-success/40 bg-success/10';
  }
  if (lower.includes('conditional')) {
    return 'text-warning border-warning/40 bg-warning/10';
  }
  if (lower.includes('decline') || lower.includes('reject')) {
    return 'text-danger border-danger/40 bg-danger/10';
  }
  return 'text-muted-foreground border-border bg-secondary';
};

// Get impact color for pillar observations
const getImpactStyle = (impact: string): string => {
  const lower = impact.toLowerCase();
  if (lower.includes('positive') || lower.includes('strong')) {
    return 'text-success bg-success/10 border-success/30';
  }
  if (lower.includes('negative') || lower.includes('weak') || lower.includes('concern')) {
    return 'text-danger bg-danger/10 border-danger/30';
  }
  if (lower.includes('manageable') || lower.includes('moderate') || lower.includes('neutral')) {
    return 'text-warning bg-warning/10 border-warning/30';
  }
  return 'text-muted-foreground bg-secondary border-border';
};

interface RiskGaugeProps {
  score: number;
  size?: number;
}

const RiskGauge: React.FC<RiskGaugeProps> = ({ score, size = 200 }) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const config = getRiskConfig(score);
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
          stroke="oklch(0.20 0.02 260)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={config.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 8px ${config.color})`,
          }}
        />
      </svg>

      {/* Tick marks */}
      <svg
        width={size}
        height={size}
        className="absolute top-0 left-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {Array.from({ length: 40 }).map((_, i) => {
          const angle = (i / 40) * 360;
          const isLargeTick = i % 4 === 0;
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
              stroke="oklch(0.30 0.02 260)"
              strokeWidth={isLargeTick ? 1.5 : 0.75}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-bold font-display"
          style={{ color: config.color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          {score.toFixed(1)}
        </motion.span>
        <span className="text-xs text-muted-foreground tracking-wider">/ 10</span>
        <motion.span
          className="mt-2 px-3 py-1 border text-[10px] font-medium tracking-widest uppercase"
          style={{
            color: config.color,
            borderColor: config.color,
            backgroundColor: `color-mix(in oklch, ${config.color} 10%, transparent)`,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          {config.label} RISK
        </motion.span>
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
    <div className="hud-panel p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground tracking-wider uppercase">{label}</span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: config.color }}
        >
          {value != null ? format(value) : '---'}
        </span>
      </div>
    </div>
  );
};

// Simple bar chart component for historical metrics
interface HistoricalChartProps {
  data: { metrics_by_year: Record<string, YearMetrics> };
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({ data }) => {
  const years = Object.keys(data.metrics_by_year).sort();

  // Calculate metrics for each year
  const chartData = years.map((year) => {
    const m = data.metrics_by_year[year];
    return {
      year,
      fccr: m.fccr,
      debtEbitda: m.senior_debt_to_ebitda,
      debtCapital: m.total_debt_to_capital ? m.total_debt_to_capital * 100 : null,
    };
  });

  // Get max values for scaling
  const maxFccr = Math.max(...chartData.map(d => d.fccr ?? 0), 3);
  const maxDebtEbitda = Math.max(...chartData.map(d => d.debtEbitda ?? 0), 5);

  const getBarColor = (value: number | null, thresholds: { good: number; warn: number }, isInverse = false) => {
    if (value == null) return 'oklch(0.25 0.02 260)';
    if (isInverse) {
      if (value <= thresholds.good) return 'oklch(0.72 0.18 145)';
      if (value <= thresholds.warn) return 'oklch(0.75 0.15 85)';
      return 'oklch(0.65 0.20 25)';
    }
    if (value >= thresholds.good) return 'oklch(0.72 0.18 145)';
    if (value >= thresholds.warn) return 'oklch(0.75 0.15 85)';
    return 'oklch(0.65 0.20 25)';
  };

  return (
    <div className="space-y-6">
      {/* FCCR Chart */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-[10px] tracking-wider uppercase">
          <span className="text-primary">[01]</span>
          <span className="text-muted-foreground">FCCR (Target: &gt; 1.2x)</span>
        </div>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`fccr-${d.year}`} className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-10 tracking-wider">{d.year}</span>
              <div className="flex-1 bg-secondary h-5 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={{ width: 0 }}
                  animate={{ width: d.fccr != null ? `${Math.min((d.fccr / maxFccr) * 100, 100)}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ backgroundColor: getBarColor(d.fccr, { good: 1.2, warn: 1.0 }) }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                  {d.fccr != null ? `${d.fccr.toFixed(2)}x` : '---'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Senior Debt / EBITDA Chart */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-[10px] tracking-wider uppercase">
          <span className="text-primary">[02]</span>
          <span className="text-muted-foreground">Senior Debt / EBITDA (Target: &lt; 2.5x)</span>
        </div>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`debt-${d.year}`} className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-10 tracking-wider">{d.year}</span>
              <div className="flex-1 bg-secondary h-5 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={{ width: 0 }}
                  animate={{ width: d.debtEbitda != null ? `${Math.min((d.debtEbitda / maxDebtEbitda) * 100, 100)}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  style={{ backgroundColor: getBarColor(d.debtEbitda, { good: 2.5, warn: 3.5 }, true) }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                  {d.debtEbitda != null ? `${d.debtEbitda.toFixed(2)}x` : '---'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt / Capital Chart */}
      <div>
        <div className="flex items-center gap-2 mb-2 text-[10px] tracking-wider uppercase">
          <span className="text-primary">[03]</span>
          <span className="text-muted-foreground">Debt / Capital (Target: &lt; 50%)</span>
        </div>
        <div className="space-y-2">
          {chartData.map((d) => (
            <div key={`cap-${d.year}`} className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-10 tracking-wider">{d.year}</span>
              <div className="flex-1 bg-secondary h-5 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={{ width: 0 }}
                  animate={{ width: d.debtCapital != null ? `${Math.min(d.debtCapital, 100)}%` : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  style={{ backgroundColor: getBarColor(d.debtCapital, { good: 50, warn: 65 }, true) }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                  {d.debtCapital != null ? `${d.debtCapital.toFixed(0)}%` : '---'}
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
  riskData,
}) => {
  if (!data || !data.metrics_by_year || Object.keys(data.metrics_by_year).length === 0) {
    return <p className="text-xs text-muted-foreground tracking-wider uppercase">No metrics available for risk assessment</p>;
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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-xs tracking-widest uppercase">
          <span className="text-primary">[!!]</span>
          <span className="text-muted-foreground">Risk Assessment</span>
        </div>
        <p className="text-[10px] text-muted-foreground tracking-wider">
          FISCAL YEAR {latestYear} | WEIGHTED SCORE ANALYSIS
        </p>
      </div>

      {/* Main Gauge Section */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-8">
        {/* Large Gauge */}
        <div className="flex flex-col items-center">
          <RiskGauge score={displayScore} size={200} />
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.3 }}
          >
            <span
              className={`inline-block px-4 py-2 border text-xs font-medium tracking-widest uppercase ${decisionStyle}`}
            >
              {assessment.lending_decision}
            </span>
          </motion.div>
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

      {/* Lending Recommendations Section */}
      {(assessment.recommendations?.length > 0 || assessment.suggested_loan_structure) && (
        <div className="hud-panel p-4">
          <div className="flex items-center gap-2 mb-3 text-xs tracking-widest uppercase">
            <ClipboardList className="h-4 w-4 text-primary" />
            <span className="text-primary">Lending Recommendations</span>
          </div>

          {assessment.recommendations?.length > 0 && (
            <ul className="space-y-2 mb-3">
              {assessment.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="text-primary">{String(idx + 1).padStart(2, '0')}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}

          {assessment.suggested_loan_structure && (
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase mb-1">Suggested Structure:</p>
              <p className="text-xs text-foreground">{assessment.suggested_loan_structure}</p>
            </div>
          )}
        </div>
      )}

      {/* Risk Factors Accordion */}
      {(assessment.key_risk_factors?.length > 0 || assessment.positive_factors?.length > 0) && (
        <Accordion type="multiple" defaultValue={['risks']} className="w-full space-y-3">
          {/* Key Risk Factors */}
          {assessment.key_risk_factors?.length > 0 && (
            <AccordionItem value="risks" className="hud-panel">
              <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span className="text-xs font-medium tracking-widest uppercase">
                    Key Risk Factors
                  </span>
                  <span className="text-[10px] text-warning border border-warning/30 px-2 py-0.5">
                    {assessment.key_risk_factors.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="space-y-2">
                  {assessment.key_risk_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingDown className="h-4 w-4 text-danger mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground">{factor}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Positive Factors */}
          {assessment.positive_factors?.length > 0 && (
            <AccordionItem value="positives" className="hud-panel">
              <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium tracking-widest uppercase">
                    Positive Factors
                  </span>
                  <span className="text-[10px] text-success border border-success/30 px-2 py-0.5">
                    {assessment.positive_factors.length}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <ul className="space-y-2">
                  {assessment.positive_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <TrendingUp className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      <span className="text-xs text-muted-foreground">{factor}</span>
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
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4 text-xs tracking-widest uppercase">
            <span className="text-primary">[##]</span>
            <span className="text-muted-foreground">Historical Risk Score Comparison</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Year</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">FCCR</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Debt/EBITDA</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Debt/Cap</th>
                  <th className="text-right py-2 px-2 text-[10px] font-medium tracking-widest uppercase text-muted-foreground">Weighted</th>
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
                    <tr key={year} className="border-b border-border/30 hover:bg-primary/5 transition-colors">
                      <td className="py-2 pr-4 font-medium text-foreground">{year}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground tabular-nums">{yFccr.toFixed(0)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground tabular-nums">{yDebtEbitda.toFixed(0)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground tabular-nums">{yDebtCap.toFixed(0)}</td>
                      <td className="text-right py-2 px-2">
                        <span
                          className="px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            color: yConfig.color,
                            backgroundColor: `color-mix(in oklch, ${yConfig.color} 15%, transparent)`,
                          }}
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
          <Accordion type="single" collapsible className="w-full mt-4">
            <AccordionItem value="chart" className="hud-panel">
              <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium tracking-widest uppercase">
                    Historical Metrics Chart
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <HistoricalChart data={data} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* Credit Risk Pillar Observations */}
      {riskData && riskData.pillars && Object.keys(riskData.pillars).length > 0 && (
        <div className="pt-4 border-t border-border">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pillars" className="hud-panel">
              <AccordionTrigger className="hover:no-underline px-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium tracking-widest uppercase">
                    Credit Risk Pillar Analysis
                  </span>
                  <span className="text-[10px] text-primary border border-primary/30 px-2 py-0.5">
                    {PILLAR_KEYS.filter(k => riskData.pillars[k]).length} PILLARS
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {PILLAR_KEYS.map((key, idx) => {
                    const p = riskData.pillars[key] as PillarScore | undefined;
                    if (!p) return null;

                    return (
                      <div key={key} className="border border-border/50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">
                            <span className="text-muted-foreground mr-2">[{String(idx + 1).padStart(2, '0')}]</span>
                            {PILLAR_LABELS[key] || key.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-2">
                            {p.impact && (
                              <span className={`text-[10px] px-2 py-0.5 border tracking-wider uppercase ${getImpactStyle(p.impact)}`}>
                                {p.impact}
                              </span>
                            )}
                            {p.score != null && (
                              <span className="text-[10px] text-muted-foreground border border-border px-2 py-0.5 tabular-nums">
                                {typeof p.score === 'number' && p.score > 10
                                  ? (p.score / 10).toFixed(1)
                                  : p.score.toFixed(1)}/10
                              </span>
                            )}
                          </div>
                        </div>
                        {p.observations && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
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
      )}
    </div>
  );
};

export default WeightedRiskGauge;
