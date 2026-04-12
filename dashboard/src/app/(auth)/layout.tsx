"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function VerifyBanner() {
  const searchParams = useSearchParams();
  const [showVerifyMessage, setShowVerifyMessage] = useState(false);

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'verify') {
      setShowVerifyMessage(true);
    }
  }, [searchParams]);

  if (!showVerifyMessage) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div className="bg-accent/10 border border-accent text-accent-foreground p-3 rounded-md text-sm text-center">
        Check your email to verify your account. After verification, you&apos;ll be redirected to the dashboard.
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={null}>
        <VerifyBanner />
      </Suspense>
      {children}
    </div>
  );
}
