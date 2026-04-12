"use client";

import { cn } from "@/lib/utils";
import { ToolCallInspector } from "./tool-call-inspector";
import { Badge } from "@/components/ui/badge";

interface SessionStepTraceItemProps {
  step: {
    // Master Truth StepPacket structure
    event?: {
      event_type?: string;
      step_number?: number;
      timestamp?: string;
    };
    request?: {
      model?: string;
    };
    model?: string; // for compatibility
    stop_reason?: string; // maybe present at root or in request
    usage?: {
      tokens_input?: number;
      tokens_output?: number;
      cost?: number;
    };
    tools?: Array<{
      tool_name: string;
      tool_input: Record<string, unknown>;
      fingerprint?: string;
    }>;
    error?: {
      type?: string;
      message?: string;
      details?: Record<string, unknown>;
    };
    // Optional duration if server computes it
    duration_ms?: number;
    // Backwards compatibility with other shapes
    step_number?: number;
    event_type?: string;
  };
}

export function SessionStepTraceItem({ step }: SessionStepTraceItemProps) {
  // Resolve step number and event type from either top-level or nested event
  const stepNumber = step.event?.step_number ?? step.step_number ?? 0;
  const eventType = step.event?.event_type ?? step.event_type ?? "unknown";
  const hasError = !!(step.error && (step.error.message || step.error.type));
  const hasTools = step.tools && step.tools.length > 0;

  // Determine badge based on event type and presence of error/tools
  let badgeVariant: "default" | "secondary" | "destructive" = "secondary";
  let badgeLabel = eventType;

  if (hasError) {
    badgeVariant = "destructive";
    badgeLabel = "error";
  } else if (hasTools) {
    badgeVariant = "default"; // amber
    badgeLabel = "tool_use";
  } else {
    // Map common event types to friendly labels
    if (eventType?.includes("start")) badgeLabel = "start";
    else if (eventType?.includes("end") || eventType?.includes("complete")) badgeLabel = "end_turn";
    else badgeLabel = eventType ?? "step";
  }

  const duration = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(2)}s` : "—";

  // Determine model
  const model = step.request?.model || step.model;

  // Determine stop reason: check root stop_reason or maybe inside step.response?.stop_reason
  const stopReason = step.stop_reason || (step as any)?.response?.stop_reason;

  return (
    <div className="relative pl-4 border-l-2 border-border">
      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-border" />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={badgeVariant}>
              {badgeLabel}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              Step {stepNumber}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            {model && <span className="text-foreground">{model}</span>}
            {stopReason && <span className="capitalize">({stopReason})</span>}
            {step.usage && (
              <span>
                {step.usage.tokens_input ?? 0}+{step.usage.tokens_output ?? 0} tokens
              </span>
            )}
            <span className="text-foreground">{duration}</span>
          </div>
        </div>

        {hasError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-2 text-sm">
            <div className="font-semibold text-destructive text-xs mb-1">
              {step.error?.type || "Error"}
            </div>
            <div className="text-destructive font-mono text-xs">
              {step.error?.message || "Unknown error"}
            </div>
            {step.error?.details && (
              <pre className="mt-1 overflow-x-auto text-xs font-mono text-destructive/80">
                {JSON.stringify(step.error.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        {hasTools && <ToolCallInspector tools={step.tools} />}
      </div>
    </div>
  );
}
