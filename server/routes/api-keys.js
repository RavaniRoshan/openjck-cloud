import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

const KEY_LENGTH = 32;
const PREFIX_LENGTH = 16;

function generateApiKey() {
  const buffer = crypto.randomBytes(KEY_LENGTH);
  const key = buffer.toString('base64url');
  const prefix = key.slice(0, PREFIX_LENGTH);
  return { key, prefix };
}

function maskKey(key) {
  return key.slice(0, PREFIX_LENGTH) + '...';
}

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

router.get('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const { data: keys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, prefix, env, created_at, last_used_at, revoked_at, created_by')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = keys.map(k => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      env: k.env,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
      status: k.revoked_at ? 'revoked' : 'active',
    }));

    res.json(formatted);
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { name, env } = req.body;

    if (!name || !env) {
      return res.status(400).json({ error: 'Name and environment are required' });
    }

    if (!['prod', 'staging', 'dev'].includes(env)) {
      return res.status(400).json({ error: 'Environment must be prod, staging, or dev' });
    }

    const { key, prefix } = generateApiKey();
    const keyHash = await bcrypt.hash(key, 10);

    const { data: created, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        org_id: orgId,
        name: name.trim(),
        key_hash: keyHash,
        prefix,
        env,
        created_by: userId,
      })
      .select('id')
      .single();

    if (error) throw error;

    await logAudit(orgId, userId, 'api_key_created', 'api_key', created.id, { name, env, prefix });

    res.status(201).json({
      id: created.id,
      name: name.trim(),
      prefix,
      env,
      key,
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/revoke', async (req, res) => {
  try {
    const orgId = req.orgId;
    const userId = req.user.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, prefix, revoked_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (existing.revoked_at) {
      return res.status(400).json({ error: 'API key already revoked' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);

    if (updateError) throw updateError;

    await logAudit(orgId, userId, 'api_key_revoked', 'api_key', id, { name: existing.name, prefix: existing.prefix });

    res.json({ success: true });
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;