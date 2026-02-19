'use client';

import { cn } from '@/lib/utils';
import type { ComputedMetrics } from '@/types';

interface ComparisonTableProps {
  textMetrics: Record<string, ComputedMetrics> | null;
  visionMetrics: Record<string, ComputedMetrics> | null;
  selectedYear: string;
}

// Metrics to display in comparison
const COMPARISON_METRICS: { key: keyof ComputedMetrics; label: string; format: 'currency' | 'ratio' | 'percent' }[] = [
  { key: 'revenue', label: 'Revenue', format: 'currency' },
  { key: 'net_income', label: 'Net Income', format: 'currency' },
  { key: 'ebitda', label: 'EBITDA', format: 'currency' },
  { key: 'adjusted_ebitda', label: 'Adjusted EBITDA', format: 'currency' },
  { key: 'shareholders_equity', label: 'Shareholders\' Equity', format: 'currency' },
  { key: 'total_debt', label: 'Total Debt', format: 'currency' },
  { key: 'senior_debt', label: 'Senior Debt', format: 'currency' },
  { key: 'dscr', label: 'DSCR', format: 'ratio' },
  { key: 'fccr', label: 'FCCR', format: 'ratio' },
  { key: 'total_debt_to_capital', label: 'Total Debt/Capital', format: 'percent' },
  { key: 'senior_debt_to_ebitda', label: 'Senior Debt/EBITDA', format: 'ratio' },
];

export function ComparisonTable({ textMetrics, visionMetrics, selectedYear }: ComparisonTableProps) {
  const textYearData = textMetrics?.[selectedYear];
  const visionYearData = visionMetrics?.[selectedYear];

  const formatValue = (value: number | null | undefined, format: 'currency' | 'ratio' | 'percent'): string => {
    if (value == null) return '-';
    if (format === 'currency') return `$${value.toLocaleString()}`;
    if (format === 'ratio') return value.toFixed(2);
    if (format === 'percent') return `${(value * 100).toFixed(1)}%`;
    return String(value);
  };

  /**
   * Calculate variance between text and vision values as a ratio (0-1).
   * Uses max-based variance: |text - vision| / max(|text|, |vision|)
   * This ensures variance is symmetric and bounded 0-1 for display.
   * Note: 0.10 = 10% variance, used as threshold for highlighting.
   */
  const getVariance = (textVal: number | null | undefined, visionVal: number | null | undefined): number | null => {
    if (textVal == null || visionVal == null) return null;
    if (textVal === 0 && visionVal === 0) return 0;
    const max = Math.max(Math.abs(textVal), Math.abs(visionVal));
    if (max === 0) return 0;
    return Math.abs(textVal - visionVal) / max;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 font-medium">Metric</th>
            <th className="text-right p-3 font-medium">Text Extraction</th>
            <th className="text-right p-3 font-medium">Vision Extraction</th>
            <th className="text-right p-3 font-medium">Variance</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_METRICS.map(({ key, label, format }) => {
            const textVal = textYearData?.[key] as number | null | undefined;
            const visionVal = visionYearData?.[key] as number | null | undefined;
            const variance = getVariance(textVal, visionVal);
            const hasDiff = variance != null && variance > 0.10; // >10% variance

            return (
              <tr key={key} className="border-b hover:bg-muted/50">
                <td className="p-3 text-sm text-muted-foreground">{label}</td>
                <td className={cn('p-3 text-right tabular-nums', hasDiff && 'text-amber-600 font-medium')}>
                  {formatValue(textVal, format)}
                </td>
                <td className={cn('p-3 text-right tabular-nums', hasDiff && 'text-amber-600 font-medium')}>
                  {formatValue(visionVal, format)}
                </td>
                <td className={cn('p-3 text-right text-sm', hasDiff ? 'text-amber-600' : 'text-muted-foreground')}>
                  {variance != null ? `${(variance * 100).toFixed(1)}%` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
