'use client';

/**
 * FinancialAnalysisDashboard.tsx — v2 Innovative Redesign
 *
 * Layout & visual innovations vs traditional financial dashboards:
 *   1. Animated SVG semicircular risk gauge as hero focal point
 *   2. Horizontal ratio gauge bars with prior-year markers replace static tables
 *   3. "Earnings Flow" — revenue through CFADS in one continuous narrative panel
 *   4. Sticky bottom covenant toolbar — always-accessible parameter controls
 *   5. Compact detail cards in a 2-col grid — replaces monolithic table sections
 *   6. Fraction-style formula notation for the audit panel
 *   7. Asymmetric bento grid: risk gauge is visually dominant, data splits into
 *      two unequal columns (earnings 55% | credit health 45%)
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  Home,
  Pencil,
  Check,
  Upload,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GAUGE_COLORS } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Sentiment = 'good' | 'warn' | 'bad' | 'neutral';

interface KPIData {
  label: string;
  value: string;
  status: string;
  sentiment: Sentiment;
  trend?: { direction: 'up' | 'down'; label: string; isPositive: boolean };
}

interface FlowRow {
  label: string;
  values: (number | string)[];
  type: 'normal' | 'addback' | 'deduction' | 'total' | 'divider';
  dividerLabel?: string;
}

interface RatioConfig {
  label: string;
  values: [string, string];
  numeric: [number, number];
  max: number;
  thresholds: { good: number; warn: number };
  higherIsBetter: boolean;
  flagged: boolean;
}

interface DetailRow {
  label: string;
  values: (number | string)[];
  isTotal?: boolean;
}

interface DetailSection {
  id: string;
  title: string;
  rows: DetailRow[];
}

interface FormulaCardData {
  metric: string;
  numeratorLabel: string;
  denominatorLabel: string;
  years: {
    year: number;
    numerator: string;
    denominator: string;
    result: string;
    sentiment: Sentiment;
  }[];
}

interface CovenantConfig {
  capexTreatment: 'unfunded' | 'all' | 'none' | 'custom';
  customCapexPercent: number;
  includeLeaseDebt: boolean;
  includeOperatingLeases: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style Constants
// ─────────────────────────────────────────────────────────────────────────────

const SENTIMENT = {
  good: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  warn: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  bad: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    bar: 'bg-red-500',
    dot: 'bg-red-500',
  },
  neutral: {
    text: 'text-foreground',
    bg: 'bg-muted',
    badge: 'bg-muted text-muted-foreground',
    bar: 'bg-foreground/30',
    dot: 'bg-muted-foreground',
  },
} as const;

function getSentiment(
  value: number,
  thresholds: { good: number; warn: number },
  higherIsBetter: boolean
): Sentiment {
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warn) return 'warn';
    return 'bad';
  }
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.warn) return 'warn';
  return 'bad';
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number | string): string {
  if (typeof value === 'string') return value;
  const abs = Math.abs(value);
  if (value < 0) return `($${abs.toLocaleString('en-US')}K)`;
  return `$${abs.toLocaleString('en-US')}K`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT = {
  name: 'petvalu test',
  subtitle: 'Financial Analysis Project',
  years: [2024, 2023] as const,
  document: {
    name: 'PetValu_Q4_2024_FinancialStatements.pdf',
    range: '2023–2024',
  },
};

const BASE_KPIS: KPIData[] = [
  {
    label: 'Covenant FCCR',
    value: '0.64x',
    status: 'Below Threshold',
    sentiment: 'bad',
    trend: { direction: 'up', label: '+0.01x', isPositive: true },
  },
  {
    label: 'SR Debt / Adj. EBITDA',
    value: '3.55x',
    status: 'Elevated',
    sentiment: 'warn',
    trend: { direction: 'up', label: '+0.34x', isPositive: false },
  },
  {
    label: 'Total Debt / Capital',
    value: '88.7%',
    status: 'Leveraged',
    sentiment: 'warn',
    trend: { direction: 'down', label: '−2.7%', isPositive: true },
  },
];

const EARNINGS_FLOW: FlowRow[] = [
  { label: 'Revenue', values: [1097193, 1005667], type: 'normal' },
  { label: 'Net Income', values: [87420, 89548], type: 'total' },
  { label: 'Net Profit Margin', values: ['8.0%', '8.9%'], type: 'normal' },
  { label: 'EBITDA Bridge', values: [], type: 'divider', dividerLabel: 'EBITDA Bridge' },
  { label: '+ Interest Expense', values: [32103, 35646], type: 'addback' },
  { label: '+ Taxes', values: [33964, 35626], type: 'addback' },
  { label: '+ Depreciation & Amortization', values: [65913, 50719], type: 'addback' },
  { label: 'EBITDA', values: [219400, 227418], type: 'total' },
  { label: 'Adjustments', values: [], type: 'divider', dividerLabel: 'Adjustments' },
  { label: '+ Stock-Based Compensation', values: [7947, 8212], type: 'addback' },
  { label: '− Gain on Sale of Assets', values: [4633, 1224], type: 'deduction' },
  { label: '− Non-Recurring Income', values: [11839, 4654], type: 'deduction' },
  { label: 'Adjusted EBITDA', values: [210875, 229752], type: 'total' },
  { label: 'CFADS', values: [], type: 'divider', dividerLabel: 'Cash Available for Debt Service' },
  { label: '− Capital Expenditures', values: [60612, 57291], type: 'deduction' },
  { label: '− Cash Taxes Paid', values: [31213, 56451], type: 'deduction' },
  { label: 'CFADS', values: [87580, 87474], type: 'total' },
];

const RATIO_CONFIGS: RatioConfig[] = [
  { label: 'Covenant FCCR', values: ['0.64x', '0.63x'], numeric: [0.64, 0.63], max: 3.0, thresholds: { good: 1.2, warn: 1.0 }, higherIsBetter: true, flagged: true },
  { label: 'EBITDA Coverage', values: ['1.55x', '1.64x'], numeric: [1.55, 1.64], max: 4.0, thresholds: { good: 1.5, warn: 1.0 }, higherIsBetter: true, flagged: false },
  { label: 'SR Debt / Adj. EBITDA', values: ['3.55x', '3.21x'], numeric: [3.55, 3.21], max: 6.0, thresholds: { good: 3.0, warn: 4.0 }, higherIsBetter: false, flagged: true },
  { label: 'Funded Debt / EBITDA', values: ['3.55x', '3.21x'], numeric: [3.55, 3.21], max: 6.0, thresholds: { good: 3.0, warn: 4.0 }, higherIsBetter: false, flagged: true },
  { label: 'Total Debt / Capital', values: ['88.7%', '91.4%'], numeric: [88.7, 91.4], max: 100, thresholds: { good: 50, warn: 70 }, higherIsBetter: false, flagged: true },
  { label: 'Interest Coverage', values: ['6.83x', '7.42x'], numeric: [6.83, 7.42], max: 10, thresholds: { good: 3.0, warn: 2.0 }, higherIsBetter: true, flagged: false },
  { label: 'Current Ratio', values: ['1.34x', '1.38x'], numeric: [1.34, 1.38], max: 3.0, thresholds: { good: 1.5, warn: 1.0 }, higherIsBetter: true, flagged: false },
  { label: 'Debt / Equity', values: ['7.83x', '10.57x'], numeric: [7.83, 10.57], max: 12.0, thresholds: { good: 2.0, warn: 4.0 }, higherIsBetter: false, flagged: true },
];

const DETAIL_SECTIONS: DetailSection[] = [
  {
    id: 'capital-structure',
    title: 'Capital Structure',
    rows: [
      { label: 'Total Debt', values: [749294, 737125] },
      { label: 'Senior Debt', values: [749294, 737125] },
      { label: 'Funded Debt', values: [749294, 737125] },
      { label: "Shareholders' Equity", values: [95749, 69720] },
      { label: 'Current Assets', values: [246510, 236135] },
      { label: 'Current Liabilities', values: [184420, 172247] },
    ],
  },
  {
    id: 'debt-service',
    title: 'Debt Service (Fixed Charges)',
    rows: [
      { label: 'Senior Interest Payments', values: [13312, 14891] },
      { label: 'Lease Payments', values: [46258, 45100] },
      { label: 'Scheduled Principal', values: [76881, 79851] },
      { label: 'Total Fixed Charges', values: [136449, 139842], isTotal: true },
    ],
  },
  {
    id: 'senior-facilities',
    title: 'Senior Facilities',
    rows: [
      { label: 'Term Loan A', values: [350000, 375000] },
      { label: 'Revolving Credit Facility', values: [199294, 162125] },
      { label: 'Term Loan B', values: [200000, 200000] },
      { label: 'Total Senior Debt', values: [749294, 737125], isTotal: true },
    ],
  },
  {
    id: 'lease-liabilities',
    title: 'Lease Liabilities',
    rows: [
      { label: 'Finance Leases', values: [0, 0] },
      { label: 'Operating Leases (Capitalized)', values: [0, 0] },
      { label: 'Total Lease Debt', values: [0, 0], isTotal: true },
    ],
  },
];

const FORMULA_CARDS: FormulaCardData[] = [
  {
    metric: 'Adjusted EBITDA',
    numeratorLabel: 'EBITDA + Adjustments',
    denominatorLabel: '',
    years: [
      { year: 2024, numerator: '219,400 + 7,947 − 4,633 − 11,839', denominator: '', result: '210,875', sentiment: 'neutral' },
      { year: 2023, numerator: '227,418 + 8,212 − 1,224 − 4,654', denominator: '', result: '229,752', sentiment: 'neutral' },
    ],
  },
  {
    metric: 'Covenant FCCR',
    numeratorLabel: 'CFADS',
    denominatorLabel: 'Fixed Charges',
    years: [
      { year: 2024, numerator: '87,580', denominator: '136,449', result: '0.64x', sentiment: 'bad' },
      { year: 2023, numerator: '87,474', denominator: '139,842', result: '0.63x', sentiment: 'bad' },
    ],
  },
  {
    metric: 'SR Debt / Adj. EBITDA',
    numeratorLabel: 'Senior Debt',
    denominatorLabel: 'Adj. EBITDA',
    years: [
      { year: 2024, numerator: '749,294', denominator: '210,875', result: '3.55x', sentiment: 'warn' },
      { year: 2023, numerator: '737,125', denominator: '229,752', result: '3.21x', sentiment: 'warn' },
    ],
  },
  {
    metric: 'Total Debt / Capital',
    numeratorLabel: 'Total Debt',
    denominatorLabel: 'Total Capital',
    years: [
      { year: 2024, numerator: '749,294', denominator: '845,043', result: '88.7%', sentiment: 'warn' },
      { year: 2023, numerator: '737,125', denominator: '806,845', result: '91.4%', sentiment: 'warn' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock Recalculation
// ─────────────────────────────────────────────────────────────────────────────

function recalculate(config: CovenantConfig) {
  let fccr = 0.64;
  let srDebt = 3.55;
  let debtCap = 88.7;

  if (config.capexTreatment === 'all') fccr = 0.52;
  else if (config.capexTreatment === 'none') fccr = 1.15;
  else if (config.capexTreatment === 'custom')
    fccr = 0.64 + 0.51 * (1 - config.customCapexPercent / 100);

  if (config.includeLeaseDebt) {
    srDebt = 4.1;
    debtCap = 91.2;
  }
  if (config.includeOperatingLeases) fccr *= 0.92;

  const fccrS: Sentiment = fccr >= 1.2 ? 'good' : fccr >= 1.0 ? 'warn' : 'bad';
  const srS: Sentiment = srDebt <= 3.0 ? 'good' : srDebt <= 4.0 ? 'warn' : 'bad';
  const dcS: Sentiment = debtCap <= 60 ? 'good' : debtCap <= 80 ? 'warn' : 'bad';

  const kpis: KPIData[] = [
    {
      label: 'Covenant FCCR',
      value: `${fccr.toFixed(2)}x`,
      status: fccr >= 1.2 ? 'Adequate' : fccr >= 1.0 ? 'Marginal' : 'Below Threshold',
      sentiment: fccrS,
      trend: BASE_KPIS[0].trend,
    },
    {
      label: 'SR Debt / Adj. EBITDA',
      value: `${srDebt.toFixed(2)}x`,
      status: srDebt <= 3.0 ? 'Healthy' : srDebt <= 4.0 ? 'Elevated' : 'High',
      sentiment: srS,
      trend: BASE_KPIS[1].trend,
    },
    {
      label: 'Total Debt / Capital',
      value: `${debtCap.toFixed(1)}%`,
      status: debtCap <= 60 ? 'Healthy' : debtCap <= 80 ? 'Leveraged' : 'Highly Leveraged',
      sentiment: dcS,
      trend: BASE_KPIS[2].trend,
    },
  ];

  // Update ratio configs with new values
  const ratios = RATIO_CONFIGS.map((r) => {
    if (r.label === 'Covenant FCCR') return { ...r, values: [`${fccr.toFixed(2)}x`, r.values[1]] as [string, string], numeric: [fccr, r.numeric[1]] as [number, number] };
    if (r.label === 'SR Debt / Adj. EBITDA') return { ...r, values: [`${srDebt.toFixed(2)}x`, r.values[1]] as [string, string], numeric: [srDebt, r.numeric[1]] as [number, number] };
    if (r.label === 'Total Debt / Capital') return { ...r, values: [`${debtCap.toFixed(1)}%`, r.values[1]] as [string, string], numeric: [debtCap, r.numeric[1]] as [number, number] };
    return r;
  });

  return { kpis, ratios, riskScore: 8 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Animated semicircular SVG risk gauge */
function RiskGauge({ score }: { score: number }) {
  const pct = score / 100;
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setAnimated(true); }, []);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 115" className="w-full max-w-[220px]">
        <defs>
          <linearGradient id="riskArc" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={GAUGE_COLORS.green} />
            <stop offset="45%" stopColor={GAUGE_COLORS.yellow} />
            <stop offset="100%" stopColor={GAUGE_COLORS.red} />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          className="stroke-border"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Filled arc — CSS transition replaces framer-motion */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#riskArc)"
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1"
          style={{
            strokeDashoffset: animated ? 1 - pct : 1,
            transition: 'stroke-dashoffset 1.2s ease-out 0.2s',
          }}
        />

        {/* Score */}
        <text
          x="100"
          y="78"
          textAnchor="middle"
          className="fill-foreground"
          fontSize="44"
          fontWeight="800"
        >
          {score}
        </text>
        <text
          x="100"
          y="100"
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="14"
        >
          / 100
        </text>
      </svg>

      <span
        className={cn(
          'mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
          SENTIMENT.good.badge
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', SENTIMENT.good.dot)} />
        Low Risk
      </span>
    </div>
  );
}

/** Compact KPI card used next to the risk gauge */
function KPICard({ kpi }: { kpi: KPIData }) {
  const s = SENTIMENT[kpi.sentiment];
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium text-muted-foreground">
        {kpi.label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={cn('text-2xl font-bold tabular-nums', s.text)}>
          {kpi.value}
        </span>
        {kpi.trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[11px] font-medium',
              kpi.trend.isPositive ? SENTIMENT.good.text : SENTIMENT.bad.text
            )}
          >
            {kpi.trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {kpi.trend.label}
          </span>
        )}
      </div>
      <span className={cn('mt-2 self-start rounded-full px-2 py-0.5 text-[11px] font-medium', s.badge)}>
        {kpi.status}
      </span>
    </div>
  );
}

/** Pill-style tab bar */
function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  const tabs = ['Analysis', 'Risk', 'Decision'];
  return (
    <div className="sticky top-0 z-20 -mx-6 flex items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <nav className="flex gap-1 py-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={active === t.toLowerCase()}
            onClick={() => onChange(t.toLowerCase())}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              active === t.toLowerCase()
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      {/* Document chip inline */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{PROJECT.document.name}</span>
        <span className="text-[10px]">({PROJECT.document.range})</span>
      </div>
    </div>
  );
}

/** Toggle switch */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-foreground' : 'bg-border'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

// ─── Earnings Flow ──────────────────────────────────────────────────────────

function EarningsFlow({ years }: { years: readonly number[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Earnings Flow</h3>
        <span className="text-[10px] font-medium text-muted-foreground">
          Values in Thousands
        </span>
      </div>

      {/* Column headers */}
      <div
        className="grid items-center border-b border-border bg-muted/50 px-4 py-2"
        style={{ gridTemplateColumns: '1fr 120px 120px' }}
      >
        <span className="text-[11px] font-semibold text-muted-foreground">
          Line Item
        </span>
        {years.map((y) => (
          <span
            key={y}
            className="text-right text-[11px] font-semibold text-muted-foreground"
          >
            {y}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div>
        {EARNINGS_FLOW.map((row, i) => {
          if (row.type === 'divider') {
            return (
              <div
                key={`div-${i}`}
                className="flex items-center gap-2 px-4 py-1.5"
              >
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {row.dividerLabel}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            );
          }

          return (
            <div
              key={row.label + i}
              className={cn(
                'grid items-center px-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                row.type === 'total'
                  ? 'border-t border-border bg-muted/20 py-2 font-semibold'
                  : 'py-1.5',
                i % 2 === 0 &&
                  row.type !== 'total' &&
                  'bg-black/[0.01] dark:bg-white/[0.01]'
              )}
              style={{ gridTemplateColumns: '1fr 120px 120px' }}
            >
              <span
                className={cn(
                  'text-sm',
                  row.type === 'total' ? 'font-semibold' : '',
                  (row.type === 'addback' || row.type === 'deduction') &&
                    'pl-4 text-muted-foreground'
                )}
              >
                {row.label}
              </span>
              {row.values.map((v, vi) => (
                <span
                  key={vi}
                  className={cn(
                    'text-right text-sm tabular-nums',
                    row.type === 'total' && 'font-semibold'
                  )}
                >
                  {fmt(v)}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Credit Health Gauge Panel ──────────────────────────────────────────────

function RatioBar({ ratio, index }: { ratio: RatioConfig; index: number }) {
  const sentiment = getSentiment(ratio.numeric[0], ratio.thresholds, ratio.higherIsBetter);
  const fillPct = Math.min((ratio.numeric[0] / ratio.max) * 100, 100);
  const priorPct = Math.min((ratio.numeric[1] / ratio.max) * 100, 100);
  const goodPct = (ratio.thresholds.good / ratio.max) * 100;
  const warnPct = (ratio.thresholds.warn / ratio.max) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs">{ratio.label}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              SENTIMENT[sentiment].text
            )}
          >
            {ratio.values[0]}
          </span>
          {ratio.flagged && (
            <span className={cn('h-1.5 w-1.5 rounded-full', SENTIMENT[sentiment].dot)} />
          )}
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        {/* Threshold markers */}
        <div
          className="absolute top-0 z-10 h-full w-px bg-foreground/25"
          style={{ left: `${goodPct}%` }}
        />
        <div
          className="absolute top-0 z-10 h-full w-px bg-foreground/15"
          style={{ left: `${warnPct}%` }}
        />

        {/* Prior year marker */}
        <div
          className="absolute top-[-1px] z-10 h-[calc(100%+2px)] w-[3px] rounded-full bg-foreground/20"
          style={{ left: `${priorPct}%` }}
          title={`${ratio.values[1]} (${PROJECT.years[1]})`}
        />

        {/* Current fill — CSS animation replaces framer-motion */}
        <div
          className={cn('h-full rounded-full', SENTIMENT[sentiment].bar)}
          style={{
            width: `${fillPct}%`,
            animation: `fill-bar 0.8s ease-out ${150 + index * 60}ms both`,
          }}
        />
      </div>

      {/* Prior year annotation */}
      <p className="text-[10px] text-muted-foreground">
        {ratio.values[1]} in {PROJECT.years[1]}
      </p>
    </div>
  );
}

function CreditHealthPanel({ ratios }: { ratios: RatioConfig[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Credit Health</h3>
      </div>
      <div className="space-y-4 p-4">
        {ratios.map((r, i) => (
          <RatioBar key={r.label} ratio={r} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Detail Cards ───────────────────────────────────────────────────────────

function DetailCard({ section }: { section: DetailSection }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/30"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90'
          )}
        />
        <span className="text-xs font-semibold">{section.title}</span>
      </button>

      {/* Collapse/expand via CSS grid-rows transition */}
      <div className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}>
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 py-2">
            {section.rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  'grid py-1.5 text-xs',
                  row.isTotal && 'border-t border-border pt-2 font-semibold'
                )}
                style={{ gridTemplateColumns: '1fr 100px 100px' }}
              >
                <span>{row.label}</span>
                {row.values.map((v, i) => (
                  <span key={i} className="text-right tabular-nums">
                    {fmt(v)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Formula Cards ──────────────────────────────────────────────────────────

function FormulaCard({ data }: { data: FormulaCardData }) {
  const hasDenominator = data.years[0].denominator !== '';

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h4 className="mb-3 text-xs font-semibold text-muted-foreground">
        {data.metric}
      </h4>
      <div className="grid grid-cols-2 gap-4">
        {data.years.map((y) => (
          <div key={y.year}>
            <p className="mb-2 text-[10px] font-semibold text-muted-foreground">{y.year}</p>

            {hasDenominator ? (
              /* Fraction-style display */
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center">
                  <span className="text-xs tabular-nums">{y.numerator}</span>
                  <div className="my-0.5 h-px w-full bg-foreground/30" />
                  <span className="text-xs tabular-nums">{y.denominator}</span>
                </div>
                <span className="text-muted-foreground">=</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                    SENTIMENT[y.sentiment].badge
                  )}
                >
                  {y.result}
                </span>
              </div>
            ) : (
              /* Single-line formula */
              <div className="space-y-1">
                <p className="text-[11px] leading-relaxed tabular-nums text-muted-foreground">
                  {y.numerator}
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">=</span>
                  <span className="text-sm font-bold tabular-nums">{y.result}</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upload Panel ───────────────────────────────────────────────────────────

function UploadInline() {
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Documents</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            1 analyzed
          </span>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>

      {/* Collapse/expand via CSS grid-rows transition */}
      <div className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200',
        showUpload ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}>
        <div className="overflow-hidden">
          <div className="border-t border-border px-4 pb-4 pt-3">
            <div
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) setFiles(Array.from(e.dataTransfer.files));
              }}
            >
              <Upload className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Drop files or{' '}
                <label className="cursor-pointer font-medium text-foreground underline underline-offset-2">
                  browse
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files?.length) setFiles(Array.from(e.target.files));
                    }}
                  />
                </label>
              </p>
            </div>
            {files.length > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium">{files[0].name}</span>
                <button
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                >
                  Analyze
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sticky Bottom Covenant Bar ─────────────────────────────────────────────

function CovenantBar({
  config,
  onChange,
}: {
  config: CovenantConfig;
  onChange: (c: CovenantConfig) => void;
}) {
  const capexOpts = [
    { value: 'unfunded' as const, label: 'Unfunded' },
    { value: 'all' as const, label: 'Deduct All' },
    { value: 'none' as const, label: 'None' },
    { value: 'custom' as const, label: 'Custom' },
  ];

  return (
    <div className="sticky bottom-0 z-20 -mx-6 border-t border-border bg-card/95 px-6 py-3 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-6">
        <span className="text-[10px] font-semibold text-muted-foreground">
          Covenant
        </span>

        {/* CapEx segmented control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">CapEx</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {capexOpts.map((o) => (
              <button
                key={o.value}
                onClick={() => onChange({ ...config, capexTreatment: o.value })}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium transition-colors',
                  config.capexTreatment === o.value
                    ? 'bg-foreground text-background'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {config.capexTreatment === 'custom' && (
            <input
              type="number"
              min={0}
              max={100}
              value={config.customCapexPercent}
              onChange={(e) => onChange({ ...config, customCapexPercent: Number(e.target.value) })}
              className="w-14 rounded border border-border bg-background px-1.5 py-1 text-[11px]"
            />
          )}
        </div>

        {/* Lease Debt */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Lease Debt</span>
          <Toggle
            checked={config.includeLeaseDebt}
            onChange={(v) => onChange({ ...config, includeLeaseDebt: v })}
          />
          <span className="text-[11px] text-muted-foreground">
            {config.includeLeaseDebt ? 'On' : 'Off'}
          </span>
        </div>

        {/* Operating Leases */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Op. Leases</span>
          <Toggle
            checked={config.includeOperatingLeases}
            onChange={(v) => onChange({ ...config, includeOperatingLeases: v })}
          />
          <span className="text-[11px] text-muted-foreground">
            {config.includeOperatingLeases ? 'On' : 'Off'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function FinancialAnalysisDashboard() {
  const [activeTab, setActiveTab] = useState('analysis');
  const [isEditing, setIsEditing] = useState(false);
  const [projectName, setProjectName] = useState(PROJECT.name);
  const [covenant, setCovenant] = useState<CovenantConfig>({
    capexTreatment: 'unfunded',
    customCapexPercent: 50,
    includeLeaseDebt: false,
    includeOperatingLeases: false,
  });

  const { kpis, ratios, riskScore } = useMemo(() => recalculate(covenant), [covenant]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Home className="h-3 w-3" />
          <span>Home</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span>Projects</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="font-medium text-foreground">{projectName}</span>
        </nav>

        {/* Title */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <input
                  autoFocus
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                  className="border-b-2 border-foreground bg-transparent text-xl font-bold outline-none"
                />
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Check className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold tracking-tight">{projectName}</h1>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{PROJECT.subtitle}</p>
        </div>

        {/* ═══ Hero KPI Row: Risk Gauge + 3 KPI Cards ═══ */}
        <div className="mb-6 grid grid-cols-4 items-start gap-4">
          {/* Risk Gauge — visually dominant */}
          <div className="flex flex-col items-center rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Risk Score
            </p>
            <RiskGauge score={riskScore} />
          </div>

          {/* 3 KPI Cards */}
          {kpis.map((kpi) => (
            <KPICard key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {/* Tab Bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* ═══ Tab Content ═══ */}
        <div className="mt-6">
          {activeTab === 'analysis' && (
            <div className="space-y-6">
              {/* Document upload */}
              <UploadInline />

              {/* ─── Two-Column Split: Earnings Flow | Credit Health ─── */}
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <EarningsFlow years={PROJECT.years} />
                <CreditHealthPanel ratios={ratios} />
              </div>

              {/* ─── Detail Cards Grid ─── */}
              <div>
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
                  Detail Breakdown
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {DETAIL_SECTIONS.map((s) => (
                    <DetailCard key={s.id} section={s} />
                  ))}
                </div>
              </div>

              {/* ─── Formula Audit ─── */}
              <div>
                <h3 className="mb-3 text-xs font-semibold text-muted-foreground">
                  Formula Audit
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {FORMULA_CARDS.map((c) => (
                    <FormulaCard key={c.metric} data={c} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Risk assessment view — integrates with WeightedRiskGauge and DebtHealthMeters.
              </p>
            </div>
          )}

          {activeTab === 'decision' && (
            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Decision view — lending recommendation and approval workflow.
              </p>
            </div>
          )}
        </div>

        {/* ═══ Sticky Covenant Bar ═══ */}
        {activeTab === 'analysis' && <CovenantBar config={covenant} onChange={setCovenant} />}
      </div>
    </div>
  );
}
