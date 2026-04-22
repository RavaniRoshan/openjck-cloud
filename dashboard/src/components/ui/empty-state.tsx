"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-up",
      className
    )}>
      {/* Icon in bordered box */}
      <div className="relative mb-4">
        <div className="h-16 w-16 rounded-lg border-2 border-[var(--oj-border)] bg-[var(--oj-surface-1)] flex items-center justify-center">
          <Icon className="h-8 w-8 text-[var(--oj-text-muted)]" />
        </div>
      </div>

      {/* Title and description */}
      <h3 className="text-lg font-semibold text-[var(--oj-text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--oj-text-muted)] max-w-md mb-6">
        {description}
      </p>

      {/* Optional action button */}
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
