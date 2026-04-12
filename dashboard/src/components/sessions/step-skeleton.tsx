"use client";

import { cn } from "@/lib/utils";

export function StepSkeleton() {
  return (
    <div className="relative pl-4 border-l-2 border-border space-y-2 animate-pulse">
      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-border" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-5 w-16 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-3 w-24 bg-muted rounded" />
          <div className="h-3 w-12 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-16 bg-muted rounded w-full" />
        <div className="h-12 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}
