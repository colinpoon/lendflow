import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/30">
          <Skeleton className="h-3 w-24 flex-[2]" />
          <Skeleton className="h-3 w-14 flex-1" />
          <Skeleton className="h-3 w-10 flex-1" />
          <Skeleton className="h-3 w-16 flex-1" />
          <div className="w-7" />
        </div>

        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-b-0"
          >
            {/* Project name + subtitle */}
            <div className="flex-[2] space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>

            {/* Status badge */}
            <div className="flex-1">
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>

            {/* Risk score badge */}
            <div className="flex-1">
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>

            {/* Date */}
            <div className="flex-1">
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>

            {/* Action button */}
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
