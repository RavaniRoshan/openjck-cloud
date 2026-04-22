"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { useAIFix, useAIFixDeeper } from "@/hooks/use-ai-fix";
import { AiFixResult, AiFixState } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AiFixPanelProps {
  sessionId: string;
  hasRecording: boolean;
  cachedResult?: AiFixResult;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const config = {
    high: {
      className: "bg-[#22c55e]/20 text-[#22c55e] border-0 font-medium",
      label: "High confidence",
    },
    medium: {
      className: "bg-[#f59e0b]/20 text-[#f59e0b] border-0 font-medium",
      label: "Medium confidence",
    },
    low: {
      className: "bg-[#ef4444]/20 text-[#ef4444] border-0 font-medium",
      label: "Low confidence",
    },
  } as const;

  const conf = config[confidence as keyof typeof config] || config.medium;

  return (
    <Badge className={conf.className}>
      {conf.label}
    </Badge>
  );
}

function FixTypeBadge({ fix_type }: { fix_type: string }) {
  const colors: Record<string, string> = {
    prompt: "border-blue-500 text-blue-500",
    tool_definition: "border-cyan-500 text-cyan-500",
    guard_config: "border-amber-500 text-amber-500",
    code: "border-green-500 text-green-500",
    unknown: "border-muted-foreground text-muted-foreground",
  };

  const humanReadable: Record<string, string> = {
    prompt: "Prompt",
    tool_definition: "Tool Definition",
    guard_config: "Guard Config",
    code: "Code Change",
    unknown: "Unknown",
  };

  const colorClass = colors[fix_type] || colors.unknown;

  return (
    <Badge variant="outline" className={colorClass}>
      {humanReadable[fix_type] || fix_type}
    </Badge>
  );
}

function AnalysisCard({
  result,
  isFollowUp = false,
}: {
  result: AiFixResult;
  isFollowUp?: boolean;
}) {
  return (
    <div className="mt-4 border border-amber-500/50 bg-amber-500/5 rounded-lg overflow-hidden">
        <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {isFollowUp ? (
              <>
                <RefreshCw className="h-4 w-4 text-amber-500" />
                Follow-up Analysis
              </>
            ) : (
              "AI Fix Analysis"
            )}
          </h3>
          <div className="flex items-center gap-2">
            <ConfidenceBadge confidence={result.confidence} />
            <FixTypeBadge fix_type={result.fix_type} />
            {/* Key mode indicator */}
            {!isFollowUp && result._meta?.key_mode === 'byok' && (
              <span className="text-xs text-[var(--oj-text-muted)] font-mono">
                via your key
              </span>
            )}
            {!isFollowUp && result._meta?.key_mode === 'hosted' && (
              <span className="text-xs text-[var(--oj-text-muted)]">
                via OpenJCK
              </span>
            )}
          </div>
        </div>
        {isFollowUp && result.based_on_previous && (
          <div className="text-xs text-muted-foreground mb-3">
            Based on previous analysis
          </div>
        )}

        {/* Root Cause */}
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Root Cause
          </Label>
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
            {result.root_cause}
          </p>
        </div>

        {/* Suggested Fix */}
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Suggested Fix
          </Label>
          <div className="mt-1 p-3 rounded bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {result.fix}
            </p>
          </div>
        </div>

        {/* Verification Test */}
        <div className="mb-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Verification Test
          </Label>
          <div className="mt-1 p-3 rounded bg-muted border border-border overflow-x-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
              {result.verification_test}
            </pre>
          </div>
        </div>

        {/* Analyzed At */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          Analyzed at: {new Date(result.analyzed_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="mt-4 border border-amber-500/50 bg-amber-500/5 rounded-lg">
      <div className="py-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          <div className="text-sm text-muted-foreground">
            Analyzing with Claude...
          </div>
          <div className="text-xs text-muted-foreground">
            This may take a few seconds
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-4 border border-destructive rounded-lg">
      <div className="py-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div className="text-sm font-medium text-destructive">
            Analysis failed
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Something went wrong while analyzing the session. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AiFixPanel({ sessionId, hasRecording, cachedResult }: AiFixPanelProps) {
  const router = useRouter();
  const [state, setState] = useState<AiFixState>(() => cachedResult ? "result" : "idle");
  const [followUpInput, setFollowUpInput] = useState("");
  const [hasDeeper, setHasDeeper] = useState(false);
  const [deeperResults, setDeeperResults] = useState<AiFixResult[]>([]);
  const [errorDetails, setErrorDetails] = useState<{ key_mode?: string; error?: string } | null>(null);

  const aiFixMutation = useAIFix();
  const aiFixDeeperMutation = useAIFixDeeper();

  // Reset state when session changes
  useEffect(() => {
    if (cachedResult) {
      setState("result");
    } else {
      setState("idle");
    }
    setFollowUpInput("");
    setHasDeeper(false);
    setDeeperResults([]);
  }, [sessionId, cachedResult]);

  const handleStartAnalysis = () => {
    if (!hasRecording) return;

    if (cachedResult) {
      setState("result");
      return;
    }

    if (aiFixMutation.data) {
      setState("result");
      return;
    }

    setState("loading");
    setErrorDetails(null);
    aiFixMutation.mutate(sessionId, {
      onSuccess: () => {
        setState("result");
      },
      onError: (error: any) => {
        // Check for BYOK key failure
        if (error.response?.data?.key_mode === 'byok') {
          setErrorDetails({
            key_mode: 'byok',
            error: error.response.data.error
          });
          setState("error");
        } else if (error.message.includes("429") || error.message.includes("Rate limit")) {
          setState("rate_limited");
        } else {
          setState("error");
        }
      },
    });
  };

  const handleDeeperAnalysis = () => {
    if (!followUpInput.trim() || hasDeeper) return;

    setState("loading");
    aiFixDeeperMutation.mutate(
      { sessionId, followUp: followUpInput.trim() },
      {
        onSuccess: (result) => {
          setDeeperResults((prev) => [...prev, result]);
          setFollowUpInput("");
          setHasDeeper(true);
          setState("result");
        },
        onError: () => {
          setState("error");
        },
      }
    );
  };

  // Rate limited state
  if (state === "rate_limited") {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-foreground mb-1">
          Rate limit reached
        </h3>
        <p className="text-xs text-muted-foreground">
          You can perform up to 10 analyses per hour. Please wait before trying
          again.
        </p>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    // Special error state for BYOK key failure
    if (errorDetails?.key_mode === 'byok') {
      return (
        <div className="p-4 rounded-md border border-[var(--oj-danger)] bg-[var(--oj-danger-muted)]">
          <p className="text-sm font-medium text-[var(--oj-danger)]">Your Anthropic key failed</p>
          <p className="text-xs text-[var(--oj-text-muted)] mt-1">
            {errorDetails.error}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 text-xs"
            onClick={() => router.push('/settings/ai-keys')}
          >
            Update key in Settings
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      );
    }

    return (
      <div className="p-4">
        <ErrorCard onRetry={handleStartAnalysis} />
      </div>
    );
  }

  // Loading state (show loading card if either main or deeper is loading)
  if (
    state === "loading" ||
    aiFixMutation.isPending ||
    aiFixDeeperMutation.isPending
  ) {
    return (
      <div className="p-4">
        <LoadingCard />
      </div>
    );
  }

  // Idle state
  if (state === "idle") {
    const disabled = !hasRecording;

  const button = (
    <Button
      variant="outline"
      size="lg"
      onClick={handleStartAnalysis}
      disabled={disabled}
      className="gap-2 min-w-[200px]"
    >
      🔍 AI Fix
    </Button>
  );

  return (
    <div className="p-6 flex flex-col items-center justify-center">
      {disabled ? (
        <Tooltip>
          <TooltipTrigger>{button}</TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">
              AI Fix requires v0.6+ session recordings.
            </p>
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      {!hasRecording && (
        <p className="text-xs text-muted-foreground mt-2">
          AI Fix requires v0.6+ session recordings.
        </p>
      )}
    </div>
  );
  }

  // Result state
  const mainResult = aiFixMutation.data || cachedResult;
  if (!mainResult) return null;

  return (
    <div className="p-4 space-y-4">
      <AnalysisCard result={mainResult} />

      {/* Deeper analysis results */}
      {deeperResults.map((result, idx) => (
        <AnalysisCard key={idx} result={result} isFollowUp />
      ))}

      {/* Go deeper input */}
      {!hasDeeper && (
        <div className="mt-4 pt-4 border-t border-border">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Go deeper →
            </Label>
          <div className="flex gap-2">
            <Input
              placeholder="Ask a follow-up question..."
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && followUpInput.trim()) {
                  e.preventDefault();
                  handleDeeperAnalysis();
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleDeeperAnalysis}
              disabled={!followUpInput.trim()}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {hasDeeper && (
        <div className="text-center text-xs text-muted-foreground pt-2">
          Follow-up used. Start a new analysis to continue.
        </div>
      )}
    </div>
  );
}