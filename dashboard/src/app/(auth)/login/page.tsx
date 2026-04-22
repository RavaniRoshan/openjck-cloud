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
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const verifyMessage = searchParams.get('message') === 'verify';

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magic">("password");

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage("Please enter email and password");
      return;
    }
    setLoading(true);
    setMessage(null);

    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      router.push("/sessions");
      router.refresh();
    }
  };

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

      {verifyMessage && !message && !error && (
        <div className="p-3 bg-accent/10 border border-accent text-accent-foreground rounded-md text-sm">
          Check your email to verify your account. After verification, you&apos;ll be redirected to the dashboard.
        </div>
      )}

      {mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
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
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-card border-border text-foreground"
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
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
      )}

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      {mode === "password" ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setMode("magic")}
          disabled={loading}
        >
          Sign in with Magic Link
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setMode("password")}
          disabled={loading}
        >
          Sign in with Password
        </Button>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a href="/signup" className="text-accent hover:underline">Create one</a>
      </p>
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
