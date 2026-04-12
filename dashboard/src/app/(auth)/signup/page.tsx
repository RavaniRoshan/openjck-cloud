"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !orgName) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Set cookie with pending org name (30 min expiry)
      const encodedOrgName = encodeURIComponent(orgName);
      document.cookie = `pending-org-name=${encodedOrgName}; path=/; max-age=1800`;

      const supabase = createBrowserClient();
      // @ts-expect-error - signUp with email redirect (magic link) requires emailRedirectTo and no password
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      // Redirect to login with message to check email
      router.push('/login?message=verify');
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Set up your organization
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded-md text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
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

        <div className="space-y-2">
          <Label htmlFor="orgName" className="text-foreground">
            Organization Name
          </Label>
          <Input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            className="bg-card border-border text-foreground"
            placeholder="My Company"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating..." : "Create Account"}
        </Button>
      </form>

      <p className="text-xs text-center text-muted-foreground">
        After signing up, you&apos;ll receive an email to verify your address. Once verified, your organization will be created automatically.
      </p>
    </div>
  );
}