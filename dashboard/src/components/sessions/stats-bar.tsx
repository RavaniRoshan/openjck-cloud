"use client";

import { ClawSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isToday } from "date-fns";

interface StatsBarProps {
  sessions: ClawSession[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

interface StatCardProps {
  label: string;
  value: string;
  variant?: "default" | "active" | "danger";
  className?: string;
}

function StatCard({ label, value, variant = "default", className }: StatCardProps) {
  const variantStyles = {
    default: {
      card: "bg-[var(--oj-stat-gradient)] border-[var(--oj-border)]",
      label: "text-[var(--oj-text-muted)]",
      value: "text-[var(--oj-text-primary)]",
    },
    active: {
      card: "bg-[var(--oj-running-card-gradient)] border-l-3 border-amber-500 animate-amber-glow",
      label: "text-[var(--oj-text-muted)]",
      value: "text-amber-400",
    },
    danger: {
      card: "bg-[var(--oj-failed-card-gradient)] border-l-3 border-[var(--oj-danger)]",
      label: "text-[var(--oj-text-muted)]",
      value: "text-[var(--oj-danger)]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "rounded-lg border bg-[var(--oj-card-gradient)] p-4 transition-all duration-300",
        styles.card,
        className
      )}
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div className={cn("text-xs font-semibold uppercase tracking-[0.15em]", styles.label)}>
        {label}
      </div>
      <div className={cn("mt-2 text-2xl sm:text-3xl font-bold font-mono", styles.value)}>
        {value}
      </div>
    </div>
  );
}

export function StatsBar({ sessions }: StatsBarProps) {
  // Filter to sessions that started today
  const todaySessions = sessions.filter((s) => s.started_at && isToday(new Date(s.started_at)));

  const activeSessions = sessions.filter((s) => s.status === "running").length;
  const totalCostToday = todaySessions.reduce((sum, s) => sum + (s.total_cost_usd || 0), 0);
  const toolCallsToday = todaySessions.reduce((sum, s) => sum + (s.tool_calls || 0), 0);
  const failuresToday = todaySessions.filter((s) => s.status === "failed" || s.status === "terminated").length;

  const stats = [
    {
      label: "Active Sessions",
      value: formatNumber(activeSessions),
      variant: activeSessions > 0 ? "active" as const : "default" as const,
    },
    {
      label: "Total Cost Today",
      value: formatCurrency(totalCostToday),
      variant: "default" as const,
    },
    {
      label: "Tool Calls Today",
      value: formatNumber(toolCallsToday),
      variant: "default" as const,
    },
    {
      label: "Failures Today",
      value: formatNumber(failuresToday),
      variant: failuresToday > 0 ? "danger" as const : "default" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          label={stat.label}
          value={stat.value}
          variant={stat.variant}
        />
      ))}
    </div>
  );
}
