"use client";

import { Repeat, X } from "lucide-react";
import { ClawSession } from "@/lib/types";
import { useState } from "react";

interface LoopWarningBannerProps {
  sessions: ClawSession[];
}

export function LoopWarningBanner({ sessions }: LoopWarningBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loopSessions = sessions.filter((s) => s.loop_detected && !dismissed.has(s.session_id));

  if (loopSessions.length === 0) {
    return null;
  }

  const handleDismiss = (sessionId: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
  };

  return (
    <div className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <Repeat className="h-5 w-5 text-amber-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-amber-500">
            Loop Detected in {loopSessions.length} Session{loopSessions.length > 1 ? "s" : ""}
          </h3>
          <p className="mt-1 text-sm text-amber-500/80">
            One or more sessions are stuck in a loop. Review the agent&apos;s instructions and tools.
          </p>
          <ul className="mt-2 list-disc list-inside text-sm text-amber-500/80">
            {loopSessions.slice(0, 5).map((session) => (
              <li key={session.session_id} className="flex items-center justify-between group">
                <span>
                  <span className="font-mono text-amber-500">
                    {session.session_id.slice(0, 8)}...
                  </span>{" "}
                  ({session.claw_name})
                </span>
                <button
                  type="button"
                  onClick={() => handleDismiss(session.session_id)}
                  className="ml-2 p-0.5 rounded hover:bg-amber-500/20 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-500"
                  aria-label="Dismiss loop warning for session"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
            {loopSessions.length > 5 && (
              <li>...and {loopSessions.length - 5} more</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
