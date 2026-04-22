"use client";

import { cn } from "@/lib/utils";
import { SessionStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: SessionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = {
    running: {
      dot: "bg-amber-500 animate-amber-pulse",
      label: "Running",
      textColor: "text-amber-400",
      bg: "bg-[var(--oj-accent-glow)]",
    },
    completed: {
      dot: "bg-emerald-500",
      label: "Done",
      textColor: "text-emerald-400",
      bg: "bg-[var(--oj-success-muted)]",
    },
    failed: {
      dot: "bg-red-500",
      label: "Failed",
      textColor: "text-red-400",
      bg: "bg-[var(--oj-danger-muted)]",
    },
    terminated: {
      dot: "bg-slate-500",
      label: "Stopped",
      textColor: "text-slate-400",
      bg: "bg-[var(--oj-surface-2)]",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border-0",
      config.bg,
      config.textColor,
      className
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </div>
  );
}
