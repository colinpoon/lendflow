import { Skeleton } from '@/components/ui/skeleton';

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
          <div key={i} className="border border-border rounded-lg p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-14" />
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

      {/* Upload card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-80" />
        </div>
        <Skeleton className="h-36 w-full rounded-lg" />
      </div>
    </article>
  );
}
