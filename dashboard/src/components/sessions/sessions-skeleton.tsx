"use client";

import { SkeletonBlock } from "@/components/ui/skeleton";

export function StatsBarSkeleton() {
  const labels = ["Active Sessions", "Total Cost Today", "Tool Calls Today", "Failures Today"];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      {labels.map((label, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--oj-border)] bg-[var(--oj-card-gradient)] p-4"
          role="group"
          aria-label={`${label}: loading`}
        >
          <SkeletonBlock className="h-4 w-24 mb-2" />
          <SkeletonBlock className="h-6 sm:h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SessionsTableSkeleton() {
  return (
    <div className="rounded-md border border-[var(--oj-border)] overflow-x-auto">
      {/* Header */}
      <div className="border-b border-[var(--oj-border)] bg-[var(--oj-surface-0)]">
        <div className="flex items-center px-4 py-3 gap-4">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-12" />
        </div>
      </div>
      {/* Rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex items-center px-4 py-3 gap-4 border-b border-[var(--oj-border)]"
        >
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-12" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SessionPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
      <StatsBarSkeleton />
      <SessionsTableSkeleton />
    </div>
  );
}
