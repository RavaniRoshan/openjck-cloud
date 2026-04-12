"use client";

import { SessionStepTraceItem } from "./session-step-trace-item";
import { StepSkeleton } from "./step-skeleton";

interface SessionStepTraceProps {
  steps?: Array<{
    step_number: number;
    event_type: string;
    model?: string;
    stop_reason?: string;
    usage?: {
      tokens_input: number;
      tokens_output: number;
      cost: number;
    };
    tools?: Array<{
      tool_name: string;
      tool_input: Record<string, unknown>;
      fingerprint?: string;
    }>;
    error?: {
      type: string;
      message: string;
      details?: Record<string, unknown>;
    };
    duration_ms?: number;
  }>;
  isLoading?: boolean;
}

export function SessionStepTrace({ steps, isLoading }: SessionStepTraceProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StepSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!steps || steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        No steps recorded
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {steps.map((step, idx) => (
        <SessionStepTraceItem key={step.step_number || idx} step={step} />
      ))}
    </div>
  );
}
