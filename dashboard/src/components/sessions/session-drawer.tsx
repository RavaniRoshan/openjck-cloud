"use client";

import { useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui-store";
import { useSession, useSessionSteps, useHasRecording } from "@/hooks/use-sessions";
import { SessionDrawerHeader } from "./session-drawer-header";
import { SessionStepTrace } from "./session-step-trace";
import { StepSkeleton } from "./step-skeleton";
import { AiFixPanel } from "./ai-fix-panel";

export function SessionDrawer() {
  const { activeSessionId, sessionDrawerOpen, closeSession } = useUIStore();

  const { data: session, isLoading: sessionLoading } = useSession(activeSessionId || "");
  const { data: steps, isLoading: stepsLoading } = useSessionSteps(activeSessionId || "");
  const { data: recordingStatus } = useHasRecording(activeSessionId || "");

  // Close on Escape? Could add later. For now, Sheet handles overlay click.

  // Determine if AI Fix tab should be shown (failed or terminated)
  const showFixTab = session?.status === "failed" || session?.status === "terminated";

  return (
    <Sheet open={sessionDrawerOpen} onOpenChange={(open) => !open && closeSession()}>
      <SheetContent side="right" className="w-[600px] bg-surface border-l border-border p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          {sessionLoading ? (
            <div className="border-b border-border p-4 bg-surface">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="mt-2 h-4 w-32 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <SessionDrawerHeader session={session ?? null} recordingStatus={recordingStatus ?? null} />
          )}

          {/* Tabs */}
          <Tabs defaultValue="trace" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-surface px-4 py-2 gap-2">
              <TabsTrigger value="trace">Trace</TabsTrigger>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              {showFixTab && <TabsTrigger value="fix">AI Fix</TabsTrigger>}
            </TabsList>

            {/* Content with ScrollArea */}
            <ScrollArea className="flex-1">
              <TabsContent value="trace" className="m-0 data-[state=inactive]:hidden">
                {stepsLoading ? (
                  <div className="p-4 space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <StepSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <SessionStepTrace steps={steps} />
                )}
              </TabsContent>

              <TabsContent value="tokens" className="m-0 data-[state=inactive]:hidden">
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Token breakdown view coming in v0.7
                </div>
              </TabsContent>

              <TabsContent value="fix" className="m-0 data-[state=inactive]:hidden">
                {session && (
                  <AiFixPanel
                    sessionId={session.session_id}
                    hasRecording={recordingStatus?.has_recording ?? false}
                  />
                )}
                {!session && (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <p className="text-sm">Select a session to analyze</p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
