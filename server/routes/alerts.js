import { Router } from 'express';
import { supabaseAdmin } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { data: alerts, error } = await supabaseAdmin
      .from('alert_hooks')
      .select('id, name, webhook_url, alert_type, enabled, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(alerts);
  } catch (err) {
    console.error('List alerts error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { name, webhook_url, alert_type } = req.body;

    if (!name || !webhook_url) {
      return res.status(400).json({ error: 'Name and webhook URL are required' });
    }

    try {
      new URL(webhook_url);
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL' });
    }

    const { data: created, error } = await supabaseAdmin
      .from('alert_hooks')
      .insert({
        org_id: orgId,
        name: name.trim(),
        webhook_url: webhook_url.trim(),
        alert_type: alert_type || 'webhook',
        enabled: true,
      })
      .select('id, name, webhook_url, alert_type, enabled, created_at, updated_at')
      .single();

    if (error) throw error;

    await logAudit(orgId, req.user.id, 'alert_hook_created', 'alert_hook', created.id, { name: created.name });

    res.status(201).json(created);
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;
    const { name, webhook_url, alert_type, enabled } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (webhook_url !== undefined) {
      try {
        new URL(webhook_url);
        updates.webhook_url = webhook_url.trim();
      } catch {
        return res.status(400).json({ error: 'Invalid webhook URL' });
      }
    }
    if (alert_type !== undefined) updates.alert_type = alert_type;
    if (enabled !== undefined) updates.enabled = enabled;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updated, error } = await supabaseAdmin
      .from('alert_hooks')
      .update(updates)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('id, name, webhook_url, alert_type, enabled, created_at, updated_at')
      .single();

    if (error) throw error;
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    await logAudit(orgId, req.user.id, 'alert_hook_updated', 'alert_hook', id, updates);

    res.json(updated);
  } catch (err) {
    console.error('Update alert error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('alert_hooks')
      .select('id, name')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('alert_hooks')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (deleteError) throw deleteError;

    await logAudit(orgId, req.user.id, 'alert_hook_deleted', 'alert_hook', id, { name: existing.name });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete alert error:', err);
    res.status(500).json({ error: err.message });
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
