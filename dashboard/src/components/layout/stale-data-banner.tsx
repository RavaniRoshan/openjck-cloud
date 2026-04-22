"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useSSEStore } from "@/stores/sse-store";

/**
 * Stale Data Banner Component
 * Shows a warning when SSE has been disconnected for over 60 seconds
 * Triggers data reconciliation on reconnect after >30s disconnect
 */
export function StaleDataBanner() {
  const { status, disconnectedAt, requestRetry, lastConnectedAt } = useSSEStore();
  const [, setTick] = useState(0);

  // Update every second to check if stale threshold crossed
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Show banner after 60s disconnected
  const isStale =
    status === "disconnected" &&
    disconnectedAt !== null &&
    Date.now() - disconnectedAt > 60_000;

  // Show reconnecting banner after 10s of reconnection attempts
  const isReconnectingLong =
    status === "reconnecting" &&
    lastConnectedAt !== null &&
    Date.now() - lastConnectedAt > 10_000;

  if (!isStale && !isReconnectingLong) return null;

  const message = isStale
    ? "You have been disconnected for over a minute. The information shown may be out of date."
    : "Attempting to reconnect to server...";

  return (
    <div className="mb-4 rounded-md border border-[var(--oj-accent)]/50 bg-[var(--oj-accent)]/10 p-4">
      <div className="flex items-start gap-3">
        <RefreshCw className="h-5 w-5 text-[var(--oj-accent)] mt-0.5 animate-spin" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[var(--oj-accent)]">
            Data may be stale
          </h3>
          <p className="mt-1 text-sm text-[var(--oj-accent)]/80">
            {message}
          </p>
        </div>
        {isStale && (
          <button
            type="button"
            onClick={requestRetry}
            className="ml-2 px-3 py-1 text-xs font-medium rounded border border-[var(--oj-accent)]/50 text-[var(--oj-accent)] hover:bg-[var(--oj-accent)]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oj-accent)]"
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  );
}
