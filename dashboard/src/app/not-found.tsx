import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 404 Not Found Page
 * Displayed when a route doesn't exist
 * Styled with design system tokens (charcoal + amber theme)
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--oj-bg)]">
      <div className="max-w-md w-full text-center">
        {/* 404 Code */}
        <div className="mb-6">
          <span className="text-8xl font-bold text-[var(--oj-text-muted)] font-mono">
            404
          </span>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[var(--oj-surface-2)] flex items-center justify-center border border-[var(--oj-border)]">
            <FileQuestion className="h-8 w-8 text-[var(--oj-accent)]" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-semibold text-[var(--oj-text-primary)] mb-3">
          Page not found
        </h1>
        <p className="text-[var(--oj-text-secondary)] mb-8 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>

        {/* Action */}
        <Link href="/sessions">
          <Button
            className="bg-[var(--oj-accent)] text-black hover:bg-[var(--oj-accent-hover)] font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sessions
          </Button>
        </Link>

        {/* Footer note */}
        <p className="mt-8 text-xs text-[var(--oj-text-muted)]">
          OpenJCK Cloud
        </p>
      </div>
    </div>
  );
}
