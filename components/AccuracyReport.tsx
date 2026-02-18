'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AccuracySummary } from '@/lib/benchmarks/accuracy';
import { cn } from '@/lib/utils';

interface AccuracyReportProps {
  summary: AccuracySummary | null;
}

export function AccuracyReport({ summary }: AccuracyReportProps) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No ground truth available for this document. Add values to lib/benchmarks/ground-truth.ts.
          </p>
        </CardContent>
      </Card>
    );
  }

  const winnerColor = summary.winner === 'vision' ? 'text-green-600' : summary.winner === 'text' ? 'text-blue-600' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accuracy Report: {summary.document} ({summary.fiscal_year})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">{summary.text_accuracy_pct.toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground">Text Accuracy</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{summary.vision_accuracy_pct.toFixed(0)}%</p>
            <p className="text-sm text-muted-foreground">Vision Accuracy</p>
          </div>
          <div>
            <p className={cn('text-2xl font-bold capitalize', winnerColor)}>{summary.winner}</p>
            <p className="text-sm text-muted-foreground">Winner</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Metric</th>
              <th className="text-right p-2">Ground Truth</th>
              <th className="text-right p-2">Text</th>
              <th className="text-right p-2">Vision</th>
            </tr>
          </thead>
          <tbody>
            {summary.results.map((r) => (
              <tr key={r.metric} className="border-b">
                <td className="p-2">{r.metric}</td>
                <td className="p-2 text-right tabular-nums">{r.truth.toLocaleString()}</td>
                <td className={cn('p-2 text-right tabular-nums', r.text_accurate ? 'text-green-600' : 'text-red-600')}>
                  {r.text_extracted?.toLocaleString() ?? '-'}
                </td>
                <td className={cn('p-2 text-right tabular-nums', r.vision_accurate ? 'text-green-600' : 'text-red-600')}>
                  {r.vision_extracted?.toLocaleString() ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
