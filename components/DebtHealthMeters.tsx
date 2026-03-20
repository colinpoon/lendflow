'use client';

import React, { useState } from 'react';
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
import type { FCCRBreakdown } from '@/types/financial';
import { formatCurrency } from '@/utils/format';

// ─── Domain Interfaces ────────────────────────────────────────────────────────

interface CustomAdjustment {
  id: string;
  amount: number;
  description: string;
}

interface DebtBreakdown {
  bank_debt: number;
  lease_liabilities: number;
  /** Portion of lease_liabilities included in Senior Debt (0 when treatment is 'exclude') */
  lease_liabilities_in_senior_debt: number;
  notes_payable: number;
  subordinated_debt: number;
  other_non_senior_debt: number;
}

interface DebtComponents {
  bank_debt_current: number | null;
  bank_debt_long_term: number | null;
  term_loans: number | null;
  revolving_credit_facilities: number | null;
  lease_liabilities_current: number | null;
  lease_liabilities_long_term: number | null;
  finance_lease_liabilities: number | null;
  operating_lease_liabilities: number | null;
  notes_payable: number | null;
  subordinated_debt: number | null;
  convertible_debt: number | null;
  bonds_debentures: number | null;
  other_borrowings: number | null;
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
  debt_components: DebtComponents | null;
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

interface HealthConfig {
  level: HealthLevel;
  color: string;
  bgClass: string;
  percentage: number;
}

// Shared fade-up animation class (tw-animate-css) replacing framer-motion variants.
const FADE_UP = 'animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both';

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Inline extracted-value annotation rendered next to line-item labels. */
const SourceInfo: React.FC<{
  value: number | null | undefined;
  label?: string;
}> = ({ value, label }) => (
  <span className="text-xs text-muted-foreground/60 ml-1">
    ({label ?? 'extracted'}:{' '}
    {value == null ? 'null' : value.toLocaleString()})
  </span>
);

// ─── Health Scoring ───────────────────────────────────────────────────────────

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


/** FCCR: Higher is better — more cash flow to cover fixed charges. */
const getFCCRHealth = (value: number): HealthConfig => {
  if (value >= 2.0)
    return {
      level: 'excellent',
      color: '#22c55e',
      bgClass: 'bg-success',
      percentage: 100,
    };
  if (value >= 1.5)
    return {
      level: 'good',
      color: '#84cc16',
      bgClass: 'bg-success/70',
      percentage: 80,
    };
  if (value >= 1.2)
    return {
      level: 'adequate',
      color: '#eab308',
      bgClass: 'bg-warning',
      percentage: 60,
    };
  if (value >= 1.0)
    return {
      level: 'weak',
      color: '#f97316',
      bgClass: 'bg-error/80',
      percentage: 40,
    };
  return {
    level: 'poor',
    color: '#ef4444',
    bgClass: 'bg-error',
    percentage: 20,
  };
};

/** Senior Debt/EBITDA: Lower is better — less leverage. */
const getSeniorDebtEBITDAHealth = (value: number): HealthConfig => {
  if (value <= 1.5)
    return {
      level: 'excellent',
      color: '#22c55e',
      bgClass: 'bg-success',
      percentage: 100,
    };
  if (value <= 2.5)
    return {
      level: 'good',
      color: '#84cc16',
      bgClass: 'bg-success/70',
      percentage: 80,
    };
  if (value <= 3.0)
    return {
      level: 'adequate',
      color: '#eab308',
      bgClass: 'bg-warning',
      percentage: 60,
    };
  if (value <= 4.0)
    return {
      level: 'weak',
      color: '#f97316',
      bgClass: 'bg-error/80',
      percentage: 40,
    };
  return {
    level: 'poor',
    color: '#ef4444',
    bgClass: 'bg-error',
    percentage: 20,
  };
};

/** Total Debt/Total Capital: Lower is better — less debt financing. */
const getTotalDebtCapitalHealth = (value: number): HealthConfig => {
  if (value < 0.3)
    return {
      level: 'excellent',
      color: '#22c55e',
      bgClass: 'bg-success',
      percentage: 100,
    };
  if (value <= 0.5)
    return {
      level: 'good',
      color: '#84cc16',
      bgClass: 'bg-success/70',
      percentage: 80,
    };
  if (value <= 0.6)
    return {
      level: 'adequate',
      color: '#eab308',
      bgClass: 'bg-warning',
      percentage: 60,
    };
  if (value <= 0.7)
    return {
      level: 'weak',
      color: '#f97316',
      bgClass: 'bg-error/80',
      percentage: 40,
    };
  return {
    level: 'poor',
    color: '#ef4444',
    bgClass: 'bg-error',
    percentage: 20,
  };
};

// ─── Reasoning Copy ───────────────────────────────────────────────────────────

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
  const pct = (value * 100).toFixed(1);
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

// ─── LinearMeterCard ─────────────────────────────────────────────────────────

interface LinearMeterCardProps {
  label: string;
  value: number | null;
  target: string;
  formatValue: (v: number) => string;
  getHealth: (v: number) => HealthConfig;
}

const meterGradientMap: Record<HealthLevel, string> = {
  excellent: 'from-emerald-950 via-emerald-900/80 to-black',
  good: 'from-emerald-950 via-emerald-900/80 to-black',
  adequate: 'from-amber-950 via-amber-900/80 to-black',
  weak: 'from-amber-950 via-amber-900/80 to-black',
  poor: 'from-red-950 via-red-900/80 to-black',
};

const meterSubtitleMap: Record<HealthLevel, string> = {
  excellent: 'text-emerald-300',
  good: 'text-emerald-300',
  adequate: 'text-amber-300',
  weak: 'text-amber-300',
  poor: 'text-red-300',
};

const meterValueMap: Record<HealthLevel, string> = {
  excellent: 'text-emerald-300',
  good: 'text-emerald-300',
  adequate: 'text-amber-300',
  weak: 'text-amber-300',
  poor: 'text-red-300',
};

const LinearMeterCard: React.FC<LinearMeterCardProps> = ({
  label,
  value,
  target,
  formatValue,
  getHealth,
}) => {
  const health = value != null ? getHealth(value) : null;
  const fillWidth = health ? health.percentage : 0;
  const gradient = health ? meterGradientMap[health.level] : 'from-zinc-800 via-zinc-900 to-black';
  const valueColor = health ? meterValueMap[health.level] : 'text-white';
  const subtitleColor = health ? meterSubtitleMap[health.level] : 'text-zinc-400';

  return (
    <div className={FADE_UP}>
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 min-h-[140px] flex flex-col justify-between shadow-lg`}>
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
        {/* Subtle top-left highlight */}
        <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-white/[0.07] blur-2xl" />

        <div className="relative flex justify-between items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.15em] font-medium text-white/50">
              {label}
            </p>
            <p className="text-[11px] text-white/30 mt-0.5">
              {target}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${valueColor}`}>
              {value != null ? formatValue(value) : '—'}
            </p>
            {health && (
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${subtitleColor}`}>
                {getRatingLabel(health.level)}
              </span>
            )}
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="relative h-1.5 rounded-full bg-white/10 overflow-hidden mt-auto">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${fillWidth}%`,
              backgroundColor: health?.color ?? 'transparent',
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DebtHealthMeters: React.FC<DebtHealthMetersProps> = ({
  data,
}) => {
  // Custom adjustments state for FCCR numerator
  const [customAdjustments, setCustomAdjustments] = useState<
    CustomAdjustment[]
  >([]);
  const [newAdjustmentAmount, setNewAdjustmentAmount] =
    useState<string>('');
  const [newAdjustmentDescription, setNewAdjustmentDescription] =
    useState<string>('');

  const handleAddAdjustment = () => {
    const amount = parseFloat(newAdjustmentAmount);
    if (isNaN(amount) || !newAdjustmentDescription.trim()) return;
    setCustomAdjustments([
      ...customAdjustments,
      {
        id: Date.now().toString(),
        amount,
        description: newAdjustmentDescription.trim(),
      },
    ]);
    setNewAdjustmentAmount('');
    setNewAdjustmentDescription('');
  };

  const handleRemoveAdjustment = (id: string) => {
    setCustomAdjustments(
      customAdjustments.filter((adj) => adj.id !== id),
    );
  };

  const totalCustomAdjustments = customAdjustments.reduce(
    (sum, adj) => sum + adj.amount,
    0,
  );

  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-muted-foreground">
        No debt metrics available.
      </p>
    );
  }

  const years = Object.keys(data.metrics_by_year).sort().reverse();

  return (
    <div className="space-y-8">
      {/* Values in thousands label */}
      <div className="flex justify-start items-center">
        <span className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground">
          Values in thousands
        </span>
      </div>

      {/* ── Year Accordions ─────────────────────────────────────────────── */}
      <Accordion
        type="multiple"
        defaultValue={[years[0]]}
        className="w-full space-y-3"
      >
        {years.map((year) => {
          const metrics = data.metrics_by_year[year];
          return (
            <AccordionItem
              key={year}
              value={year}
              className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
            >
              {/* Data-forward accordion header */}
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center justify-between w-full pr-2 gap-2">
                  <span className="text-sm font-bold tracking-tight text-foreground shrink-0">
                    FY {year}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:gap-x-4 mr-2">
                    {metrics.fccr != null && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          FCCR
                        </p>
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: getFCCRHealth(metrics.fccr).color,
                          }}
                        >
                          {metrics.fccr.toFixed(2)}x
                        </p>
                      </div>
                    )}
                    {metrics.senior_debt_to_ebitda != null && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Debt/EBITDA
                        </p>
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: getSeniorDebtEBITDAHealth(
                              metrics.senior_debt_to_ebitda,
                            ).color,
                          }}
                        >
                          {metrics.senior_debt_to_ebitda.toFixed(2)}x
                        </p>
                      </div>
                    )}
                    {metrics.total_debt_to_capital != null && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                          Debt/Cap
                        </p>
                        <p
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: getTotalDebtCapitalHealth(
                              metrics.total_debt_to_capital,
                            ).color,
                          }}
                        >
                          {(
                            metrics.total_debt_to_capital * 100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                {/* Linear meter card grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-4">
                  <LinearMeterCard
                    label="Covenant FCCR"
                    value={metrics.fccr}
                    target="Target: > 1.2x"
                    formatValue={(v) => v.toFixed(2) + 'x'}
                    getHealth={getFCCRHealth}
                  />
                  <LinearMeterCard
                    label="Sr. Debt / EBITDA"
                    value={metrics.senior_debt_to_ebitda}
                    target="Target: < 2.5x"
                    formatValue={(v) => v.toFixed(2) + 'x'}
                    getHealth={getSeniorDebtEBITDAHealth}
                  />
                  <LinearMeterCard
                    label="Debt / Capital"
                    value={metrics.total_debt_to_capital}
                    target="Target: < 30%"
                    formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                    getHealth={getTotalDebtCapitalHealth}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* ── Calculation Breakdowns (most recent year) ────────────────────── */}
      {(() => {
        const latestYear = years[0];
        const metrics = data.metrics_by_year[latestYear];

        return (
          <div className="mt-4">
            <h3 className="text-lg font-semibold tracking-tight text-foreground mb-4">
              Ratio Breakdowns ({latestYear})
            </h3>

            <Accordion
              type="multiple"
              defaultValue={['fccr']}
              className="w-full space-y-3"
            >
              {/* ── FCCR Breakdown ─────────────────────────────────────── */}
              <AccordionItem
                value="fccr"
                className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold tracking-tight text-foreground">
                      Covenant FCCR — Cash Flow Coverage
                      {customAdjustments.length > 0 && (
                        <span className="text-xs text-info ml-2">
                          (adjusted)
                        </span>
                      )}
                    </span>
                    {metrics.fccr != null &&
                      (() => {
                        const effectiveFCCR =
                          customAdjustments.length > 0 &&
                          metrics.fccr_breakdown?.denominator
                            ? (metrics.fccr_breakdown
                                .adjusted_ebitda +
                                totalCustomAdjustments) /
                              metrics.fccr_breakdown.denominator
                            : metrics.fccr;
                        const health = getFCCRHealth(effectiveFCCR);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold tabular-nums text-foreground">
                              {effectiveFCCR.toFixed(2)}x
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs text-white font-semibold ${health.bgClass}`}
                              style={{
                                boxShadow: `0 0 0 1px ${health.color}40`,
                              }}
                            >
                              {getRatingLabel(health.level)}
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  {metrics.fccr_breakdown ? (
                    <>
                      {/* Formula header */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-surface-2 border border-surface-border-1 rounded-lg px-3 py-2 text-muted-foreground">
                          (Adj. EBITDA - CapEx - Taxes -
                          Distributions) ÷ Debt Service
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          CapEx:{' '}
                          {metrics.fccr_breakdown.capex_treatment}
                        </span>
                      </div>

                      {/* Numerator */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Numerator — Cash Available for Debt
                            Service
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          <div className="flex justify-between items-center py-1.5 px-3">
                            <span className="text-muted-foreground">
                              Adjusted EBITDA
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .adjusted_ebitda,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              - Unfunded CapEx
                              {metrics.fccr_breakdown.sources && (
                                <span className="text-xs text-muted-foreground/60 ml-1">
                                  (capex:{' '}
                                  {metrics.fccr_breakdown.sources.capital_expenditures_extracted?.toLocaleString() ??
                                    'null'}
                                  , proceeds:{' '}
                                  {metrics.fccr_breakdown.sources.proceeds_from_lt_debt_extracted?.toLocaleString() ??
                                    'null'}
                                  )
                                </span>
                              )}
                            </span>
                            <span className="font-medium tabular-nums text-error">
                              -{' '}
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .capex_deduction,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-3">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              - Cash Taxes Paid
                              {metrics.fccr_breakdown.sources && (
                                <SourceInfo
                                  value={
                                    metrics.fccr_breakdown.sources
                                      .cash_taxes_paid_extracted
                                  }
                                />
                              )}
                            </span>
                            <span className="font-medium tabular-nums text-error">
                              -{' '}
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .cash_taxes_paid,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              - Distributions Paid
                              {metrics.fccr_breakdown.sources && (
                                <SourceInfo
                                  value={
                                    metrics.fccr_breakdown.sources
                                      .distributions_paid_extracted
                                  }
                                />
                              )}
                            </span>
                            <span className="font-medium tabular-nums text-error">
                              -{' '}
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .distributions_paid,
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Custom Adjustments */}
                        {customAdjustments.length > 0 && (
                          <div className="border-t border-border/60 pt-2 mt-2">
                            <div className="text-[11px] uppercase tracking-widest font-medium text-info mb-2 px-3">
                              Custom Adjustments
                            </div>
                            {customAdjustments.map((adj, idx) => (
                              <div
                                key={adj.id}
                                className={`flex justify-between items-center py-1.5 px-3 text-muted-foreground group text-sm ${
                                  idx % 2 === 0
                                    ? ''
                                    : 'bg-surface-2/60'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      handleRemoveAdjustment(adj.id)
                                    }
                                    className="opacity-0 group-hover:opacity-100 text-error/60 hover:text-error text-xs"
                                  >
                                    ×
                                  </button>
                                  {adj.description}
                                </span>
                                <span
                                  className={`tabular-nums ${adj.amount >= 0 ? 'text-success' : 'text-error'}`}
                                >
                                  {adj.amount >= 0 ? '+ ' : '- '}
                                  {formatCurrency(
                                    Math.abs(adj.amount),
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Adjustment Input */}
                        <div className="border-t border-border/60 pt-3 mt-2">
                          <div className="text-[11px] uppercase tracking-widest font-medium text-info mb-2 px-3">
                            Add Adjustment
                          </div>
                          <div className="flex flex-wrap gap-2 px-3">
                            <div className="relative shrink-0">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                $
                              </span>
                              <input
                                type="number"
                                value={newAdjustmentAmount}
                                onChange={(e) =>
                                  setNewAdjustmentAmount(
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                className="w-24 pl-6 pr-2 py-1.5 text-sm tabular-nums border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                            <input
                              type="text"
                              value={newAdjustmentDescription}
                              onChange={(e) =>
                                setNewAdjustmentDescription(
                                  e.target.value,
                                )
                              }
                              placeholder="Description..."
                              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleAddAdjustment();
                              }}
                            />
                            <button
                              onClick={handleAddAdjustment}
                              disabled={
                                !newAdjustmentAmount ||
                                !newAdjustmentDescription.trim()
                              }
                              className="shrink-0 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground/60 mt-1 px-3">
                            Use negative values for deductions,
                            positive for additions
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            = Cash for Debt Service
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(
                              metrics.fccr_breakdown.numerator +
                                totalCustomAdjustments,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Denominator */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Denominator — Total Debt Service
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          <div className="flex justify-between items-center py-1.5 px-3">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              Principal Payments
                              {metrics.fccr_breakdown.sources && (
                                <span className="text-xs text-muted-foreground/60 ml-1">
                                  (via{' '}
                                  {
                                    metrics.fccr_breakdown.sources
                                      .principal_source
                                  }
                                  )
                                </span>
                              )}
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .ttm_principal_payments,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              + Interest Expense
                              {metrics.fccr_breakdown.sources && (
                                <span className="text-xs text-muted-foreground/60 ml-1">
                                  (via{' '}
                                  {
                                    metrics.fccr_breakdown.sources
                                      .interest_source
                                  }
                                  )
                                </span>
                              )}
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              +{' '}
                              {formatCurrency(
                                metrics.fccr_breakdown
                                  .ttm_interest_expense,
                              )}
                            </span>
                          </div>
                          {metrics.fccr_breakdown.lease_payments >
                            0 && (
                            <div className="flex justify-between items-center py-1.5 px-3">
                              <span className="text-muted-foreground flex items-center flex-wrap">
                                + Lease Payments
                                {metrics.fccr_breakdown.sources && (
                                  <span className="text-xs text-muted-foreground/60 ml-1">
                                    (via{' '}
                                    {
                                      metrics.fccr_breakdown.sources
                                        .lease_source
                                    }
                                    )
                                  </span>
                                )}
                              </span>
                              <span className="font-medium tabular-nums text-foreground">
                                +{' '}
                                {formatCurrency(
                                  metrics.fccr_breakdown
                                    .lease_payments,
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            = Total Debt Service
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(
                              metrics.fccr_breakdown.denominator,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Final Calculation Formula Block */}
                      <div className="rounded-xl border border-surface-border-1  bg-surface-3 mb-4">
                        <div className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <div>
                              <span className="text-muted-foreground/70">
                                Numerator =
                              </span>{' '}
                              <span className="tabular-nums">
                                {metrics.fccr_breakdown.adjusted_ebitda.toLocaleString()}{' '}
                                -{' '}
                                {metrics.fccr_breakdown.capex_deduction.toLocaleString()}{' '}
                                -{' '}
                                {metrics.fccr_breakdown.cash_taxes_paid.toLocaleString()}{' '}
                                -{' '}
                                {metrics.fccr_breakdown.distributions_paid.toLocaleString()}{' '}
                                ={' '}
                              </span>
                              <span className="font-semibold tabular-nums text-info">
                                {metrics.fccr_breakdown.numerator.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/70">
                                Denominator =
                              </span>{' '}
                              <span className="tabular-nums">
                                {metrics.fccr_breakdown.ttm_principal_payments.toLocaleString()}{' '}
                                +{' '}
                                {metrics.fccr_breakdown.ttm_interest_expense.toLocaleString()}
                                {metrics.fccr_breakdown
                                  .lease_payments > 0
                                  ? ` + ${metrics.fccr_breakdown.lease_payments.toLocaleString()}`
                                  : ''}{' '}
                                ={' '}
                              </span>
                              <span className="font-semibold tabular-nums text-warning">
                                {metrics.fccr_breakdown.denominator.toLocaleString()}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <span className="text-muted-foreground/70">
                                Covenant FCCR =
                              </span>{' '}
                              <span className="tabular-nums">
                                {(
                                  metrics.fccr_breakdown.numerator +
                                  totalCustomAdjustments
                                ).toLocaleString()}{' '}
                                /{' '}
                                {metrics.fccr_breakdown.denominator.toLocaleString()}{' '}
                                ={' '}
                              </span>
                              <span className="tabular-nums text-foreground">
                                {(
                                  (metrics.fccr_breakdown.numerator +
                                    totalCustomAdjustments) /
                                  metrics.fccr_breakdown.denominator
                                ).toFixed(2)}
                                x
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.fccr != null &&
                        (() => {
                          const effectiveValue =
                            customAdjustments.length > 0 &&
                            metrics.fccr_breakdown?.denominator
                              ? (metrics.fccr_breakdown.numerator +
                                  totalCustomAdjustments) /
                                metrics.fccr_breakdown.denominator
                              : metrics.fccr;
                          return (
                            <p className="rounded-xl bg-surface-2 border border-surface-border-1 p-4 text-xs text-muted-foreground italic">
                              {getFCCRReasoning(
                                effectiveValue,
                                getFCCRHealth(effectiveValue).level,
                              )}
                            </p>
                          );
                        })()}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Insufficient data. Minimum required: Adjusted
                      EBITDA and debt service components.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ── Senior Debt / EBITDA Breakdown ─────────────────────── */}
              <AccordionItem
                value="senior-debt-ebitda"
                className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold tracking-tight text-foreground">
                      Senior Debt / Adjusted EBITDA
                    </span>
                    {metrics.senior_debt_to_ebitda != null &&
                      (() => {
                        const health = getSeniorDebtEBITDAHealth(
                          metrics.senior_debt_to_ebitda,
                        );
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold tabular-nums text-foreground">
                              {metrics.senior_debt_to_ebitda.toFixed(
                                2,
                              )}
                              x
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs text-white font-semibold ${health.bgClass}`}
                              style={{
                                boxShadow: `0 0 0 1px ${health.color}40`,
                              }}
                            >
                              {getRatingLabel(health.level)}
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  {metrics.senior_debt != null &&
                  (metrics.adjusted_ebitda != null ||
                    metrics.ebitda != null) ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-surface-2 border border-surface-border-1 rounded-lg px-3 py-2 text-muted-foreground">
                          Senior Debt ÷ Adjusted EBITDA
                        </span>
                      </div>

                      {/* Senior Debt Breakdown */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Numerator — Senior Debt
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          {metrics.debt_components ? (
                            <>
                              <div className="flex justify-between items-center py-1.5 px-3">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  Bank Debt - Current
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .bank_debt_current
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(
                                    metrics.debt_components
                                      .bank_debt_current ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Bank Debt - Long-term
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .bank_debt_long_term
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .bank_debt_long_term ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Lease Liabilities - Current
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .lease_liabilities_current
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .lease_liabilities_current ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Lease Liabilities - Long-term
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .lease_liabilities_long_term
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .lease_liabilities_long_term ??
                                      0,
                                  )}
                                </span>
                              </div>
                            </>
                          ) : metrics.debt_breakdown ? (
                            <>
                              {metrics.debt_breakdown.bank_debt >
                                0 && (
                                <div className="flex justify-between items-center py-1.5 px-3">
                                  <span className="text-muted-foreground">
                                    Bank Debt (Current + Long-term)
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .bank_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .lease_liabilities_in_senior_debt >
                                0 && (
                                <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                  <span className="text-muted-foreground">
                                    + Lease Liabilities (IFRS 16)
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .lease_liabilities_in_senior_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex justify-between items-center py-1.5 px-3 text-muted-foreground italic">
                              <span>
                                No debt component breakdown available
                              </span>
                              <span className="tabular-nums">
                                {formatCurrency(metrics.senior_debt)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Total Senior Debt
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(metrics.senior_debt)}
                          </span>
                        </div>
                      </div>

                      {/* EBITDA Denominator */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Denominator — Adjusted EBITDA
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          <div className="flex justify-between items-center py-1.5 px-3">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              Reported EBITDA
                              <SourceInfo value={metrics.ebitda} />
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatCurrency(metrics.ebitda)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Adjusted EBITDA (Used)
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(
                              metrics.adjusted_ebitda ??
                                metrics.ebitda,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Formula Block */}
                      <div className="rounded-xl border border-surface-border-1 bg-surface-3 mb-4">
                        <div className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <div>
                              <span className="text-muted-foreground/70">
                                Ratio =
                              </span>{' '}
                              <span className="tabular-nums">
                                {(
                                  metrics.senior_debt ?? 0
                                ).toLocaleString()}{' '}
                                /{' '}
                                {(
                                  metrics.adjusted_ebitda ??
                                  metrics.ebitda ??
                                  0
                                ).toLocaleString()}{' '}
                                ={' '}
                              </span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {metrics.senior_debt_to_ebitda?.toFixed(
                                  2,
                                )}
                                x
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.senior_debt_to_ebitda != null && (
                        <p className="rounded-xl bg-surface-2 border border-surface-border-1 p-4 text-xs text-muted-foreground italic">
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
                    <p className="text-sm text-muted-foreground italic">
                      Insufficient data to calculate Debt/EBITDA
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* ── Total Debt / Total Capital Breakdown ────────────────── */}
              <AccordionItem
                value="total-debt-capital"
                className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-semibold tracking-tight text-foreground">
                      Total Debt / Total Capital
                    </span>
                    {metrics.total_debt_to_capital != null &&
                      (() => {
                        const health = getTotalDebtCapitalHealth(
                          metrics.total_debt_to_capital,
                        );
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold tabular-nums text-foreground">
                              {(
                                metrics.total_debt_to_capital * 100
                              ).toFixed(1)}
                              %
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs text-white font-semibold ${health.bgClass}`}
                              style={{
                                boxShadow: `0 0 0 1px ${health.color}40`,
                              }}
                            >
                              {getRatingLabel(health.level)}
                            </span>
                          </div>
                        );
                      })()}
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  {metrics.total_debt != null &&
                  metrics.shareholders_equity != null ? (
                    <>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-xs bg-surface-2 border border-surface-border-1 rounded-lg px-3 py-2 text-muted-foreground">
                          Total Debt ÷ (Total Debt +
                          Shareholders&apos; Equity)
                        </span>
                      </div>

                      {/* Total Debt Breakdown */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Numerator — Total Debt
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          {metrics.debt_components ? (
                            <>
                              <div className="flex justify-between items-center py-1.5 px-3">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  Bank Debt - Current
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .bank_debt_current
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatCurrency(
                                    metrics.debt_components
                                      .bank_debt_current ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Bank Debt - Long-term
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .bank_debt_long_term
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .bank_debt_long_term ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Lease Liabilities - Current
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .lease_liabilities_current
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .lease_liabilities_current ?? 0,
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                <span className="text-muted-foreground flex items-center flex-wrap">
                                  + Lease Liabilities - Long-term
                                  <SourceInfo
                                    value={
                                      metrics.debt_components
                                        .lease_liabilities_long_term
                                    }
                                  />
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                  +{' '}
                                  {formatCurrency(
                                    metrics.debt_components
                                      .lease_liabilities_long_term ??
                                      0,
                                  )}
                                </span>
                              </div>
                              {metrics.debt_components
                                .notes_payable != null &&
                                metrics.debt_components
                                  .notes_payable > 0 && (
                                  <div className="flex justify-between items-center py-1.5 px-3">
                                    <span className="text-muted-foreground flex items-center flex-wrap">
                                      + Notes Payable
                                      <SourceInfo
                                        value={
                                          metrics.debt_components
                                            .notes_payable
                                        }
                                      />
                                    </span>
                                    <span className="font-medium tabular-nums text-foreground">
                                      +{' '}
                                      {formatCurrency(
                                        metrics.debt_components
                                          .notes_payable,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {metrics.debt_components
                                .subordinated_debt != null &&
                                metrics.debt_components
                                  .subordinated_debt > 0 && (
                                  <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                    <span className="text-muted-foreground flex items-center flex-wrap">
                                      + Subordinated Debt
                                      <SourceInfo
                                        value={
                                          metrics.debt_components
                                            .subordinated_debt
                                        }
                                      />
                                    </span>
                                    <span className="font-medium tabular-nums text-foreground">
                                      +{' '}
                                      {formatCurrency(
                                        metrics.debt_components
                                          .subordinated_debt,
                                      )}
                                    </span>
                                  </div>
                                )}
                              {metrics.debt_components
                                .other_borrowings != null &&
                                metrics.debt_components
                                  .other_borrowings > 0 && (
                                  <div className="flex justify-between items-center py-1.5 px-3">
                                    <span className="text-muted-foreground flex items-center flex-wrap">
                                      + Other Borrowings
                                      <SourceInfo
                                        value={
                                          metrics.debt_components
                                            .other_borrowings
                                        }
                                      />
                                    </span>
                                    <span className="font-medium tabular-nums text-foreground">
                                      +{' '}
                                      {formatCurrency(
                                        metrics.debt_components
                                          .other_borrowings,
                                      )}
                                    </span>
                                  </div>
                                )}
                            </>
                          ) : metrics.debt_breakdown ? (
                            <>
                              {metrics.debt_breakdown.bank_debt >
                                0 && (
                                <div className="flex justify-between items-center py-1.5 px-3">
                                  <span className="text-muted-foreground">
                                    Bank Debt
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .bank_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown
                                .lease_liabilities > 0 && (
                                <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                  <span className="text-muted-foreground">
                                    + Lease Liabilities
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .lease_liabilities,
                                    )}
                                  </span>
                                </div>
                              )}
                              {metrics.debt_breakdown.notes_payable >
                                0 && (
                                <div className="flex justify-between items-center py-1.5 px-3">
                                  <span className="text-muted-foreground">
                                    + Notes Payable
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
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
                                <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                                  <span className="text-muted-foreground">
                                    + Subordinated Debt
                                  </span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    +{' '}
                                    {formatCurrency(
                                      metrics.debt_breakdown
                                        .subordinated_debt,
                                    )}
                                  </span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex justify-between items-center py-1.5 px-3 text-muted-foreground italic">
                              <span>No debt breakdown available</span>
                              <span className="tabular-nums">
                                {formatCurrency(metrics.total_debt)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Total Debt
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(metrics.total_debt)}
                          </span>
                        </div>
                      </div>

                      {/* Total Capital Breakdown */}
                      <div className="mb-4">
                        <div className="flex justify-between items-center py-2 border-b border-border/60 mb-1">
                          <h5 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Denominator — Total Capital
                          </h5>
                        </div>
                        <div className="divide-y divide-border/40 text-sm">
                          <div className="flex justify-between items-center py-1.5 px-3">
                            <span className="text-muted-foreground">
                              Total Debt
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              {formatCurrency(metrics.total_debt)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-1.5 px-3 bg-surface-2/60">
                            <span className="text-muted-foreground flex items-center flex-wrap">
                              + Shareholders&apos; Equity
                              <SourceInfo
                                value={metrics.shareholders_equity}
                              />
                            </span>
                            <span className="font-medium tabular-nums text-foreground">
                              +{' '}
                              {formatCurrency(
                                metrics.shareholders_equity,
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/60">
                          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                            Total Capital
                          </span>
                          <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-foreground/5 text-foreground">
                            {formatCurrency(
                              metrics.total_debt +
                                metrics.shareholders_equity,
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Formula Block */}
                      <div className="rounded-xl border border-surface-border-1 bg-surface-3 mb-4">
                        <div className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <div className="space-y-1">
                            <div>
                              <span className="text-muted-foreground/70">
                                Total Capital =
                              </span>{' '}
                              <span className="tabular-nums">
                                {(
                                  metrics.total_debt ?? 0
                                ).toLocaleString()}{' '}
                                +{' '}
                                {(
                                  metrics.shareholders_equity ?? 0
                                ).toLocaleString()}{' '}
                                ={' '}
                              </span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {(
                                  (metrics.total_debt ?? 0) +
                                  (metrics.shareholders_equity ?? 0)
                                ).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/70">
                                Ratio =
                              </span>{' '}
                              <span className="tabular-nums">
                                {(
                                  metrics.total_debt ?? 0
                                ).toLocaleString()}{' '}
                                /{' '}
                                {(
                                  (metrics.total_debt ?? 0) +
                                  (metrics.shareholders_equity ?? 0)
                                ).toLocaleString()}{' '}
                                ={' '}
                              </span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {(
                                  (metrics.total_debt_to_capital ??
                                    0) * 100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reasoning */}
                      {metrics.total_debt_to_capital != null && (
                        <p className="rounded-xl bg-surface-2 border border-surface-border-1 p-4 text-xs text-muted-foreground italic">
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
                    <p className="text-sm text-muted-foreground italic">
                      Insufficient data to calculate Debt/Capital
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        );
      })()}

      {/* ── Historical Comparison Table ──────────────────────────────────── */}
      {years.length > 1 && (
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-sm font-medium tracking-tight text-foreground mb-3">
            Historical Comparison
          </h3>
          <div className="overflow-x-auto">
            <Table className="table-financial">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground">
                    Metric
                  </TableHead>
                  {years.map((yr) => (
                    <TableHead
                      key={yr}
                      className="text-right text-[11px] uppercase tracking-widest font-medium text-muted-foreground"
                    >
                      {yr}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Covenant FCCR row */}
                <TableRow>
                  <TableCell className="text-foreground font-medium">
                    Covenant FCCR
                  </TableCell>
                  {years.map((yr) => {
                    const val = data.metrics_by_year[yr].fccr;
                    const health =
                      val != null ? getFCCRHealth(val) : null;
                    return (
                      <TableCell key={yr} className="text-right">
                        {val != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs text-white tabular-nums font-semibold ${health?.bgClass}`}
                            style={{
                              boxShadow: `0 0 0 1px ${health?.color ?? 'transparent'}40`,
                            }}
                          >
                            {val.toFixed(2)}x
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Senior Debt / Adj. EBITDA row */}
                <TableRow>
                  <TableCell className="text-foreground font-medium">
                    Senior Debt / Adj. EBITDA
                  </TableCell>
                  {years.map((yr) => {
                    const val =
                      data.metrics_by_year[yr].senior_debt_to_ebitda;
                    const health =
                      val != null
                        ? getSeniorDebtEBITDAHealth(val)
                        : null;
                    return (
                      <TableCell key={yr} className="text-right">
                        {val != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs text-white tabular-nums font-semibold ${health?.bgClass}`}
                            style={{
                              boxShadow: `0 0 0 1px ${health?.color ?? 'transparent'}40`,
                            }}
                          >
                            {val.toFixed(2)}x
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>

                {/* Total Debt / Capital row */}
                <TableRow>
                  <TableCell className="text-foreground font-medium">
                    Total Debt / Capital
                  </TableCell>
                  {years.map((yr) => {
                    const val =
                      data.metrics_by_year[yr].total_debt_to_capital;
                    const health =
                      val != null
                        ? getTotalDebtCapitalHealth(val)
                        : null;
                    return (
                      <TableCell key={yr} className="text-right">
                        {val != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs text-white tabular-nums font-semibold ${health?.bgClass}`}
                            style={{
                              boxShadow: `0 0 0 1px ${health?.color ?? 'transparent'}40`,
                            }}
                          >
                            {(val * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtHealthMeters;
