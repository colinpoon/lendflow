import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the Financial Summary table.
 * Mirrors: header row + 10 alternating data rows, each with label + 3 year columns.
 */
export function FinancialTableSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
        <Skeleton className="h-3 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-14 ml-auto" />
        ))}
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 ${
            i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
          }`}
        >
          <Skeleton className={`h-3 ${i % 3 === 0 ? 'w-40' : 'w-32'}`} />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-3 w-14 ml-auto" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the Quantitative Risk Scorecard.
 * Mirrors: title, semi-circular gauge, 5-row metrics table, scoring legend.
 */
export function RiskScorecardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-24 w-48 rounded-xl" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
          {['w-24', 'w-12', 'w-12', 'w-12', 'w-16', 'w-12'].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} ${i > 0 ? 'ml-auto' : ''}`} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0"
          >
            <Skeleton className="h-3 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className={`h-6 ${j === 2 ? 'w-8 rounded-full' : 'w-12'} ml-auto`} />
            ))}
          </div>
        ))}
      </div>
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the Risk Assessment pillar cards + overall verdict.
 * Mirrors: 5 pillar cards with label, score badge, progress bar, and observation text.
 */
export function RiskAssessmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-2 w-8" />
              <Skeleton className="h-2 w-8" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
      <div className="rounded-lg border border-border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the Loan Decision card.
 * Mirrors: verdict banner, risk/positive factor grid, recommendations, loan structure block.
 */
export function DecisionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-border px-5 py-4">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="space-y-1.5 text-right">
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-4 w-24 ml-auto" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, col) => (
          <div key={col} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" />
                  <Skeleton className={`h-3 ${i === 1 ? 'w-4/5' : 'w-full'}`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" />
              <Skeleton className={`h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}
