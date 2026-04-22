"use client";

import { SkeletonBlock } from "@/components/ui/skeleton";

export function FleetHealthBarSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-[var(--oj-border)] rounded-lg bg-[var(--oj-card-gradient)] flex-wrap">
      <SkeletonBlock className="h-6 w-24" />
      <SkeletonBlock className="h-6 w-24" />
      <SkeletonBlock className="h-6 w-16" />
      <SkeletonBlock className="h-6 w-20" />
      <SkeletonBlock className="h-4 w-px bg-[var(--oj-border)]" />
      <SkeletonBlock className="h-5 w-20" />
      <SkeletonBlock className="h-6 w-20" />
    </div>
  );
}

export function FleetControlsSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-8 w-32" />
      <SkeletonBlock className="h-8 w-64" />
    </div>
  );
}

export function FleetGridSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--oj-border)] bg-[var(--oj-card-gradient)] p-4 min-h-[140px]"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <SkeletonBlock className="h-5 w-24" />
            <SkeletonBlock className="h-5 w-12" />
          </div>
          <div className="flex items-center gap-3 text-xs mb-3">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-12" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          <div className="pt-2 border-t border-[var(--oj-border)]">
            <SkeletonBlock className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="h-[200px] border border-[var(--oj-border)] rounded-lg bg-[var(--oj-card-gradient)] p-4">
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FleetPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-4 w-24" />
      </div>
      <FleetHealthBarSkeleton />
      <FleetControlsSkeleton />
      <FleetGridSkeleton />
      <div>
        <SkeletonBlock className="h-6 w-28 mb-2" />
        <ActivityFeedSkeleton />
      </div>
    </div>
  );
}
