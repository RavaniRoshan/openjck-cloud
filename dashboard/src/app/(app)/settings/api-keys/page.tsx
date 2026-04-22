"use client";

import { useState } from "react";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/use-api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Trash2, AlertTriangle, X, Key } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function CreateKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [env, setEnv] = useState<"prod" | "staging" | "dev">("dev");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "created">("form");
  const createKeyMutation = useCreateApiKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createKeyMutation.mutateAsync({ name: name.trim(), env });
      setCreatedKey(result.key);
      setStep("created");
      toast.success("API key created");
    } catch (err) {
      toast.error("Failed to create API key");
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success("Copied to clipboard");
    }
  };

  const handleClose = () => {
    setName("");
    setEnv("dev");
    setCreatedKey(null);
    setStep("form");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg shadow-lg w-full max-w-md p-6">
        <button onClick={handleClose} className="absolute top-4 right-4 text-[var(--oj-text-muted)] hover:text-[var(--oj-text-primary)]" aria-label="Close modal">
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Create API Key</h2>
        <p className="text-sm text-[var(--oj-text-muted)] mt-1">
          Create a new API key for authenticating with the OpenJCK API.
        </p>

        {step === "created" && createdKey ? (
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-[var(--oj-accent-glow)] border border-amber-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-400">Copy now — not shown again</p>
                  <p className="text-sm text-[var(--oj-text-muted)] mt-1">
                    This is the only time you'll see this key. Store it securely.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-[var(--oj-surface-2)] rounded font-mono text-sm break-all text-[var(--oj-text-primary)]">
                {createdKey}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy} className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleClose} className="w-full bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production API"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-[var(--oj-surface-1)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <div className="flex gap-2">
                {(["dev", "staging", "prod"] as const).map((e) => (
                  <Button
                    key={e}
                    type="button"
                    variant={env === e ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEnv(e)}
                    className={env === e ? "bg-[var(--oj-accent)] text-[var(--oj-bg)]" : "border-[var(--oj-border)] text-[var(--oj-text-secondary)]"}
                  >
                    {e === "dev" ? "Dev" : e === "staging" ? "Staging" : "Prod"}
                  </Button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]" disabled={createKeyMutation.isPending}>
              {createKeyMutation.isPending ? "Creating..." : "Create Key"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function RevokeKeyModal({ keyId, keyName, onConfirm, open, onClose }: { keyId: string; keyName: string; onConfirm: () => void; open: boolean; onClose: () => void }) {
  const revokeMutation = useRevokeApiKey();

  const handleConfirm = async () => {
    try {
      await revokeMutation.mutateAsync(keyId);
      toast.success("API key revoked");
      onClose();
    } catch (err) {
      toast.error("Failed to revoke API key");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Revoke API Key</h2>
        <p className="text-sm text-[var(--oj-text-muted)] mt-2">
          Are you sure you want to revoke &quot;{keyName}&quot;? This action cannot be undone.
          Any applications using this key will no longer be able to authenticate.
        </p>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[var(--oj-border)] text-[var(--oj-text-secondary)]">Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} className="flex-1 bg-[var(--oj-danger)] hover:bg-[var(--oj-danger)]/90 text-white" disabled={revokeMutation.isPending}>
            Revoke Key
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const { data: keys = [], isLoading } = useApiKeys();
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeKey, setRevokeKey] = useState<{ id: string; name: string } | null>(null);

  const getEnvBadgeClass = (env: string) => {
    switch (env) {
      case "prod": return "bg-[var(--oj-danger-muted)] text-[var(--oj-danger)] border-0";
      case "staging": return "bg-[var(--oj-accent-glow)] text-amber-400 border-0";
      case "dev": return "bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--oj-text-primary)]">API Keys</h1>
          <p className="text-[var(--oj-text-muted)] mt-1">
            Manage API keys for authenticating with the OpenJCK API
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]">
          Create API Key
        </Button>
      </div>

      <CreateKeyModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {revokeKey && (
        <RevokeKeyModal
          keyId={revokeKey.id}
          keyName={revokeKey.name}
          open={!!revokeKey}
          onClose={() => setRevokeKey(null)}
          onConfirm={() => {}}
        />
      )}

      {isLoading ? (
        <div className="text-center py-8 text-[var(--oj-text-muted)]">Loading...</div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[var(--oj-border)] rounded-lg bg-[var(--oj-card-gradient)]">
          <Key className="h-10 w-10 text-[var(--oj-text-muted)]/30 mb-3" />
          <p className="text-lg font-medium text-[var(--oj-text-primary)] mb-2">No API keys yet</p>
          <p className="text-sm text-[var(--oj-text-muted)] max-w-md mb-4">
            Create an API key to send events from your Python agents.
          </p>
          <Button variant="outline" onClick={() => setCreateOpen(true)} className="border-[var(--oj-border)] text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)]">
            Create your first API key
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto border-[var(--oj-border)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--oj-border)] hover:bg-[var(--oj-surface-hover)]">
                <TableHead className="text-[var(--oj-text-muted)]">Name</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Prefix</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Environment</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Last Used</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Status</TableHead>
                <TableHead className="text-right text-[var(--oj-text-muted)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} className={key.status === "revoked" ? "opacity-50" : ""}>
                  <TableCell className="font-medium text-[var(--oj-text-primary)]">{key.name}</TableCell>
                  <TableCell className="font-mono text-sm text-[var(--oj-text-secondary)]">{key.prefix}...</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getEnvBadgeClass(key.env)} border-0`}>
                      {key.env}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-sm text-[var(--oj-text-muted)]">
                    {key.last_used_at
                      ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {key.status === "active" ? (
                      <Badge className="bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[var(--oj-text-muted)] border-[var(--oj-border)]">
                        Revoked
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {key.status === "active" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRevokeKey({ id: key.id, name: key.name })}
                        className="border-[var(--oj-border)] text-[var(--oj-danger)] hover:text-[var(--oj-danger)] hover:bg-[var(--oj-danger-muted)]"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {revokeKey && (
        <RevokeKeyModal
          keyId={revokeKey.id}
          keyName={revokeKey.name}
          open={!!revokeKey}
          onClose={() => setRevokeKey(null)}
          onConfirm={() => {}}
        />
      )}
    </div>
  );
}
