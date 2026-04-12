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
} from "lucide-react";

const navigation = {
  monitor: [
    { name: "Sessions", href: "/app/sessions", icon: Activity },
    { name: "Fleet", href: "/app/fleet", icon: Radio },
    { name: "Replay", href: "/app/replay", icon: PlaySquare },
  ],
  protect: [
    // Placeholder for future guard rules page
  ],
  debug: [
    { name: "Settings", href: "/app/settings", icon: Settings },
  ],
};

function SSEStatusIndicator() {
  const status = useSSEStore((state) => state.status);

  const statusConfig = {
    connecting: { color: "bg-yellow-500", text: "Connecting…" },
    connected: { color: "bg-green-500", text: "Live" },
    reconnecting: { color: "bg-yellow-500", text: "Reconnecting…" },
    disconnected: { color: "bg-red-500", text: "Disconnected" },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <span className={cn("relative flex h-2 w-2")}>
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.color)} />
        <span className={cn("relative inline-flex rounded-full h-2 w-2", config.color)} />
      </span>
      <span>{config.text}</span>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar flex flex-col">
      <div className="flex items-center h-12 px-4 border-b border-border">
        <h1 className="text-lg font-semibold text-accent">OpenJCK</h1>
      </div>
      <nav className="flex-1 p-2 space-y-6 overflow-y-auto">
        {/* MONITOR Section */}
        <div>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
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
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-background"
                      : "text-foreground hover:bg-muted"
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
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Protect
          </h2>
          <div className="space-y-1">
            <span className="px-3 py-2 text-sm text-muted-foreground italic">
              No guard rules configured
            </span>
          </div>
        </div>

        {/* DEBUG Section */}
        <div>
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
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
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-background"
                      : "text-foreground hover:bg-muted"
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

      {/* SSE Status */}
      <div className="border-t border-border p-2">
        <SSEStatusIndicator />
      </div>
    </aside>
  );
}
