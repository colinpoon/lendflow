import { Skeleton } from '@/components/ui/skeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Inline skeleton components — mirror the real content layouts so the loading
// state feels proportional rather than like a blank page.
// ─────────────────────────────────────────────────────────────────────────────

/** Mimics the FinancialTable card: header row + 10 data rows with label + year value columns. */
function FinancialTableSkeleton() {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Column header row */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
        <Skeleton className="h-3 w-36" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-14 ml-auto" />
        ))}
      </div>

      {/* Data rows — alternating background mirrors zebra striping */}
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
 * Mimics the Quantitative Risk Scorecard:
 * - Semi-circular gauge placeholder
 * - 5-row metrics table
 * - Scoring legend strip
 */
function RiskScorecardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-64" />
      </div>

      {/* Gauge placeholder — matches the w-48 h-24 SVG gauge + score + band badge */}
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-24 w-48 rounded-xl" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Trend summary */}
      <div className="flex justify-center">
        <Skeleton className="h-3 w-72" />
      </div>

      {/* Metrics table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
          {['w-24', 'w-12', 'w-12', 'w-12', 'w-16', 'w-12'].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w} ${i > 0 ? 'ml-auto' : ''}`} />
          ))}
        </div>

        {/* 5 metric rows */}
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

      {/* Scoring legend */}
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-5 gap-2">
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
 * Mimics the Risk Assessment card (WeightedRiskGauge / RiskAssessment pillars):
 * - 5 pillar cards, each with label + score badge + progress bar + observation text
 * - Overall verdict block at the bottom
 */
function RiskAssessmentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-48" />

      {/* 5 pillar cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
          {/* Header: pillar name + badges */}
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <Skeleton className="h-2 w-8" />
              <Skeleton className="h-2 w-8" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
          </div>

          {/* Observation text — two lines */}
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}

      {/* Overall verdict block */}
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
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Mimics the Loan Decision card:
 * - Verdict banner (decision icon + text + risk band)
 * - Risk factors + positive factors grid
 * - Recommendations list
 * - Suggested loan structure block
 */
function DecisionSkeleton() {
  return (
    <div className="space-y-5">
      {/* Verdict banner */}
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

      {/* Risk / Positive factors grid */}
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

      {/* Recommendations */}
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

      {/* Suggested loan structure */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Page-level loading shell
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectDetailLoading() {
  return (
    <article className="container mx-auto max-w-5xl px-6 py-6 space-y-6 text-sm">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Project header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-40" />
      </div>

      {/* Hero metric cards — grid-cols-4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-2xl p-5 space-y-3 min-h-[140px] flex flex-col justify-between">
            <Skeleton className="h-3 w-20" />
            <div className="space-y-1.5 mt-auto">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Sticky nav */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-2.5 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-md" />
          ))}
        </div>
      </div>

      {/* Upload section card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>

      {/* Analysis section — Financial Summary card */}
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <FinancialTableSkeleton />
        </div>
      </div>

      {/* Risk section — Quantitative Risk Scorecard card */}
      <div className="space-y-4">
        <div className="border border-border rounded-lg p-6 space-y-4">
          <Skeleton className="h-5 w-52" />
          <RiskScorecardSkeleton />
        </div>

        {/* Risk Assessment card */}
        <div className="border border-border rounded-lg p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <RiskAssessmentSkeleton />
        </div>
      </div>

      {/* Decision section */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-80" />
        </div>
        <DecisionSkeleton />
      </div>
    </article>
  );
}
