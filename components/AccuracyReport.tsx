'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AccuracySummary } from '@/lib/benchmarks/accuracy';
import { cn } from '@/lib/utils';

interface AccuracyReportProps {
  summary: AccuracySummary | null;
}

/**
 * Legacy accuracy report component. Retained for potential future use.
 * The primary debugging UI is now GroundTruthDebugger.
 */
export function AccuracyReport({ summary }: AccuracyReportProps) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accuracy Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No ground truth available for this document.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accuracy Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-2xl font-bold">{summary.accuracy_pct.toFixed(0)}%</p>
          <p className="text-sm text-muted-foreground">Overall Accuracy ({summary.metrics_compared} metrics)</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Metric</th>
              <th className="text-right p-2">Ground Truth</th>
              <th className="text-right p-2">Extracted</th>
              <th className="text-right p-2">Variance</th>
              <th className="text-center p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.results.map((r) => (
              <tr key={r.metric} className="border-b">
                <td className="p-2">{r.label}</td>
                <td className="p-2 text-right tabular-nums">{r.truth.toLocaleString()}</td>
                <td className="p-2 text-right tabular-nums">
                  {r.extracted?.toLocaleString() ?? '-'}
                </td>
                <td className={cn(
                  'p-2 text-right tabular-nums text-xs',
                  r.status === 'green' ? 'text-green-600' : r.status === 'amber' ? 'text-amber-600' : 'text-red-600'
                )}>
                  {r.variance_pct !== null ? `${r.variance_pct.toFixed(1)}%` : '-'}
                </td>
                <td className="p-2 text-center">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    r.status === 'green' ? 'bg-green-100 text-green-800' :
                    r.status === 'amber' ? 'bg-amber-100 text-amber-800' :
                    r.status === 'red' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-500'
                  )}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
