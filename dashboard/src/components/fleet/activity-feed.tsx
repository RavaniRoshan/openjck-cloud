"use client";

import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import type { FleetActivityEvent } from "@/lib/types";

interface ActivityFeedProps {
  events: FleetActivityEvent[];
  isLoading?: boolean;
}

// Determine color for event type
function getEventColor(eventType: FleetActivityEvent["event_type"]): string {
  switch (eventType) {
    case "session_start":
      return "text-amber-500";
    case "session_end":
      return "text-green-500";
    case "guard_triggered":
    case "loop_detected":
      return "text-red-500";
    case "step":
      return "text-zinc-500";
    default:
      return "text-muted-foreground";
  }
}

// Format timestamp to HH:MM:SS
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Virtualizer setup
  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24, // row height ~24px
    overscan: 5,
    // Don't recycle beyond 500 items as per spec
    // Use virtualizer's built-in recycling
  });

  // Auto-scroll to bottom when new events arrive (if not paused)
  useEffect(() => {
    if (!isPaused && parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [events, isPaused]);

  if (isLoading) {
    return (
      <div className="h-[200px] border border-border rounded-lg bg-card p-4 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading activity...</div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn(
        "h-[200px] overflow-y-auto border border-border rounded-lg bg-card"
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const event = events[virtualRow.index];
          if (!event) return null;

          const time = formatTime(event.timestamp);
          const colorClass = getEventColor(event.event_type);

          return (
            <div
              key={`${event.timestamp}-${event.session_id}-${virtualRow.index}`}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="flex items-center gap-3 px-3 text-xs border-b border-border/50 hover:bg-muted/30"
            >
              <span className="font-mono text-muted-foreground w-16 flex-shrink-0">
                [{time}]
              </span>
              <span className="font-mono text-foreground truncate max-w-[120px] flex-shrink-0" title={event.claw_name}>
                {event.claw_name}
              </span>
              <span className={cn("font-medium w-24 flex-shrink-0", colorClass)}>
                {event.event_type}
              </span>
              <span className="text-muted-foreground truncate flex-1">
                {event.detail}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
