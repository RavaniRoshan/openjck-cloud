import { Router } from 'express';
import { jwtAuth } from '../middleware/jwt-auth.js';
import { requireRole } from '../middleware/require-role.js';
import { upsertAiKey, getAiKeyMeta, deleteAiKey } from '../models/orgAiKey.js';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../db.js';

const router = Router();

// All routes require JWT auth + admin/owner role
router.use(jwtAuth);
router.use(requireRole(['admin', 'owner']));

/**
 * GET /api/v1/settings/ai-keys/:provider
 * Returns key metadata for display. Never returns the key itself.
 */
router.get('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!['anthropic'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    const meta = await getAiKeyMeta(req.orgId, provider);

    if (!meta) {
      return res.json({
        provider,
        configured: false,
        mode: 'hosted',
        message: 'Using OpenJCK hosted key',
      });
    }

    return res.json({
      provider,
      configured: true,
      mode: 'byok',
      key_prefix: meta.key_prefix,
      verified: meta.verified,
      verified_at: meta.verified_at,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/v1/settings/ai-keys/:provider
 * Store or update a BYOK key.
 * Validates the key against the provider before storing.
 * Body: { key: string }
 */
router.put('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { key } = req.body;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key is required' });
    }

    if (!['anthropic'].includes(provider)) {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    // Validate the key BEFORE storing
    // Make a minimal test call to confirm the key works
    let validationError = null;
    try {
      const testClient = new Anthropic({ apiKey: key });
      await testClient.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
    } catch (err) {
      // Catch auth errors specifically
      if (err.status === 401 || err.message?.includes('invalid') || err.message?.includes('auth')) {
        validationError = 'Invalid API key. Authentication failed with Anthropic.';
      }
      // Other errors (rate limit, etc.) are fine — key is valid
    }

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    // Store the key (encrypted)
    const meta = await upsertAiKey(req.orgId, provider, key, req.user.id);

    // Mark as verified since validation passed
    meta.verified = true;

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      org_id: req.orgId,
      user_id: req.user.id,
      action: 'ai_key_configured',
      resource_type: 'org_ai_key',
      details: { provider, mode: 'byok', key_prefix: meta.key_prefix },
    });

    return res.json({
      success: true,
      provider,
      mode: 'byok',
      key_prefix: meta.key_prefix,
      verified: true,
      message: `${provider} key verified and saved. AI Fix will now use your key.`,
    });
  } catch (err) {
    return res.status(err.message.includes('format') ? 400 : 500).json({ error: err.message });
  }
});

/**
 * DELETE /api/v1/settings/ai-keys/:provider
 * Remove BYOK key. Reverts to OpenJCK hosted key.
 */
router.delete('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;

    await deleteAiKey(req.orgId, provider);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      org_id: req.orgId,
      user_id: req.user.id,
      action: 'ai_key_removed',
      resource_type: 'org_ai_key',
      details: { provider, reverted_to: 'hosted' },
    });

    return res.json({
      success: true,
      provider,
      mode: 'hosted',
      message: 'BYOK key removed. Reverted to OpenJCK hosted key.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/settings/ai-keys/:provider/test
 * Test the currently stored BYOK key without modifying it.
 */
router.post('/:provider/test', async (req, res) => {
  try {
    const { resolveAnthropicKey, markKeyVerified } = await import('../models/orgAiKey.js');
    const { key, mode } = await resolveAnthropicKey(req.orgId);

    if (mode === 'hosted') {
      return res.json({ mode: 'hosted', status: 'ok', message: 'Using OpenJCK hosted key' });
    }

    // Test the BYOK key
    try {
      const testClient = new Anthropic({ apiKey: key });
      await testClient.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      await markKeyVerified(req.orgId, req.params.provider);
      return res.json({ mode: 'byok', status: 'ok', message: 'Key verified successfully' });
    } catch (err) {
      return res.json({ mode: 'byok', status: 'error', message: `Key test failed: ${err.message}` });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
