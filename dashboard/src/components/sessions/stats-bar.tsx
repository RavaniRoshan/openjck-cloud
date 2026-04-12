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
      accent: "text-amber-500",
    },
    {
      label: "Total Cost Today",
      value: formatCurrency(totalCostToday),
      accent: "text-amber-500",
    },
    {
      label: "Tool Calls Today",
      value: formatNumber(toolCallsToday),
      accent: "text-foreground",
    },
    {
      label: "Failures Today",
      value: formatNumber(failuresToday),
      accent: "text-red-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="text-sm font-medium text-muted-foreground">
            {stat.label}
          </div>
          <div className={cn("mt-2 text-3xl font-bold font-mono", stat.accent)}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
