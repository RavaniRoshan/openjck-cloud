"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { StaleDataBanner } from "@/components/layout/stale-data-banner";
import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar */}
          <div className="fixed inset-y-0 left-0 z-50 w-[220px] lg:hidden">
            <div className="h-full bg-sidebar border-r border-border">
              <div className="flex items-center justify-between h-12 px-4 border-b border-border">
                <h1 className="text-lg font-semibold text-accent">OpenJCK</h1>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 hover:bg-muted rounded"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-6 overflow-y-auto">
                <SidebarContent />
              </nav>
            </div>
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[220px] flex-shrink-0 border-r border-border bg-sidebar">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-auto p-4">
          <StaleDataBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

// Extracted sidebar navigation content (without wrapper)
function SidebarContent() {
  const pathname = usePathname();

  const navigation = {
    monitor: [
      { name: "Sessions", href: "/sessions", icon: Activity },
      { name: "Fleet", href: "/fleet", icon: Radio },
      { name: "Replay", href: "/replay", icon: PlaySquare },
    ],
    protect: [],
    debug: [
      { name: "Settings", href: "/settings", icon: Settings },
      { name: "Organization", href: "/settings/org", icon: Building2 },
      { name: "API Keys", href: "/settings/api-keys", icon: Key },
      { name: "Alert Hooks", href: "/settings/alerts", icon: Bell },
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

  return (
    <>
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
      <div className="border-t border-border p-2">
        <SSEStatusIndicator />
      </div>
    </>
  );
}
