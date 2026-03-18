import { Skeleton } from '@/components/ui/skeleton';

export default function NewProjectLoading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Page header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Form card */}
      <div className="border border-border rounded-lg p-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        {/* Fields */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}
