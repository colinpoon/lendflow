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
import type { YearMetrics } from '@/types';

interface AdjustedEBITDAProps {
  data: { metrics_by_year: Record<string, YearMetrics> } | null;
}

/**
 * Format currency values displayed in thousands (as commonly reported in financial statements)
 * Automatically scales to M (millions) or B (billions) for large values
 */
const formatCurrency = (value: number | null | undefined): string => {
  if (value == null) return 'N/A';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  return `${sign}$${absValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
};

const formatSignedCurrency = (
  value: number | null | undefined,
  isSubtraction = false,
): string => {
  if (value == null || value === 0) return '$0K';
  const prefix = isSubtraction ? '- ' : '+ ';
  return prefix + formatCurrency(Math.abs(value));
};

// ─── Animation Variants ────────────────────────────────────────────────────

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

// ─── Sub-components ────────────────────────────────────────────────────────

interface AdjustmentLineProps {
  label: string;
  value: number | null | undefined;
  isSubtraction?: boolean;
  rowIndex?: number;
}

const AdjustmentLine: React.FC<AdjustmentLineProps> = ({
  label,
  value,
  isSubtraction = false,
  rowIndex = 0,
}) => {
  if (value == null || value === 0) return null;

  return (
    <div
      className={`flex justify-between items-center py-1.5 px-3 ${
        rowIndex % 2 === 1 ? 'bg-surface-2/60' : ''
      }`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-medium tabular-nums text-sm ${isSubtraction ? 'text-error' : 'text-success'}`}
      >
        {formatSignedCurrency(value, isSubtraction)}
      </span>
    </div>
  );
};

interface AdjustmentCategoryProps {
  title: string;
  items: { label: string; value: number | null | undefined }[];
  total: number;
  isSubtraction?: boolean;
}

/**
 * Renders a ledger-entry style category block with a pill-badged total
 * and alternating row stripes on line items.
 */
const AdjustmentCategory: React.FC<AdjustmentCategoryProps> = ({
  title,
  items,
  total,
  isSubtraction = false,
}) => {
  const hasNonZeroItems = items.some(
    (item) => item.value != null && item.value !== 0,
  );

  if (!hasNonZeroItems && total === 0) return null;

  // Track visible row index separately for alternating stripe effect
  let visibleRowIndex = 0;

  return (
    <div className="mb-4">
      {/* Category header — ledger label + pill total */}
      <div className="flex justify-between items-center py-2 border-b border-border/60">
        <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          {title}
        </h5>
        <span
          className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md ${
            isSubtraction
              ? 'bg-error/8 text-error'
              : 'bg-success/8 text-success'
          }`}
        >
          {formatSignedCurrency(total, isSubtraction)}
        </span>
      </div>

      {/* Line items with alternating stripes */}
      <div className="divide-y divide-border/40">
        {items.map((item) => {
          if (item.value == null || item.value === 0) return null;
          const currentIndex = visibleRowIndex++;
          return (
            <AdjustmentLine
              key={item.label}
              label={item.label}
              value={item.value}
              isSubtraction={isSubtraction}
              rowIndex={currentIndex}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── Informational Callout Box ─────────────────────────────────────────────

interface InfoCalloutProps {
  title: string;
  value: number | null | undefined;
  description: string;
}

const InfoCallout: React.FC<InfoCalloutProps> = ({
  title,
  value,
  description,
}) => (
  <div className="rounded-xl border border-surface-border-1 bg-surface-2 p-4 mb-4">
    <div className="flex justify-between items-center mb-1">
      <h5 className="text-sm font-semibold text-muted-foreground">
        {title}
      </h5>
      <span className="text-sm font-bold tabular-nums text-muted-foreground">
        {formatCurrency(value)}
      </span>
    </div>
    <p className="text-xs text-muted-foreground/70">{description}</p>
  </div>
);

/** Format number for equation display — no $ sign, comma-separated, rounded */
const fmtEq = (n: number): string => Math.round(n).toLocaleString();

/**
 * Build a flat equation string like "80,831 + 1,005 − 451".
 * Zero-value terms are skipped so the equation stays readable.
 */
const eqLine = (
  start: number,
  terms: Array<{ v: number; op: string }>,
): string => {
  let eq = fmtEq(start);
  for (const t of terms) {
    if (t.v === 0) continue;
    eq += ` ${t.op} ${fmtEq(Math.abs(t.v))}`;
  }
  return eq;
};

// ─── Main Component ────────────────────────────────────────────────────────

const AdjustedEBITDA: React.FC<AdjustedEBITDAProps> = ({ data }) => {
  if (
    !data ||
    !data.metrics_by_year ||
    Object.keys(data.metrics_by_year).length === 0
  ) {
    return (
      <p className="text-muted-foreground">
        No EBITDA data available.
      </p>
    );
  }

  // Get the most recent year's data
  const years = Object.keys(data.metrics_by_year).sort().reverse();
  const latestYear = years[0];
  const metrics = data.metrics_by_year[latestYear];

  if (metrics.ebitda == null) {
    return (
      <p className="text-muted-foreground">
        No EBITDA data available for {latestYear}.
      </p>
    );
  }

  const breakdown = metrics.adjusted_ebitda_breakdown;
  const components = metrics.adjusted_ebitda_components;
  const adjustedEBITDA = metrics.adjusted_ebitda;
  const reportedAdjustedEBITDA = metrics.reported_adjusted_ebitda;
  const calculatedAdjustedEBITDA = metrics.calculated_adjusted_ebitda;
  const usesReportedValue =
    breakdown?.uses_reported_value ?? reportedAdjustedEBITDA != null;

  // Delta between adjusted and reported for the hero card indicator
  const ebitdaDelta =
    adjustedEBITDA != null && metrics.ebitda != null
      ? adjustedEBITDA - metrics.ebitda
      : null;

  // Check if there are any adjustments
  const hasAdjustments =
    breakdown &&
    (breakdown.non_cash_adjustments !== 0 ||
      breakdown.one_time_expenses !== 0 ||
      breakdown.one_time_gains !== 0 ||
      breakdown.interest_income_excluded !== 0 ||
      breakdown.owner_management_adjustments !== 0 ||
      breakdown.accounting_adjustments !== 0 ||
      breakdown.pro_forma_adjustments !== 0 ||
      breakdown.capital_expenditures_not_in_calc !== 0);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground">
          Values in thousands
        </span>
        <span className="text-sm text-muted-foreground">
          Fiscal Year {latestYear}
        </span>
      </div>

      {/* Reported vs Calculated indicator */}
      {usesReportedValue && (
        <div className="bg-secondary border border-border rounded-lg p-3">
          <p className="text-sm text-secondary-foreground">
            <span className="font-semibold">
              Company-Reported Value:
            </span>{' '}
            Using Adjusted EBITDA as reported by the company in their
            financial documents.
          </p>
          {calculatedAdjustedEBITDA != null &&
            calculatedAdjustedEBITDA !== adjustedEBITDA && (
              <p className="text-xs text-muted-foreground mt-1">
                Our calculated estimate:{' '}
                {formatCurrency(calculatedAdjustedEBITDA)}
              </p>
            )}
        </div>
      )}

      {/* ── Hero KPI Cards — Split-surface design ── */}
      <motion.div
        className="grid grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Reported EBITDA — dark gradient card */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-5 min-h-[140px] flex flex-col justify-between shadow-lg"
        >
          <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
          <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-white/[0.07] blur-2xl" />
          <p className="relative text-[10px] uppercase tracking-[0.15em] font-medium text-white/50">
            Reported EBITDA
          </p>
          <div className="relative mt-auto">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-white">
              {formatCurrency(metrics.ebitda)}
            </p>
          </div>
        </motion.div>

        {/* Adjusted EBITDA — dark gradient card with green tint */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900/80 to-black p-5 min-h-[140px] flex flex-col justify-between shadow-lg"
        >
          <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />
          <div className="absolute -top-12 -left-12 h-32 w-32 rounded-full bg-white/[0.07] blur-2xl" />
          <p className="relative text-[10px] uppercase tracking-[0.15em] font-medium text-white/50">
            Adjusted EBITDA {usesReportedValue && '(Reported)'}
          </p>
          <div className="relative mt-auto">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-300">
              {formatCurrency(adjustedEBITDA)}
            </p>
            {ebitdaDelta != null && (
              <p className="text-[11px] text-white/40 tabular-nums mt-1">
                {ebitdaDelta >= 0 ? '+' : ''}
                {formatCurrency(ebitdaDelta)} vs reported
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Formula Block — code-editor left-border pattern ── */}
      <div className="rounded-xl border border-surface-border-1 bg-surface-3">
        <p className="px-4 py-3 font-mono text-[11px] text-muted-foreground text-center tracking-wide leading-relaxed">
          Adjusted EBITDA = Reported EBITDA + Non-Cash + One-Time
          Expenses - One-Time Gains - Interest Income
        </p>
      </div>

      {/* Numeric formula card — one per year, most recent first */}
      <div className="space-y-3">
        {Object.keys(data.metrics_by_year)
          .sort()
          .reverse()
          .map((yr) => {
            const m = data.metrics_by_year[yr];
            const ab = m.adjusted_ebitda_breakdown;
            if (!ab) return null;

            return (
              <div
                key={yr}
                className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-4 font-mono text-sm leading-relaxed space-y-1"
              >
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  {yr}
                </div>
                <div>
                  <span className="text-gray-500">Adj. EBITDA</span>
                  <span className="text-gray-400"> = </span>
                  <span>
                    {eqLine(ab.reported_ebitda, [
                      { v: ab.non_cash_adjustments, op: '+' },
                      { v: ab.one_time_expenses, op: '+' },
                      { v: ab.one_time_gains, op: '−' },
                      { v: ab.interest_income_excluded, op: '−' },
                      { v: ab.owner_management_adjustments, op: '+' },
                      { v: ab.accounting_adjustments, op: '+' },
                      { v: ab.pro_forma_adjustments, op: '+' },
                    ])}
                  </span>
                  <span className="text-gray-400"> = </span>
                  <span className="font-bold text-blue-700">
                    {fmtEq(
                      m.calculated_adjusted_ebitda ??
                        m.adjusted_ebitda ??
                        ab.reported_ebitda,
                    )}
                  </span>
                </div>
                {ab.uses_reported_value && m.adjusted_ebitda != null && (
                  <div className="text-xs text-gray-400 mt-1">
                    Using reported value: {fmtEq(m.adjusted_ebitda)}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* ── Accordion Sections ── */}
      <Accordion
        type="multiple"
        defaultValue={['breakdown', 'historical']}
        className="w-full"
      >
        {/* Adjustment Breakdown Accordion */}
        {hasAdjustments && breakdown && components && (
          <AccordionItem
            value="breakdown"
            className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="font-semibold tracking-tight text-foreground">
                  Adjustment Breakdown
                </span>
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded tabular-nums">
                  {formatCurrency(adjustedEBITDA)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* Reported EBITDA baseline row */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                <span className="font-medium text-foreground">
                  Reported EBITDA
                </span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatCurrency(breakdown.reported_ebitda)}
                </span>
              </div>

              {/* Non-Cash Adjustments
                  unrealized_gains_losses sign convention (from extraction prompt):
                    positive  = unrealized loss  → add back (shown here)
                    negative  = unrealized gain  → subtract (shown in One-Time Gains below)
                  We pass only the positive (loss) portion into this block so the display
                  matches the calculator's sign-aware routing.
              */}
              <AdjustmentCategory
                title="Non-Cash Adjustments"
                total={breakdown.non_cash_adjustments}
                items={[
                  {
                    label: 'Stock-Based Compensation',
                    value: components.stock_based_compensation,
                  },
                  {
                    label: 'Impairment Charges',
                    value: components.impairment_charges,
                  },
                  {
                    label: 'Goodwill Impairment',
                    value: components.goodwill_impairment,
                  },
                  {
                    // Only show unrealized loss (positive value) as an addback here.
                    label: 'Unrealized Loss (Non-Cash)',
                    value:
                      components.unrealized_gains_losses != null &&
                      components.unrealized_gains_losses > 0
                        ? components.unrealized_gains_losses
                        : null,
                  },
                  {
                    // Unrealized FX loss from CF statement (positive = loss → add back)
                    label: 'Unrealized FX Loss (Non-Cash)',
                    value:
                      components.unrealized_fx_cash_flow != null &&
                      components.unrealized_fx_cash_flow > 0
                        ? components.unrealized_fx_cash_flow
                        : null,
                  },
                  {
                    label: 'Deferred Compensation',
                    value: components.deferred_compensation,
                  },
                  {
                    label: 'Other Non-Cash',
                    value: components.other_non_cash,
                  },
                ]}
              />

              {/* Loss on Disposal — informational only, not in Adjusted EBITDA */}
              {components.loss_on_disposal != null &&
                components.loss_on_disposal !== 0 && (
                  <InfoCallout
                    title="Loss on Disposal of Assets — Excluded"
                    value={components.loss_on_disposal}
                    description="Excluded from adjustment — no cash impact. Analyst should verify whether this represents a recurring disposal pattern."
                  />
                )}

              {/* One-Time Expenses */}
              <AdjustmentCategory
                title="One-Time/Non-Recurring Expenses"
                total={breakdown.one_time_expenses}
                items={[
                  {
                    label: 'Restructuring Costs',
                    value: components.restructuring_costs,
                  },
                  {
                    label: 'Severance Costs',
                    value: components.severance_costs,
                  },
                  {
                    label: 'Transaction Costs',
                    value: components.transaction_costs,
                  },
                  {
                    label: 'Legal Settlements',
                    value: components.legal_settlements,
                  },
                  {
                    label: 'Professional Fees (One-Time)',
                    value: components.professional_fees_one_time,
                  },
                  {
                    label: 'Casualty Losses',
                    value: components.casualty_losses,
                  },
                  {
                    label: 'Other One-Time Expenses',
                    value: components.other_one_time_expenses,
                  },
                ]}
              />

              {/* Gain on Disposal — informational only, not in Adjusted EBITDA */}
              {components.gain_on_disposal != null &&
                components.gain_on_disposal !== 0 && (
                  <InfoCallout
                    title="Gain on Disposal of Assets — Excluded"
                    value={components.gain_on_disposal}
                    description="Excluded from adjustment — no cash impact. Analyst should verify whether this represents a recurring disposal pattern."
                  />
                )}

              {/* One-Time Gains (subtract) */}
              <AdjustmentCategory
                title="One-Time Gains/Income (Subtracted)"
                total={breakdown.one_time_gains}
                isSubtraction
                items={[
                  {
                    label: 'Gain on Asset Sale',
                    value: components.gain_on_asset_sale,
                  },
                  {
                    label: 'Other Income (Non-Operating)',
                    value: components.other_income_non_operating,
                  },
                  {
                    label: 'Insurance Proceeds',
                    value: components.insurance_proceeds,
                  },
                  {
                    label: 'Other One-Time Gains',
                    value: components.other_one_time_gains,
                  },
                  {
                    // Unrealized gain: negative unrealized_gains_losses inflated net income.
                    label: 'Unrealized Gain (Non-Cash)',
                    value:
                      components.unrealized_gains_losses != null &&
                      components.unrealized_gains_losses < 0
                        ? Math.abs(components.unrealized_gains_losses)
                        : null,
                  },
                  {
                    // Unrealized FX gain from CF statement (negative = gain → subtract)
                    label: 'Unrealized FX Gain (Non-Cash)',
                    value:
                      components.unrealized_fx_cash_flow != null &&
                      components.unrealized_fx_cash_flow < 0
                        ? Math.abs(components.unrealized_fx_cash_flow)
                        : null,
                  },
                ]}
              />

              {/* Owner/Management Adjustments */}
              <AdjustmentCategory
                title="Owner/Management Adjustments"
                total={breakdown.owner_management_adjustments}
                items={[
                  {
                    label: 'Owner Compensation Adjustment',
                    value: components.owner_compensation_adjustment,
                  },
                  {
                    label: 'Related Party Adjustments',
                    value: components.related_party_adjustments,
                  },
                  {
                    label: 'Management Fees Adjustment',
                    value: components.management_fees_adjustment,
                  },
                ]}
              />

              {/* Accounting Policy Adjustments */}
              {breakdown.accounting_adjustments !== 0 && (
                <AdjustmentCategory
                  title="Accounting Policy Adjustments"
                  total={breakdown.accounting_adjustments}
                  items={[
                    {
                      label: 'Accounting Policy Changes',
                      value: components.accounting_policy_adjustments,
                    },
                  ]}
                />
              )}

              {/* Interest Income Exclusion */}
              {breakdown.interest_income_excluded != null &&
                breakdown.interest_income_excluded > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center py-2 border-b border-border/60">
                      <h5 className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                        Interest Income (Excluded)
                      </h5>
                      <span className="text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-md bg-error/8 text-error">
                        {formatSignedCurrency(
                          breakdown.interest_income_excluded,
                          true,
                        )}
                      </span>
                    </div>
                    <div className="divide-y divide-border/40">
                      <div className="flex justify-between items-center py-1.5 px-3">
                        <span className="text-sm text-muted-foreground">
                          Interest Income (Non-Operating)
                        </span>
                        <span className="font-medium tabular-nums text-sm text-error">
                          {formatSignedCurrency(
                            breakdown.interest_income_excluded,
                            true,
                          )}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/70 mt-1 px-3">
                      Treasury income on cash balances — excluded from
                      Adjusted EBITDA per standard lending convention.
                    </p>
                  </div>
                )}

              {/* Realized FX — informational only, not in EBITDA calc */}
              {breakdown.realized_fx_pl !== 0 && (
                <InfoCallout
                  title="Realized FX (P&L) — Not in Adjusted EBITDA"
                  value={breakdown.realized_fx_pl}
                  description="Already embedded in net income. Shown for analyst review — verify if recurring or one-time."
                />
              )}

              {/* Pro Forma Adjustments */}
              <AdjustmentCategory
                title="Pro Forma Adjustments"
                total={breakdown.pro_forma_adjustments}
                items={[
                  {
                    label: 'Cost Savings',
                    value: components.pro_forma_cost_savings,
                  },
                  {
                    label: 'Synergies',
                    value: components.pro_forma_synergies,
                  },
                ]}
              />

              {/* Capital Expenditures — informational only, not in Adjusted EBITDA */}
              {breakdown.capital_expenditures_not_in_calc !== 0 && (
                <InfoCallout
                  title="Maintenance CapEx — Not in Adjusted EBITDA"
                  value={breakdown.capital_expenditures_not_in_calc}
                  description="Shown for reference per standard lending convention. Deducted separately in FCCR."
                />
              )}

              {/* ── Final Total Row — statement-level result ── */}
              <div className="flex justify-between items-end mt-5 pt-4 border-t-2 border-foreground/10">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-muted-foreground block mb-0.5">
                    Result
                  </span>
                  <span className="font-bold text-foreground text-base tracking-tight">
                    Adjusted EBITDA
                  </span>
                </div>
                <span className="font-bold text-2xl tabular-nums tracking-tight text-success">
                  {formatCurrency(adjustedEBITDA)}
                </span>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* No adjustments notice */}
        {!hasAdjustments && (
          <div className="bg-surface-2 border border-surface-border-1 rounded-xl p-4">
            <p className="text-sm text-muted-foreground">
              No EBITDA adjustments were identified in the financial
              documents. The Adjusted EBITDA equals the Reported
              EBITDA.
            </p>
          </div>
        )}

        {/* Historical Comparison Accordion */}
        {years.length > 1 && (
          <AccordionItem
            value="historical"
            className="border border-surface-border-1 rounded-xl px-5 bg-card shadow-[0_1px_4px_oklch(0_0_0/0.04)] hover:shadow-[0_2px_8px_oklch(0_0_0/0.06)] transition-shadow duration-200 mt-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <span className="font-semibold tracking-tight text-foreground">
                Historical EBITDA Comparison
              </span>
            </AccordionTrigger>
            <AccordionContent>
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
                  <TableRow>
                    <TableCell className="text-foreground">
                      Reported EBITDA
                    </TableCell>
                    {years.map((yr) => (
                      <TableCell
                        key={yr}
                        className="text-right tabular-nums text-foreground"
                      >
                        {formatCurrency(
                          data.metrics_by_year[yr].ebitda,
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-foreground">
                      Adjusted EBITDA
                    </TableCell>
                    {years.map((yr) => (
                      <TableCell
                        key={yr}
                        className="text-right tabular-nums font-medium text-success"
                      >
                        {formatCurrency(
                          data.metrics_by_year[yr].adjusted_ebitda,
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
};

export default AdjustedEBITDA;
