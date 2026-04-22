"use client";

import { useState } from "react";
import { useOrg, useOrgMembers, useUpdateOrg, useInviteMember, useUpdateMemberRole, useRemoveMember, type OrgMember } from "@/hooks/use-org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Users, Pencil, Trash2, UserPlus, X, Shield, Crown, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const inviteMutation = useInviteMember();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      await inviteMutation.mutateAsync({ email: email.trim(), role });
      toast.success(`Invitation sent to ${email.trim()}`);
      handleClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Failed to send invitation";
      toast.error(msg);
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("member");
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

        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Invite Member</h2>
        <p className="text-sm text-[var(--oj-text-muted)] mt-1">
          Send an invitation to join your organization.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex gap-2">
              {(["member", "admin"] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={role === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRole(r)}
                  className={role === r ? "bg-[var(--oj-accent)] text-[var(--oj-bg)]" : "border-[var(--oj-border)] text-[var(--oj-text-secondary)]"}
                >
                  {r === "member" ? "Member" : "Admin"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-[var(--oj-text-muted)]">
              {role === "admin"
                ? "Admins can invite members and manage settings"
                : "Members can view and use all features"}
            </p>
          </div>
          <Button type="submit" className="w-full bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RemoveMemberModal({
  member,
  onConfirm,
  open,
  onClose,
  isOnlyOwner,
}: {
  member: OrgMember;
  onConfirm: () => void;
  open: boolean;
  onClose: () => void;
  isOnlyOwner: boolean;
}) {
  const removeMutation = useRemoveMember();

  const handleConfirm = async () => {
    if (isOnlyOwner) return;
    try {
      await removeMutation.mutateAsync(member.id);
      toast.success(`${member.email} removed from organization`);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to remove member");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[var(--oj-surface-1)] border border-[var(--oj-border)] rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Remove Member</h2>
        {isOnlyOwner ? (
          <div className="mt-3 p-3 bg-[var(--oj-accent-glow)] border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-400">
              Cannot remove the only owner. Transfer ownership to another member first.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--oj-text-muted)] mt-2">
              Are you sure you want to remove <span className="font-medium text-[var(--oj-text-primary)]">{member.email}</span> from the organization?
            </p>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={onClose} className="flex-1 border-[var(--oj-border)] text-[var(--oj-text-secondary)]">Cancel</Button>
              <Button variant="destructive" onClick={handleConfirm} className="flex-1 bg-[var(--oj-danger)] hover:bg-[var(--oj-danger)]/90" disabled={removeMutation.isPending}>
                Remove
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case "owner":
      return (
        <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
          <Crown className="h-3 w-3 mr-1" />Owner
        </Badge>
      );
    case "admin":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-0">
          <ShieldCheck className="h-3 w-3 mr-1" />Admin
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[var(--oj-text-muted)] border-[var(--oj-border)]">
          <Shield className="h-3 w-3 mr-1" />Member
        </Badge>
      );
  }
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="bg-[var(--oj-accent-glow)] text-amber-400 border-0">
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-[var(--oj-success-muted)] text-[var(--oj-success)] border-0">
      Active
    </Badge>
  );
}

export default function OrgSettingsPage() {
  const { data: org, isLoading: orgLoading } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useOrgMembers();
  const updateOrgMutation = useUpdateOrg();
  const updateRoleMutation = useUpdateMemberRole();

  const [editingName, setEditingName] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState<OrgMember | null>(null);

  const ownerCount = members.filter((m) => m.role === "owner" && m.status === "active").length;

  const isLoading = orgLoading || membersLoading;

  // Derive display name
  const displayName = org?.name || "Organization";

  const handleStartEditName = () => {
    setOrgName(org?.name || "");
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!orgName.trim()) return;
    try {
      await updateOrgMutation.mutateAsync({ name: orgName.trim() });
      setEditingName(false);
      toast.success("Organization updated");
    } catch {
      toast.error("Failed to update organization");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: "admin" | "member") => {
    try {
      await updateRoleMutation.mutateAsync({ memberId, role: newRole });
      toast.success("Member role updated");
    } catch {
      toast.error("Failed to update role");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--oj-text-primary)]">{displayName}</h1>
        <p className="text-[var(--oj-text-muted)] mt-1">Manage your organization settings and members</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[var(--oj-text-muted)]">Loading...</div>
      ) : (
        <>
          {/* Org Name Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--oj-text-primary)]">Organization Name</h2>
            {editingName ? (
              <div className="flex gap-2 max-w-md">
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  autoFocus
                  className="bg-[var(--oj-surface-2)] border-[var(--oj-border)] text-[var(--oj-text-primary)]"
                />
                <Button onClick={handleSaveName} disabled={updateOrgMutation.isPending} className="bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]">
                  {updateOrgMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setEditingName(false)} className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-lg text-[var(--oj-text-primary)]">{org?.name}</span>
                <Button variant="ghost" size="sm" onClick={handleStartEditName} className="text-[var(--oj-text-secondary)] hover:text-[var(--oj-text-primary)]">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-[var(--oj-text-muted)]">
              <span>Plan: <Badge variant="outline" className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]">{org?.plan || "free"}</Badge></span>
              {org?.slug && <span>Slug: <code className="text-xs bg-[var(--oj-surface-2)] px-1.5 py-0.5 rounded text-[var(--oj-text-primary)]">{org.slug}</code></span>}
            </div>
          </div>

          {/* Members Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--oj-text-primary)] flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--oj-text-muted)]" />
                Members
                <Badge variant="outline" className="ml-1 border-[var(--oj-border)] text-[var(--oj-text-muted)]">{members.length}</Badge>
              </h2>
              <Button onClick={() => setInviteOpen(true)} className="bg-[var(--oj-accent)] hover:bg-[var(--oj-accent-hover)] text-[var(--oj-bg)]">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </div>

            <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />

            {removingMember && (
              <RemoveMemberModal
                member={removingMember}
                open={!!removingMember}
                onClose={() => setRemovingMember(null)}
                onConfirm={() => {}}
                isOnlyOwner={removingMember.role === "owner" && ownerCount <= 1}
              />
            )}

            {members.length === 0 ? (
              <div className="text-center py-8 text-[var(--oj-text-muted)]">No members found</div>
            ) : (
              <div className="border rounded-lg overflow-x-auto border-[var(--oj-border)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[var(--oj-border)]">
                      <TableHead className="text-[var(--oj-text-muted)]">Email</TableHead>
                      <TableHead className="text-[var(--oj-text-muted)]">Role</TableHead>
                      <TableHead className="text-[var(--oj-text-muted)]">Status</TableHead>
                      <TableHead className="text-[var(--oj-text-muted)]">Joined</TableHead>
                      <TableHead className="text-right text-[var(--oj-text-muted)]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id} className={member.status === "pending" ? "opacity-60" : ""}>
                        <TableCell className="font-medium text-[var(--oj-text-primary)]">{member.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={member.role} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell className="text-[var(--oj-text-muted)] text-sm">
                          {member.status === "pending"
                            ? `Invited ${formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}`
                            : formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {member.status === "active" && member.role !== "owner" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRoleChange(member.id, member.role === "admin" ? "member" : "admin")}
                                disabled={updateRoleMutation.isPending}
                                className="border-[var(--oj-border)] text-[var(--oj-text-secondary)]"
                              >
                                {member.role === "admin" ? "Make Member" : "Make Admin"}
                              </Button>
                            )}
                            {member.role === "owner" && ownerCount <= 1 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[var(--oj-text-muted)] cursor-not-allowed opacity-50 border-[var(--oj-border)]"
                                disabled
                                title="Cannot remove the only owner"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-[var(--oj-danger)] hover:text-[var(--oj-danger)] hover:bg-[var(--oj-danger-muted)] border-[var(--oj-border)]"
                                onClick={() => setRemovingMember(member)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
