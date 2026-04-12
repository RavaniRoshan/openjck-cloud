"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">API Configuration</h2>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="api-url">OpenJCK API URL</Label>
              <Input
                id="api-url"
                defaultValue={process.env.NEXT_PUBLIC_OPENJCK_API_URL || "http://localhost:7070"}
                className="bg-card border-border"
                readOnly
              />
              <p className="text-sm text-muted-foreground">
                Set via OPENJCK_API_URL environment variable
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Supabase Configuration</h2>
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label>Supabase URL</Label>
              <Input
                defaultValue={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
                className="bg-card border-border"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label>Anon Key</Label>
              <Input
                defaultValue={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}
                className="bg-card border-border"
                type="password"
                readOnly
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Configure via .env.local file
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
