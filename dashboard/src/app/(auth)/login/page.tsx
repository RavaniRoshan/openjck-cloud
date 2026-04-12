"use client";

import { Suspense, useState } from "react";
export const dynamic = 'force-dynamic';
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  // This hook needs Suspense boundary
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage("Please enter your email");
      return;
    }
    setLoading(true);
    setMessage(null);

      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for a login link");
      }

    setLoading(false);
  };

  const handleGoogleOAuth = async () => {
    setLoading(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sign in to OpenJCK Dashboard
        </p>
      </div>

      {(message || error) && (
        <div className={`p-3 rounded-md text-sm ${error ? 'bg-destructive/10 border border-destructive text-destructive' : 'bg-accent/10 border border-accent text-accent-foreground'}`}>
          {error ? error : message}
          {errorDescription && <p className="text-xs mt-1 opacity-80">{errorDescription}</p>}
        </div>
      )}

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-card border-border text-foreground"
            placeholder="you@example.com"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send Magic Link"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleOAuth}
        disabled={loading}
      >
        Continue with Google
      </Button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
