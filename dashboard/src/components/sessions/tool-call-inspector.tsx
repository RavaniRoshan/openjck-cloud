"use client";

import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ToolCallInspectorProps {
  tools?: Array<{
    tool_name: string;
    tool_input: Record<string, unknown>;
    fingerprint?: string;
  }>;
}

export function ToolCallInspector({ tools }: ToolCallInspectorProps) {
  if (!tools || tools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-2">
      {tools.map((tool, idx) => (
        <Collapsible key={idx} className="border border-border rounded-md bg-surface">
          <CollapsibleTrigger>
            <Button
              variant="ghost"
              className="w-full justify-start px-3 py-2 h-auto font-mono text-xs"
            >
              <ChevronRight className="mr-2 size-4 transition-transform ui-data-[state=open]:rotate-90" />
              <span className="font-bold text-foreground">{tool.tool_name}</span>
              {tool.fingerprint && (
                <span className="ml-2 text-muted-foreground font-normal">
                  ({tool.fingerprint})
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-3">
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">INPUT</div>
                <pre className="bg-background border border-border rounded p-2 overflow-x-auto text-xs font-mono text-foreground">
                  {JSON.stringify(tool.tool_input, null, 2)}
                </pre>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
