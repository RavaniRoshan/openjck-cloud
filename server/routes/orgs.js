import { Router } from 'express';
import { supabaseAdmin } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug, plan, created_at')
      .eq('id', orgId)
      .single();

    if (error) throw error;
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    res.json(org);
  } catch (err) {
    console.error('Get org error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { name } = req.body;

    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only owners and admins can update organization settings' });
    }

    const updates = {};
    if (name !== undefined) {
      if (!name || !name.trim()) return res.status(400).json({ error: 'Organization name cannot be empty' });
      updates.name = name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select('id, name, slug, plan, created_at')
      .single();

    if (error) throw error;

    await logAudit(orgId, userId, 'org_updated', 'organization', orgId, updates);

    res.json(updated);
  } catch (err) {
    console.error('Update org error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/members', async (req, res) => {
  try {
    const orgId = req.orgId;

    const { data: members, error } = await supabaseAdmin
      .from('organization_members')
      .select('id, user_id, role, invited_by, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const userIds = members.map(m => m.user_id);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers();

    const userMap = new Map();
    if (users?.users) {
      for (const u of users.users) {
        userMap.set(u.id, { email: u.email, id: u.id });
      }
    }

    const formatted = members.map(m => ({
      id: m.id,
      user_id: m.user_id,
      email: userMap.get(m.user_id)?.email || 'Unknown',
      role: m.role,
      invited_by: m.invited_by,
      created_at: m.created_at,
      status: 'active',
    }));

    const { data: invitations } = await supabaseAdmin
      .from('organization_invitations')
      .select('id, email, role, status, created_at, expires_at')
      .eq('org_id', orgId)
      .eq('status', 'pending');

    const pendingInvites = (invitations || []).map(inv => ({
      id: inv.id,
      user_id: null,
      email: inv.email,
      role: inv.role,
      status: 'pending',
      created_at: inv.created_at,
      expires_at: inv.expires_at,
    }));

    res.json([...formatted, ...pendingInvites]);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/invite', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { email, role } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const inviteRole = role || 'member';
    if (!['admin', 'member'].includes(inviteRole)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Only owners and admins can invite members' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    const { data: allMembers } = await supabaseAdmin
      .from('organization_members')
      .select('user_id')
      .eq('org_id', orgId);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = users?.users?.find(u => u.email === normalizedEmail);
    if (existingUser && allMembers?.some(m => m.user_id === existingUser.id)) {
      return res.status(409).json({ error: 'User is already a member of this organization' });
    }

    const { data: existingInvite } = await supabaseAdmin
      .from('organization_invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return res.status(409).json({ error: 'An invitation for this email already exists' });
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const inviterEmail = req.user.email || 'A team member';

    const { data: invitation, error } = await supabaseAdmin
      .from('organization_invitations')
      .insert({
        org_id: orgId,
        email: normalizedEmail,
        role: inviteRole,
        invited_by: userId,
      })
      .select('id, email, role, status, created_at, expires_at, token')
      .single();

    if (error) throw error;

    const inviteUrl = `${process.env.DASHBOARD_URL || 'http://localhost:3000'}/invite?token=${invitation.token}`;

    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: inviteUrl,
    });

    if (emailError) {
      console.warn('Invite email failed (non-fatal):', emailError.message);
    }

    await logAudit(orgId, userId, 'member_invited', 'organization_invitation', invitation.id, { email: normalizedEmail, role: inviteRole });

    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      created_at: invitation.created_at,
      expires_at: invitation.expires_at,
    });
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/invite/accept', async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const { data: invitation, error: invError } = await supabaseAdmin
      .from('organization_invitations')
      .select('id, org_id, email, role, status, expires_at')
      .eq('token', token)
      .single();

    if (invError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation already ${invitation.status}` });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('org_id', invitation.org_id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      await supabaseAdmin
        .from('organization_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: userId })
        .eq('id', invitation.id);
      return res.json({ message: 'Already a member', org_id: invitation.org_id });
    }

    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        org_id: invitation.org_id,
        user_id: userId,
        role: invitation.role,
        invited_by: invitation.invited_by,
      });

    if (memberError) throw memberError;

    await supabaseAdmin
      .from('organization_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq('id', invitation.id);

    await logAudit(invitation.org_id, userId, 'invite_accepted', 'organization_invitation', invitation.id, { email: invitation.email });

    res.json({ org_id: invitation.org_id, role: invitation.role });
  } catch (err) {
    console.error('Accept invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/members/:memberId/role', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { memberId } = req.params;
    const { role } = req.body;

    if (!['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data: requester } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can change member roles' });
    }

    const { data: target } = await supabaseAdmin
      .from('organization_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single();

    if (!target) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (target.role === 'owner' && role !== 'owner') {
      const { count } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner');

      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner. Transfer ownership to another member first.' });
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .eq('org_id', orgId)
      .select('id, user_id, role')
      .single();

    if (error) throw error;

    await logAudit(orgId, userId, 'member_role_updated', 'organization_member', memberId, { new_role: role, old_role: target.role });

    res.json(updated);
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/members/:memberId', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { memberId } = req.params;

    const { data: requester } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .single();

    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      return res.status(403).json({ error: 'Only owners and admins can remove members' });
    }

    const { data: target } = await supabaseAdmin
      .from('organization_members')
      .select('id, user_id, role')
      .eq('id', memberId)
      .eq('org_id', orgId)
      .single();

    if (!target) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (target.role === 'owner') {
      const { count } = await supabaseAdmin
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('role', 'owner');

      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot remove the only owner. Transfer ownership to another member first.' });
      }
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('org_id', orgId);

    if (error) throw error;

    await logAudit(orgId, userId, 'member_removed', 'organization_member', memberId, { removed_user_id: target.user_id });

    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: name.trim() })
      .select('id, name, created_at')
      .single();

    if (orgError) {
      console.error('Failed to create organization:', orgError);
      return res.status(500).json({ error: 'Failed to create organization' });
    }

    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({ user_id: userId, org_id: org.id, role: 'owner' });

    if (memberError) {
      console.error('Failed to create organization member:', memberError);
      await supabaseAdmin.from('organizations').delete().eq('id', org.id);
      return res.status(500).json({ error: 'Failed to add user to organization' });
    }

    res.status(201).json({ org_id: org.id, name: org.name });
  } catch (err) {
    console.error('Org creation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function logAudit(orgId, userId, action, resourceType, resourceId, details) {
  await supabaseAdmin.from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
  });
}

export default router;
