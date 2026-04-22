"use client";

import { cn } from "@/lib/utils";
import { ToolCallInspector } from "./tool-call-inspector";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Circle } from "lucide-react";
import { useState } from "react";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDurationShort(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    const secs = Math.floor(seconds);
    const remMs = ms % 1000;
    return remMs > 0 ? `${secs}.${(remMs / 100).toFixed(0)}s` : `${secs}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

interface SessionStepTraceItemProps {
  step: {
    event?: {
      event_type?: string;
      step_number?: number;
      timestamp?: string;
    };
    request?: {
      model?: string;
    };
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
    step_number?: number;
    event_type?: string;
  };
}

export function SessionStepTraceItem({ step }: SessionStepTraceItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stepNumber = step.event?.step_number ?? step.step_number ?? 0;
  const eventType = step.event?.event_type ?? step.event_type ?? "unknown";
  const hasError = !!(step.error && (step.error.message || step.error.type));
  const hasTools = step.tools && step.tools.length > 0;
  const stopReason = step.stop_reason || (step as any)?.response?.stop_reason;

  // Determine dot color based on state
  const dotColor = hasError
    ? "bg-[var(--oj-danger)]"
    : hasTools
    ? "bg-amber-500"
    : "bg-emerald-500";

  // Determine badge styling
  const badgeClasses = cn(
    "text-xs font-medium px-2 py-0.5 rounded-full border-0",
    hasTools ? "bg-amber-500/20 text-amber-400" : "bg-[var(--oj-surface-2)] text-[var(--oj-text-secondary)]",
    hasError && "bg-[var(--oj-danger-muted)] text-[var(--oj-danger)]"
  );

  const duration = step.duration_ms ? formatDurationShort(step.duration_ms) : "—";
  const model = step.request?.model || step.model;

  return (
    <div className="relative pl-4 border-l-2 border-[var(--oj-border)] animate-fade-up">
      {/* Timeline dot */}
      <div className={cn("absolute -left-[5px] top-0 w-2 h-2 rounded-full", dotColor)} />

      <div className="space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Expand/collapse trigger if there are tools */}
             {hasTools && (
               <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                 <CollapsibleTrigger>
                   <button className="p-0.5 hover:bg-[var(--oj-surface-hover)] rounded transition-colors">
                     <ChevronDown className={cn(
                       "h-4 w-4 text-[var(--oj-text-muted)] transition-transform",
                       isOpen && "transform rotate-180"
                     )} />
                   </button>
                 </CollapsibleTrigger>
               </Collapsible>
             )}
            <span className="font-mono text-xs text-[var(--oj-text-muted)]">
              Step {String(stepNumber).padStart(2, "0")}
            </span>
            <span className={badgeClasses}>
              {stopReason || eventType}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[var(--oj-text-muted)]">
             {model && (
               <Tooltip>
                 <TooltipTrigger>
                   <span className="text-[var(--oj-text-secondary)] cursor-help hover:text-[var(--oj-text-primary)] transition-colors">
                     {model}
                   </span>
                 </TooltipTrigger>
                 <TooltipContent>Model: {model}</TooltipContent>
               </Tooltip>
             )}
             {step.usage && (
               <Tooltip>
                 <TooltipTrigger>
                   <span className="cursor-help">
                     {formatNumber(step.usage.tokens_input ?? 0)} in / {formatNumber(step.usage.tokens_output ?? 0)} out
                   </span>
                 </TooltipTrigger>
                 <TooltipContent>
                   Input: {step.usage.tokens_input ?? 0} | Output: {step.usage.tokens_output ?? 0}
                 </TooltipContent>
               </Tooltip>
             )}
             <Tooltip>
               <TooltipTrigger>
                 <span className="text-[var(--oj-text-secondary)] cursor-help">{duration}</span>
               </TooltipTrigger>
               <TooltipContent>
                 {step.duration_ms ? `${step.duration_ms}ms` : "N/A"}
               </TooltipContent>
             </Tooltip>
          </div>
        </div>

        {/* Error block */}
        {hasError && (
          <div className="bg-[var(--oj-danger-muted)] border-l-2 border-[var(--oj-danger)] rounded p-3 text-sm animate-fade-up">
            <div className="font-semibold text-[var(--oj-danger)] text-xs mb-1">
              {step.error?.type || "Error"}
            </div>
            <div className="font-mono text-xs text-[var(--oj-danger)]">
              {step.error?.message || "Unknown error"}
            </div>
            {step.error?.details && (
              <pre className="mt-1 overflow-x-auto text-xs font-mono text-[var(--oj-danger)]/80">
                {JSON.stringify(step.error.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Tool call inspector (collapsible) */}
        {hasTools && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleContent>
              <div className="pt-2 animate-fade-up">
                <ToolCallInspector tools={step.tools} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
