"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSSEStore } from "@/stores/sse-store";
import {
  Activity,
  Radio,
  PlaySquare,
  Settings,
  Shield,
  Bug,
  Key,
  Bell,
  Building2,
  Sparkles,
} from "lucide-react";

const navigation = {
  monitor: [
    { name: "Sessions", href: "/sessions", icon: Activity },
    { name: "Fleet", href: "/fleet", icon: Radio },
    { name: "Replay", href: "/replay", icon: PlaySquare },
  ],
  protect: [
    // Placeholder for future guard rules page
  ],
  debug: [
    { name: "Organization", href: "/settings/org", icon: Building2 },
    { name: "API Keys", href: "/settings/api-keys", icon: Key },
    { name: "AI Keys", href: "/settings/ai-keys", icon: Sparkles },
    { name: "Alert Hooks", href: "/settings/alerts", icon: Bell },
  ],
};

function SSEStatusIndicator() {
  const status = useSSEStore((state) => state.status);

  const statusConfig = {
    connecting: { color: "bg-amber-500", text: "Connecting…" },
    connected: { color: "bg-emerald-500", text: "Live" },
    reconnecting: { color: "bg-amber-500", text: "Reconnecting…" },
    disconnected: { color: "bg-slate-500", text: "Disconnected" },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--oj-text-muted)]">
      <span className={cn("relative flex h-2 w-2")}>
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", config.color)} 
              style={{ animationDuration: "2s" }} />
        <span className={cn("relative inline-flex rounded-full h-2 w-2", config.color)} />
      </span>
      <span>{config.text}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar flex flex-col bg-[var(--oj-sidebar-gradient)]">
      {/* Logo header with amber gradient badge */}
      <div className="flex items-center h-12 px-4 border-b border-[var(--oj-border-glass)] backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <span className="text-xs font-bold text-[var(--oj-bg)]">OJ</span>
          </div>
          <h1 className="text-lg font-semibold text-[var(--oj-text-primary)] tracking-tight">
            OpenJCK
          </h1>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-6 overflow-y-auto">
        {/* MONITOR Section */}
        <div>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--oj-text-muted)] mb-2">
            Monitor
          </h2>
          <div className="space-y-1">
            {navigation.monitor.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[var(--oj-accent-glow)] text-[var(--oj-text-primary)] border-l-2 border-amber-500"
                      : "text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)] hover:text-[var(--oj-text-primary)]"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* PROTECT Section */}
        <div>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--oj-text-muted)] mb-2">
            Protect
          </h2>
          <div className="space-y-1">
            <span className="px-3 py-2 text-sm text-[var(--oj-text-muted)] italic">
              No guard rules configured
            </span>
          </div>
        </div>

        {/* DEBUG Section */}
        <div>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--oj-text-muted)] mb-2">
            Debug
          </h2>
          <div className="space-y-1">
            {navigation.debug.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[var(--oj-accent-glow)] text-[var(--oj-text-primary)] border-l-2 border-amber-500"
                      : "text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)] hover:text-[var(--oj-text-primary)]"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* SSE Status Footer */}
      <div className="border-t border-[var(--oj-border-glass)] p-2">
        <SSEStatusIndicator />
      </div>
    </aside>
  );
}
