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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import type { DebtHealthAssessment } from '@/types/risk';
import type { RiskConfig } from '@/types';
import type { ComputedMetrics as YearMetrics } from '@/types/financial';
import { RISK_WEIGHTS, FCCR_THRESHOLDS } from '@/lib/constants';
import {
  getFCCRRiskScore,
  getDebtEBITDARiskScore,
  getDebtCapitalRiskScore,
  calculateWeightedRiskScore,
  getRiskConfig as getBaseRiskConfig,
} from '@/lib/risk-scoring';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from 'recharts';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WeightedRiskGaugeProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
  debtHealthAssessment: DebtHealthAssessment | null;
  /** Custom FCCR adjustment from FCCRBreakdown (total of all custom adjustments) */
  customFccrAdjustment?: number;
}

// ─── UI-only Risk Config Extension ────────────────────────────────────────────
// The base RiskConfig from lib/risk-scoring covers level/label/color/bgColor/textColor.
// UIRiskConfig adds scoreTextClass and scoreBgClass, which are Tailwind classes only
// used inside this component for the gauge score display and the historical table badge.

type RiskLevel = 'very-low' | 'low' | 'moderate' | 'elevated' | 'high';

interface UIRiskConfig extends RiskConfig {
  scoreTextClass: string;
  scoreBgClass: string;
}

/** Extend the base getRiskConfig with UI-only Tailwind classes for score display */
const getRiskConfig = (score: number): UIRiskConfig => {
  const base = getBaseRiskConfig(score);

  const uiFields: Record<RiskLevel, Pick<UIRiskConfig, 'scoreTextClass' | 'scoreBgClass'>> = {
    'very-low': { scoreTextClass: 'text-success',  scoreBgClass: 'bg-success' },
    'low':      { scoreTextClass: 'text-success',  scoreBgClass: 'bg-success/70' },
    'moderate': { scoreTextClass: 'text-warning',  scoreBgClass: 'bg-warning' },
    'elevated': { scoreTextClass: 'text-error',    scoreBgClass: 'bg-error/80' },
    'high':     { scoreTextClass: 'text-error',    scoreBgClass: 'bg-error' },
  };

  const semanticOverrides: Record<RiskLevel, Pick<UIRiskConfig, 'color' | 'bgColor' | 'textColor'>> = {
    'very-low': { color: '#22c55e', bgColor: 'bg-success/10',  textColor: 'text-success' },
    'low':      { color: '#84cc16', bgColor: 'bg-success/10',  textColor: 'text-success' },
    'moderate': { color: '#eab308', bgColor: 'bg-warning/10',  textColor: 'text-warning' },
    'elevated': { color: '#f97316', bgColor: 'bg-error/10',    textColor: 'text-error' },
    'high':     { color: '#ef4444', bgColor: 'bg-error/15',    textColor: 'text-error' },
  };

  return {
    ...base,
    ...semanticOverrides[base.level],
    ...uiFields[base.level],
  };
};

/** Map lending decision text to background/text styling using semantic tokens */
const getLendingDecisionStyle = (decision: string): { bg: string; text: string } => {
  const lower = decision.toLowerCase();
  if (
    lower.includes('strong approve') ||
    (lower.includes('approve') && !lower.includes('conditional'))
  ) {
    return { bg: 'bg-success/15', text: 'text-success' };
  }
  if (lower.includes('conditional')) {
    return { bg: 'bg-warning/15', text: 'text-warning' };
  }
  if (lower.includes('decline') || lower.includes('reject')) {
    return { bg: 'bg-error/15', text: 'text-error' };
  }
  return { bg: 'bg-muted', text: 'text-muted-foreground' };
};

// ─── Color helpers for Recharts (hex required — CSS classes not readable) ─────

const getFccrBarColor = (value: number | null): string => {
  if (value == null) return '#6b7280';
  if (value >= FCCR_THRESHOLDS.ADEQUATE) return '#22c55e';
  if (value >= FCCR_THRESHOLDS.WEAK) return '#eab308';
  return '#ef4444';
};

const getDebtEbitdaBarColor = (value: number | null): string => {
  if (value == null) return '#6b7280';
  if (value <= 2.5) return '#22c55e';
  if (value <= 3.5) return '#eab308';
  return '#ef4444';
};

const getDebtCapitalBarColor = (value: number | null): string => {
  if (value == null) return '#6b7280';
  if (value <= 50) return '#22c55e';
  if (value <= 65) return '#eab308';
  return '#ef4444';
};

// ─── Framer Motion Variants ────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
    },
  },
};

// ─── SVG Half-Circle Gauge ─────────────────────────────────────────────────────

// Arc circumference for radius 90: Math.PI * 90 ≈ 282.74
const ARC_LENGTH = Math.PI * 90;

const RiskGauge: React.FC<{ score: number }> = ({ score }) => {
  const config = getRiskConfig(score);
  const fillPct = Math.max(0, Math.min(1, score / 10));

  return (
    <div className="relative flex flex-col items-center w-full max-w-[220px]">
      {/* Aspect-ratio wrapper: viewBox is 200×120, clipped to upper half */}
      <div className="relative w-full overflow-hidden" style={{ paddingBottom: '55%' }}>
        <svg
          viewBox="0 0 200 120"
          width="100%"
          height="100%"
          className="absolute top-0 left-0"
        >
          {/* Track arc — muted background */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-surface-3"
            strokeLinecap="round"
          />

          {/* Zone bands — subtle tints showing Low / Moderate / High regions */}
          {/* Low risk zone: 0–40% of arc (scores 0–4) */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke="#22c55e"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeOpacity="0.22"
            strokeDasharray={`${ARC_LENGTH * 0.4} ${ARC_LENGTH * 0.6}`}
          />
          {/* Moderate zone: 40–65% of arc (scores 4–6.5) */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke="#eab308"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeOpacity="0.22"
            strokeDasharray={`${ARC_LENGTH * 0.25} ${ARC_LENGTH * 0.75}`}
            strokeDashoffset={`${-(ARC_LENGTH * 0.4)}`}
          />
          {/* High risk zone: 65–100% of arc (scores 6.5–10) */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke="#ef4444"
            strokeWidth="10"
            strokeLinecap="butt"
            strokeOpacity="0.22"
            strokeDasharray={`${ARC_LENGTH * 0.35} ${ARC_LENGTH * 0.65}`}
            strokeDashoffset={`${-(ARC_LENGTH * 0.65)}`}
          />

          {/* Active fill arc — draws on top of zone bands */}
          <path
            d="M 10 110 A 90 90 0 0 1 190 110"
            fill="none"
            stroke={config.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${ARC_LENGTH}`}
            strokeDashoffset={ARC_LENGTH * (1 - fillPct)}
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
              filter: `drop-shadow(0 0 6px ${config.color}60)`,
            }}
          />

          {/* Tick markers at 0, 2, 4, 6, 8, 10 */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((pct, i) => {
            const angle = Math.PI - pct * Math.PI;
            const x1 = 100 + 90 * Math.cos(angle);
            const y1 = 110 - 90 * Math.sin(angle);
            const x2 = 100 + 80 * Math.cos(angle);
            const y2 = 110 - 80 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-border"
              />
            );
          })}

          {/* Scale labels at the two endpoints and the apex */}
          <text x="5"   y="118" textAnchor="middle" fontSize="8" opacity="0.45" fill="currentColor">0</text>
          <text x="100" y="18"  textAnchor="middle" fontSize="8" opacity="0.45" fill="currentColor">5</text>
          <text x="195" y="118" textAnchor="middle" fontSize="8" opacity="0.45" fill="currentColor">10</text>
        </svg>

        {/* Score overlay at bottom center of arc */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-1">
          <span
            className={`text-4xl sm:text-5xl font-bold tabular-nums tracking-tighter leading-none ${config.scoreTextClass}`}
          >
            {score.toFixed(1)}
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">/ 10</span>
        </div>
      </div>

      {/* Risk label pill */}
      <div
        className={`mt-4 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide ${config.bgColor} ${config.textColor}`}
        style={{ boxShadow: `0 0 0 1px ${config.color}30` }}
      >
        {config.label}
      </div>

      {/* Zone legend — three swatches giving Low / Moderate / High scale context */}
      <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-success" />
          Low
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-warning" />
          Moderate
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-3 rounded-full bg-error" />
          High
        </span>
      </div>
    </div>
  );
};

// ─── MetricBadge ───────────────────────────────────────────────────────────────

interface MetricBadgeProps {
  label: string;
  value: number | null;
  score: number;
  format: (v: number) => string;
  weight?: number;
}

const MetricBadge: React.FC<MetricBadgeProps> = ({ label, value, score, format, weight }) => {
  const config = getRiskConfig(score);
  const severityPct = score / 10;

  return (
    <div className="relative rounded-xl border border-surface-border-1 bg-card p-4 overflow-hidden">
      {/* Left colored accent bar */}
      <div
        className="absolute left-0 inset-y-0 w-1 rounded-r-full"
        style={{ backgroundColor: config.color, opacity: 0.7 }}
      />
      <div className="pl-3">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground leading-tight">
            {label.replace(/\s*\(\d+%\)\s*\*?/, '')}
          </span>
          {weight != null && (
            <span className="text-[11px] text-muted-foreground/60 tabular-nums">
              {weight}%
            </span>
          )}
        </div>
        <span className={`text-xl font-bold tabular-nums ${config.scoreTextClass}`}>
          {value != null ? format(value) : 'N/A'}
        </span>
        {/* Mini severity progress bar */}
        <div className="mt-2 h-1 rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${severityPct * 100}%`, backgroundColor: config.color }}
          />
        </div>
      </div>
    </div>
  );
};

// ─── HistoricalChart ───────────────────────────────────────────────────────────

const historicalChartConfig = {
  value: { label: 'Value' },
} satisfies ChartConfig;

interface HistoricalChartProps {
  data: { metrics_by_year: Record<string, YearMetrics> };
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({ data }) => {
  const years = Object.keys(data.metrics_by_year).sort();

  const fccrData = years.map((year) => ({
    year,
    value: data.metrics_by_year[year].fccr ?? 0,
    raw: data.metrics_by_year[year].fccr,
  }));

  const debtEbitdaData = years.map((year) => ({
    year,
    value: data.metrics_by_year[year].senior_debt_to_ebitda ?? 0,
    raw: data.metrics_by_year[year].senior_debt_to_ebitda,
  }));

  const debtCapitalData = years.map((year) => {
    const raw = data.metrics_by_year[year].total_debt_to_capital;
    return {
      year,
      value: raw != null ? raw * 100 : 0,
      raw,
    };
  });

  return (
    <div className="space-y-8">
      {/* FCCR */}
      <div>
        <h5 className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">
          Covenant FCCR (Target: &gt; 1.25x)
        </h5>
        <ChartContainer config={historicalChartConfig} className="h-[120px] w-full">
          <BarChart
            layout="vertical"
            data={fccrData}
            margin={{ top: 0, right: 40, bottom: 0, left: 32 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => [`${Number(v).toFixed(2)}x`, 'Covenant FCCR']}
                />
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {fccrData.map((d, i) => (
                <Cell key={i} fill={getFccrBarColor(d.raw)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      {/* Senior Debt / Adj. EBITDA */}
      <div>
        <h5 className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">
          Senior Debt / Adj. EBITDA (Target: &lt; 2.5x)
        </h5>
        <ChartContainer config={historicalChartConfig} className="h-[120px] w-full">
          <BarChart
            layout="vertical"
            data={debtEbitdaData}
            margin={{ top: 0, right: 40, bottom: 0, left: 32 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => [`${Number(v).toFixed(2)}x`, 'Sr. Debt / EBITDA']}
                />
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {debtEbitdaData.map((d, i) => (
                <Cell key={i} fill={getDebtEbitdaBarColor(d.raw)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>

      {/* Debt / Capital */}
      <div>
        <h5 className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">
          Debt / Capital (Target: &lt; 50%)
        </h5>
        <ChartContainer config={historicalChartConfig} className="h-[120px] w-full">
          <BarChart
            layout="vertical"
            data={debtCapitalData}
            margin={{ top: 0, right: 40, bottom: 0, left: 32 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="year"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Debt / Capital']}
                />
              }
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {debtCapitalData.map((d, i) => (
                <Cell key={i} fill={getDebtCapitalBarColor(d.value)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const WeightedRiskGauge: React.FC<WeightedRiskGaugeProps> = ({
  data,
  debtHealthAssessment,
  customFccrAdjustment = 0,
}) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-muted-foreground">
        No metrics available for risk assessment.
      </p>
    );
  }

  // Get most recent year
  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];

  // Calculate adjusted FCCR when custom adjustments exist
  const fccrBreakdown = metrics.fccr_breakdown;
  const adjustedFccr =
    customFccrAdjustment !== 0 && fccrBreakdown && fccrBreakdown.denominator > 0
      ? parseFloat(
          (
            (fccrBreakdown.numerator + customFccrAdjustment) /
            fccrBreakdown.denominator
          ).toFixed(2),
        )
      : metrics.fccr;

  // Individual risk scores — use adjusted FCCR when available
  const fccrScore = getFCCRRiskScore(adjustedFccr);
  const debtEbitdaScore = getDebtEBITDARiskScore(metrics.senior_debt_to_ebitda);
  const debtCapitalScore = getDebtCapitalRiskScore(metrics.total_debt_to_capital);

  // Weighted composite score — delegates to lib so weights stay in sync with constants.ts
  const weightedScore = calculateWeightedRiskScore(adjustedFccr, metrics.senior_debt_to_ebitda, metrics.total_debt_to_capital);

  const riskConfig = getRiskConfig(weightedScore);

  // Use AI assessment if available; fall back to calculated values
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

  const displayScore = debtHealthAssessment?.weighted_score ?? weightedScore;
  const decisionStyle = getLendingDecisionStyle(assessment.lending_decision);

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center">
        <h3 className="text-xl font-bold tracking-tight text-foreground">
          Lending Risk Score
        </h3>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
          Fiscal Year {latestYear} | Deterministic Weighted Score
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          FCCR ({RISK_WEIGHTS.FCCR * 100}%) + Sr. Debt/EBITDA ({RISK_WEIGHTS.DEBT_EBITDA * 100}%) + Debt/Capital ({RISK_WEIGHTS.DEBT_CAPITAL * 100}%) — authoritative score for lending decisions
        </p>
      </motion.div>

      {/* Gauge + Metric Badges */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row items-center justify-center gap-8"
      >
        {/* Half-circle SVG gauge */}
        <div className="flex flex-col items-center w-full md:w-auto">
          <RiskGauge score={displayScore} />

          {/* Lending Decision verdict — prominent call-to-action banner */}
          <div
            className={`w-full mt-6 rounded-xl border-2 px-5 py-4 text-center ${decisionStyle.bg}`}
            style={{
              borderColor: `color-mix(in oklch, currentColor, transparent 55%)`,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mb-1">
              Lending Decision
            </p>
            <p className={`text-xl font-extrabold tracking-tight leading-tight ${decisionStyle.text}`}>
              {assessment.lending_decision}
            </p>
          </div>
        </div>

        {/* Component score badges */}
        <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
          <MetricBadge
            label={customFccrAdjustment !== 0 ? `Covenant FCCR (${RISK_WEIGHTS.FCCR * 100}%) *` : `Covenant FCCR (${RISK_WEIGHTS.FCCR * 100}%)`}
            value={adjustedFccr}
            score={fccrScore}
            format={(v) => `${v.toFixed(2)}x`}
            weight={RISK_WEIGHTS.FCCR * 100}
          />
          <MetricBadge
            label={`Senior Debt / Adj. EBITDA (${RISK_WEIGHTS.DEBT_EBITDA * 100}%)`}
            value={metrics.senior_debt_to_ebitda}
            score={debtEbitdaScore}
            format={(v) => `${v.toFixed(2)}x`}
            weight={RISK_WEIGHTS.DEBT_EBITDA * 100}
          />
          <MetricBadge
            label={`Total Debt / Capital (${RISK_WEIGHTS.DEBT_CAPITAL * 100}%)`}
            value={metrics.total_debt_to_capital}
            score={debtCapitalScore}
            format={(v) => `${(v * 100).toFixed(1)}%`}
            weight={RISK_WEIGHTS.DEBT_CAPITAL * 100}
          />
          {customFccrAdjustment !== 0 && (
            <div className="rounded-xl border border-surface-border-1 bg-surface-2 p-3 text-center">
              <span className="font-mono text-[11px] text-muted-foreground">
                * Covenant FCCR includes custom adjustments ($
                {customFccrAdjustment > 0 ? '+' : ''}
                {customFccrAdjustment.toLocaleString()}K)
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Lending Recommendations */}
      {(assessment.recommendations?.length > 0 || assessment.suggested_loan_structure) && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-surface-border-1 bg-surface-2 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-surface-border-1">
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
            <h4 className="font-semibold tracking-tight text-foreground">
              Lending Recommendations
            </h4>
          </div>

          {assessment.recommendations?.length > 0 && (
            <ul className="px-5 py-4 space-y-2.5">
              {assessment.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-foreground/30 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}

          {assessment.suggested_loan_structure && (
            <div className="px-5 py-3.5 border-t border-surface-border-1 bg-surface-3">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-1">
                Suggested Structure
              </p>
              <p className="text-sm text-foreground">
                {assessment.suggested_loan_structure}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Risk Factors / Positive Factors Accordions */}
      {(assessment.key_risk_factors?.length > 0 ||
        assessment.positive_factors?.length > 0) && (
        <motion.div variants={itemVariants}>
          <Accordion
            type="multiple"
            defaultValue={['risks', 'positives']}
            className="w-full space-y-3"
          >
            {assessment.key_risk_factors?.length > 0 && (
              <AccordionItem
                value="risks"
                className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-semibold text-foreground">
                      Key Risk Factors
                    </span>
                    <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">
                      {assessment.key_risk_factors.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {assessment.key_risk_factors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <TrendingDown className="h-4 w-4 text-error mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{factor}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {assessment.positive_factors?.length > 0 && (
              <AccordionItem
                value="positives"
                className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="font-semibold text-foreground">
                      Positive Factors
                    </span>
                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                      {assessment.positive_factors.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {assessment.positive_factors.map((factor, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-success mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{factor}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </motion.div>
      )}

      {/* Historical Comparison */}
      {years.length > 1 && (
        <motion.div
          variants={itemVariants}
          className="mt-6 pt-4 border-t border-surface-border-1"
        >
          <h4 className="text-sm font-semibold tracking-tight text-foreground mb-3">
            Historical Risk Score Comparison
          </h4>

          <div className="overflow-x-auto">
            <Table className="table-financial min-w-[340px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    Year
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-right text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    FCCR Score
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-right text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    Debt/EBITDA
                  </TableHead>
                  <TableHead className="hidden sm:table-cell text-right text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    Debt/Cap
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                    Weighted Score
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((year) => {
                  const ym = data.metrics_by_year[year];
                  const yFccr = getFCCRRiskScore(ym.fccr);
                  const yDebtEbitda = getDebtEBITDARiskScore(ym.senior_debt_to_ebitda);
                  const yDebtCap = getDebtCapitalRiskScore(ym.total_debt_to_capital);
                  const yWeighted = calculateWeightedRiskScore(ym.fccr, ym.senior_debt_to_ebitda, ym.total_debt_to_capital);
                  const yConfig = getRiskConfig(yWeighted);

                  return (
                    <TableRow key={year}>
                      <TableCell className="font-medium text-foreground">
                        {year}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                        {yFccr.toFixed(0)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                        {yDebtEbitda.toFixed(0)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular-nums text-muted-foreground">
                        {yDebtCap.toFixed(0)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-xs text-white font-medium tabular-nums ${yConfig.scoreBgClass}`}
                          style={{ boxShadow: `0 0 0 1px ${yConfig.color}40` }}
                        >
                          {yWeighted.toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Historical Metrics Chart */}
          <Accordion
            type="single"
            collapsible
            defaultValue="chart"
            className="w-full mt-4"
          >
            <AccordionItem
              value="chart"
              className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-semibold tracking-tight text-foreground">
                    Historical Metrics Chart
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <HistoricalChart data={data} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.div>
      )}

      {/* Credit Risk Pillar Observations - temporarily disabled */}
    </motion.div>
  );
};

export default WeightedRiskGauge;
