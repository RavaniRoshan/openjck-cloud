"use client";

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

/**
 * Forbidden Page Component
 * Displayed when user lacks permission to access a resource
 * Styled with design system tokens (charcoal + amber theme)
 */
export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[var(--oj-danger-muted)] flex items-center justify-center border border-[var(--oj-danger)]/30">
            <ShieldAlert className="h-8 w-8 text-[var(--oj-danger)]" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-semibold text-[var(--oj-text-primary)] mb-3">
          Access denied
        </h1>
        <p className="text-[var(--oj-text-secondary)] mb-8 max-w-sm mx-auto">
          You do not have permission to access this resource. Contact your organization administrator if you believe this is an error.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-[var(--oj-border)] text-[var(--oj-text-primary)] hover:bg-[var(--oj-surface-2)]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button
            onClick={() => router.push("/sessions")}
            className="bg-[var(--oj-accent)] text-black hover:bg-[var(--oj-accent-hover)] font-medium"
          >
            Go to Sessions
          </Button>
        </div>

        {/* Error code */}
        <p className="mt-8 text-xs text-[var(--oj-text-muted)] font-mono">
          Error 403
        </p>
      </div>
    </div>
  );
}

/**
 * Forbidden component for use within other pages
 * Can be conditionally rendered when permission checks fail
 */
export function ForbiddenState({ message }: { message?: string }) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-64 p-6">
      <div className="w-12 h-12 rounded-full bg-[var(--oj-danger-muted)] flex items-center justify-center mb-4">
        <ShieldAlert className="h-6 w-6 text-[var(--oj-danger)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--oj-text-primary)] mb-2">
        Access denied
      </h3>
      <p className="text-sm text-[var(--oj-text-secondary)] text-center max-w-sm mb-4">
        {message || "You do not have permission to access this resource."}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push("/sessions")}
        className="border-[var(--oj-border)] text-[var(--oj-text-primary)]"
      >
        Go to Sessions
      </Button>
    </div>
  );
}
