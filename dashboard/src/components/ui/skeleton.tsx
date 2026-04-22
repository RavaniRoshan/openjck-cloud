"use client";

import { cn } from "@/lib/utils";

interface SkeletonBlockProps {
  className?: string;
  variant?: "default" | "running" | "failed";
}

export function SkeletonBlock({ className, variant = "default" }: SkeletonBlockProps) {
  const variantStyles = {
    default: "bg-[var(--oj-surface-2)]",
    running: "bg-[var(--oj-running-card-gradient)]",
    failed: "bg-[var(--oj-failed-card-gradient)]",
  };

  return (
    <div
      className={cn(
        "animate-shimmer rounded",
        variantStyles[variant],
        className
      )}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent 0%, var(--oj-surface-3) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}
