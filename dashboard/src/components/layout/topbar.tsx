"use client";

import { Bell, Search, User, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSSEStore } from "@/stores/sse-store";
import { cn } from "@/lib/utils";

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function Topbar() {
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const sseStatus = useSSEStore((state) => state.status);

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
    <header className="topbar flex items-center justify-between px-4">
      {/* Left side: Breadcrumb */}
      <div className="flex items-center gap-2 flex-1">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbItems.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span className="text-muted-foreground/50">/</span>}
              <span
                className={cn(
                  index === breadcrumbItems.length - 1
                    ? "text-foreground font-medium"
                    : "hover:text-foreground transition-colors"
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
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search sessions, agents..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
          />
        </div>
      </div>

      {/* Right side: SSE status indicator, Live clock, Notifications, User */}
      <div className="flex items-center gap-4">
        {/* SSE Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {sseStatus === "connected" || sseStatus === "reconnecting" ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <span className="hidden sm:inline text-muted-foreground">
            {sseStatus === "connected" ? "Live" : sseStatus}
          </span>
        </div>

        {/* Live Clock */}
        <div className="font-mono text-sm text-muted-foreground hidden md:block">
          {currentTime}
        </div>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-md hover:bg-muted text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
        </button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="p-2 rounded-md hover:bg-muted text-foreground">
            <User className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
