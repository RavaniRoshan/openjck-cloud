"use client";

export function ApiKeysTableSkeleton() {
  return (
    <div className="border rounded-lg">
      <div className="border-b border-border bg-muted/30">
        <div className="flex items-center px-4 py-3 gap-4">
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded ml-auto" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-center px-4 py-3 gap-4 border-b border-border last:border-b-0 animate-skeleton-pulse"
        >
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-5 w-14 bg-muted rounded" />
          <div className="h-8 w-16 bg-muted rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function ApiKeysPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-24 bg-muted rounded animate-skeleton-pulse" />
          <div className="h-4 w-48 bg-muted rounded mt-2 animate-skeleton-pulse" />
        </div>
        <div className="h-9 w-28 bg-muted rounded animate-skeleton-pulse" />
      </div>
      <ApiKeysTableSkeleton />
    </div>
  );
}