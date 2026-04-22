"use client";

import { useState } from "react";
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert, type AlertHook } from "@/hooks/use-alerts";
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
import { Plus, Pencil, Trash2, X, Bell, Webhook } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function AddAlertModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [alertType, setAlertType] = useState<"webhook" | "slack">("webhook");
  const createMutation = useCreateAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !webhookUrl.trim()) return;

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        webhook_url: webhookUrl.trim(),
        alert_type: alertType,
      });
      toast.success("Alert hook created");
      handleClose();
    } catch {
      toast.error("Failed to create alert hook");
    }
  };

  const handleClose = () => {
    setName("");
    setWebhookUrl("");
    setAlertType("webhook");
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

        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Add Alert Hook</h2>
        <p className="text-sm text-[var(--oj-text-muted)] mt-1">
          Configure a webhook or Slack integration to receive alerts.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="alert-name">Name</Label>
            <Input
              id="alert-name"
              placeholder="e.g., Slack #alerts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              {(["webhook", "slack"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={alertType === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAlertType(t)}
                  className={alertType === t ? "bg-[var(--oj-accent)] text-[var(--oj-bg)]" : "border-[var(--oj-border)] text-[var(--oj-text-secondary)]"}
                >
                  {t === "webhook" ? <Webhook className="h-3 w-3 mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                  {t === "webhook" ? "Webhook" : "Slack"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              placeholder={alertType === "slack" ? "https://hooks.slack.com/services/..." : "https://example.com/webhook"}
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
              className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
            />
          </div>
          <Button type="submit" className="w-full bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Save Alert"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function EditAlertModal({ alert, onClose }: { alert: AlertHook; onClose: () => void }) {
  const [name, setName] = useState(alert.name);
  const [webhookUrl, setWebhookUrl] = useState(alert.webhook_url);
  const updateMutation = useUpdateAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !webhookUrl.trim()) return;

    try {
      await updateMutation.mutateAsync({
        id: alert.id,
        name: name.trim(),
        webhook_url: webhookUrl.trim(),
      });
      toast.success("Alert hook updated");
      onClose();
    } catch {
      toast.error("Failed to update alert hook");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg shadow-lg w-full max-w-md p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--oj-text-muted)] hover:text-[var(--oj-text-primary)]" aria-label="Close modal">
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Edit Alert Hook</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-url">Webhook URL</Label>
            <Input
              id="edit-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
              className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
            />
          </div>
          <Button type="submit" className="w-full bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Updating..." : "Update Alert"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ alertName, onConfirm, open, onClose }: { alertName: string; onConfirm: () => void; open: boolean; onClose: () => void }) {
  const deleteMutation = useDeleteAlert();

  const handleConfirm = async () => {
    try {
      await onConfirm();
      toast.success("Alert hook deleted");
      onClose();
    } catch {
      toast.error("Failed to delete alert hook");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Delete Alert Hook</h2>
        <p className="text-sm text-[var(--oj-text-muted)] mt-2">
          Are you sure you want to delete &quot;{alertName}&quot;? This action cannot be undone.
        </p>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1 border-[var(--oj-border)] text-[var(--oj-text-secondary)]">Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} className="flex-1 bg-[var(--oj-danger)] hover:bg-[var(--oj-danger)]/90" disabled={deleteMutation.isPending}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = useAlerts();
  const [addOpen, setAddOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertHook | null>(null);
  const [deletingAlert, setDeletingAlert] = useState<AlertHook | null>(null);
  const deleteMutation = useDeleteAlert();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--oj-text-primary)]">Alert Hooks</h1>
          <p className="text-[var(--oj-text-muted)] mt-1">
            Configure webhook and Slack delivery for session alerts
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]">
          <Plus className="h-4 w-4 mr-2" />
          Add Alert
        </Button>
      </div>

      <AddAlertModal open={addOpen} onClose={() => setAddOpen(false)} />

      {editingAlert && (
        <EditAlertModal alert={editingAlert} onClose={() => setEditingAlert(null)} />
      )}

      {deletingAlert && (
        <DeleteConfirmModal
          alertName={deletingAlert.name}
          open={!!deletingAlert}
          onClose={() => setDeletingAlert(null)}
          onConfirm={() => deleteMutation.mutateAsync(deletingAlert.id)}
        />
      )}

      {isLoading ? (
        <div className="text-center py-8 text-[var(--oj-text-muted)]">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-[var(--oj-border)] rounded-lg bg-[var(--oj-card-gradient)]">
          <Bell className="h-12 w-12 mx-auto text-[var(--oj-text-muted)]/50" />
          <p className="text-[var(--oj-text-muted)] mt-4">
            No alerts configured. Add Slack or webhook delivery to get notified when sessions fail or guards trigger.
          </p>
          <Button variant="outline" className="mt-4 border-[var(--oj-border)] text-[var(--oj-text-secondary)] hover:bg-[var(--oj-surface-hover)]" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Alert Hook
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto border-[var(--oj-border)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--oj-border)]">
                <TableHead className="text-[var(--oj-text-muted)]">Name</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Type</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Webhook URL</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Status</TableHead>
                <TableHead className="text-[var(--oj-text-muted)]">Created</TableHead>
                <TableHead className="text-right text-[var(--oj-text-muted)]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id} className="border-[var(--oj-border)]">
                  <TableCell className="font-medium text-[var(--oj-text-primary)]">{alert.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]">
                      {alert.alert_type === "slack" ? (
                        <><Bell className="h-3 w-3 mr-1" />Slack</>
                      ) : (
                        <><Webhook className="h-3 w-3 mr-1" />Webhook</>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm max-w-[200px] truncate text-[var(--oj-text-secondary)]">
                    {alert.webhook_url}
                  </TableCell>
                  <TableCell>
                    {alert.enabled ? (
                      <Badge className="bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[var(--oj-text-muted)] border-[var(--oj-border)]">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground text-sm text-[var(--oj-text-muted)]">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAlert(alert)}
                        className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[var(--oj-danger)] hover:text-[var(--oj-danger)] hover:bg-[var(--oj-danger-muted)] border-[var(--oj-border)]"
                        onClick={() => setDeletingAlert(alert)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
