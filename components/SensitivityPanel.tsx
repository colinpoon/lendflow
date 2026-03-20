'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { computeStressScenarios, type StressTestResult } from '@/lib/calculations/stress-test';
import { formatCurrency } from '@/utils/format';
import type { ComputedMetrics } from '@/types/financial';
import { FCCR_THRESHOLDS, DEBT_EBITDA_THRESHOLDS } from '@/lib/constants';

interface Props {
  data: { metrics_by_year: Record<string, ComputedMetrics> };
}

function getRatioColor(
  value: number | null,
  thresholds: { good: number; fair: number },
  direction: 'above' | 'below'
): string {
  if (value == null) return 'text-muted-foreground';
  if (direction === 'above') {
    if (value >= thresholds.good) return 'text-success';
    if (value >= thresholds.fair) return 'text-warning';
    return 'text-error';
  }
  // 'below' means lower is better (leverage)
  if (value <= thresholds.good) return 'text-success';
  if (value <= thresholds.fair) return 'text-warning';
  return 'text-error';
}

function formatRatio(value: number | null): string {
  if (value == null) return '—';
  return `${value.toFixed(2)}x`;
}

export default function SensitivityPanel({ data }: Props) {
  const years = Object.keys(data.metrics_by_year).sort();
  const latestYear = years[years.length - 1];
  if (!latestYear) return null;

  const m = data.metrics_by_year[latestYear];
  if (!m) return null;

  const result: StressTestResult | null = computeStressScenarios(latestYear, {
    adjustedEbitda: m.adjusted_ebitda,
    fccrNumerator: m.fccr_numerator ?? null,
    totalFixedCharges: m.total_fixed_charges ?? null,
    seniorDebt: m.senior_debt,
  });

  if (!result) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold tracking-tight">
          EBITDA Sensitivity Analysis
        </CardTitle>
        <CardDescription className="text-xs">
          Deterministic stress scenarios for {latestYear} — how key ratios change if EBITDA declines
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs">Scenario</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs text-right">Adj. EBITDA</th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground text-xs text-right">FCCR</th>
                <th className="pb-2 font-medium text-muted-foreground text-xs text-right">Sr. Debt / Adj. EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {result.scenarios.map((s) => (
                <tr key={s.label} className={`border-b border-border/50 ${s.haircut === 0 ? 'font-medium' : ''}`}>
                  <td className="py-2.5 pr-4 text-xs text-foreground">{s.label}</td>
                  <td className="py-2.5 pr-4 text-xs text-right tabular-nums text-foreground">
                    {formatCurrency(s.adjustedEbitda)}
                  </td>
                  <td className={`py-2.5 pr-4 text-xs text-right tabular-nums ${getRatioColor(
                    s.fccr,
                    { good: FCCR_THRESHOLDS.ADEQUATE, fair: FCCR_THRESHOLDS.WEAK },
                    'above'
                  )}`}>
                    {formatRatio(s.fccr)}
                  </td>
                  <td className={`py-2.5 text-xs text-right tabular-nums ${getRatioColor(
                    s.seniorDebtToEbitda,
                    { good: DEBT_EBITDA_THRESHOLDS.GOOD, fair: DEBT_EBITDA_THRESHOLDS.WEAK },
                    'below'
                  )}`}>
                    {formatRatio(s.seniorDebtToEbitda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
          Fixed charges and debt balances held constant. Only EBITDA is stressed. Standard commercial banking methodology.
        </p>
      </CardContent>
    </Card>
  );
}
