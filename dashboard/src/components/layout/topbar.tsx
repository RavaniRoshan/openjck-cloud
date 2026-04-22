"use client";

import { Bell, Search, User, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSSEStore } from "@/stores/sse-store";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase/client";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const sseStatus = useSSEStore((state) => state.status);
  const sseStore = useSSEStore();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Build breadcrumb from pathname
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbItems = [
    { label: "OpenJCK", href: "/app" },
    ...pathSegments.map((segment, index) => {
      const href = "/" + pathSegments.slice(0, index + 1).join("/");
      const label = segment.charAt(0).toUpperCase() + segment.slice(1);
      return { label, href };
    }),
  ];

  return (
    <header className="topbar flex items-center justify-between px-4 bg-[var(--oj-topbar-bg)] backdrop-blur-[12px] border-b border-[var(--oj-border-glass)]">
      {/* Left side: Menu button (mobile) + Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1 hover:bg-[var(--oj-surface-hover)] rounded-md transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-[var(--oj-text-secondary)]" />
          </button>
        )}
        <nav className="flex items-center gap-2 text-sm text-[var(--oj-text-muted)] truncate">
          {breadcrumbItems.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-[var(--oj-text-muted)]/50">/</span>}
              <span
                className={cn(
                  index === breadcrumbItems.length - 1
                    ? "text-[var(--oj-text-primary)] font-medium"
                    : "text-[var(--oj-text-secondary)] hover:text-[var(--oj-text-primary)] transition-colors"
                )}
              >
                {item.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Center: Search */}
      <div className="flex items-center gap-4 flex-1 justify-center">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--oj-text-muted)]" />
          <input
            type="search"
            placeholder="Search sessions, agents..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--oj-surface-2)] border border-[var(--oj-border)] rounded-md text-[var(--oj-text-primary)] placeholder-[var(--oj-text-muted)] focus:outline-none focus:border-[var(--oj-accent)] transition-colors"
          />
        </div>
      </div>

      {/* Right side: SSE status, Clock, Notifications, User */}
      <div className="flex items-center gap-4">
        {/* SSE Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "h-2 w-2 rounded-full inline-block",
              sseStatus === "connected" && "bg-emerald-500",
              (sseStatus === "reconnecting" || sseStatus === "connecting") && "bg-amber-500 animate-pulse",
              sseStatus === "disconnected" && "bg-slate-500"
            )}
          />
          <span className="hidden sm:inline text-[var(--oj-text-muted)]">
            {sseStatus === "connected"
              ? "Live"
              : sseStatus === "reconnecting"
              ? "Reconnecting..."
              : sseStatus === "connecting"
              ? "Connecting..."
              : "Disconnected"}
          </span>
          {sseStatus === "disconnected" && (
            <button
              type="button"
              onClick={() => sseStore.requestRetry()}
              className="text-xs text-[var(--oj-accent)] hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Retry connection"
            >
              Retry
            </button>
          )}
        </div>

        {/* Live Clock — centered, monospaced */}
        <div className="font-mono text-sm text-[var(--oj-text-muted)] hidden md:block">
          {currentTime}
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-[var(--oj-surface-hover)] text-[var(--oj-text-secondary)] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-[var(--oj-danger)] rounded-full" />
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-md hover:bg-[var(--oj-surface-hover)] text-[var(--oj-text-secondary)] transition-colors">
            <User className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[var(--oj-surface-1)] border-[var(--oj-border)]">
            <DropdownMenuItem className="text-[var(--oj-text-primary)]">Profile</DropdownMenuItem>
            <DropdownMenuItem className="text-[var(--oj-text-primary)]">Settings</DropdownMenuItem>
            <DropdownMenuItem
              className="text-[var(--oj-danger)]"
              onClick={async () => {
                const supabase = createBrowserClient();
                await supabase.auth.signOut();
                router.push('/login');
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
