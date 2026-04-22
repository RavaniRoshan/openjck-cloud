"use client";

import { SkeletonBlock } from "@/components/ui/skeleton";

export function StepSkeleton() {
  return (
    <div className="relative pl-4 border-l-2 border-[var(--oj-border)] space-y-2">
      {/* Timeline dot */}
      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-[var(--oj-border)]" />

      {/* Step header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
      </div>

      {/* Step content */}
      <div className="space-y-2">
        <SkeletonBlock className="h-16 w-full rounded" />
        <SkeletonBlock className="h-12 w-2/3 rounded" />
      </div>
    </div>
  );
}
