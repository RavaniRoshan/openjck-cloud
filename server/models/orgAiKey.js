import { supabaseAdmin } from '../db.js';
import { encrypt, decrypt, getKeyPrefix } from '../lib/encryption.js';

/**
 * Store or update an org's AI key for a provider.
 * The plaintext key is encrypted before storage.
 * Returns metadata only — never the key.
 */
export async function upsertAiKey(orgId, provider, plaintextKey, userId) {
  // Validate Anthropic key format before storing
  if (provider === 'anthropic') {
    if (!plaintextKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format. Keys must start with "sk-ant-"');
    }
    if (plaintextKey.length < 20) {
      throw new Error('Anthropic API key appears too short');
    }
  }

  const { encrypted, iv } = encrypt(plaintextKey);
  const prefix = getKeyPrefix(plaintextKey, 10);

  const { data, error } = await supabaseAdmin
    .from('org_ai_keys')
    .upsert({
      org_id: orgId,
      provider,
      key_encrypted: encrypted,
      key_iv: iv,
      key_prefix: prefix,
      verified: false,      // Reset verification on key change
      verified_at: null,
      updated_at: new Date().toISOString(),
      created_by: userId,
    }, {
      onConflict: 'org_id,provider',
      returning: 'representation',
    });

  if (error) throw error;

  // Also update org mode to 'byok'
  await supabaseAdmin
    .from('organizations')
    .update({ ai_key_mode: 'byok' })
    .eq('id', orgId);

  // Return safe metadata only — never return the encrypted key
  return {
    id: data[0].id,
    org_id: orgId,
    provider,
    key_prefix: prefix,
    verified: false,
    created_at: data[0].created_at,
  };
}

/**
 * Get the decrypted plaintext key for a provider.
 * INTERNAL USE ONLY — never return this to API clients.
 */
export async function getDecryptedKey(orgId, provider) {
  const { data, error } = await supabaseAdmin
    .from('org_ai_keys')
    .select('key_encrypted, key_iv')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .single();

  if (error || !data) return null;

  return decrypt(data.key_encrypted, data.key_iv);
}

/**
 * Get key metadata for display (no sensitive data).
 */
export async function getAiKeyMeta(orgId, provider) {
  const { data } = await supabaseAdmin
    .from('org_ai_keys')
    .select('id, provider, key_prefix, verified, verified_at, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('provider', provider)
    .single();

  return data || null;
}

/**
 * Delete an org's AI key and revert to hosted mode.
 */
export async function deleteAiKey(orgId, provider) {
  const { error } = await supabaseAdmin
    .from('org_ai_keys')
    .delete()
    .eq('org_id', orgId)
    .eq('provider', provider);

  if (error) throw error;

  // Check if any other AI keys remain — if not, revert to hosted mode
  const { data: remaining } = await supabaseAdmin
    .from('org_ai_keys')
    .select('id')
    .eq('org_id', orgId);

  if (!remaining?.length) {
    await supabaseAdmin
      .from('organizations')
      .update({ ai_key_mode: 'hosted' })
      .eq('id', orgId);
  }
}

/**
 * Mark a key as verified after a successful API call.
 */
export async function markKeyVerified(orgId, provider) {
  await supabaseAdmin
    .from('org_ai_keys')
    .update({ verified: true, verified_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('provider', provider);
}

/**
 * Resolve the Anthropic API key to use for a given org.
 * PRECEDENCE: org BYOK key → OpenJCK hosted key
 * Returns: { key: string, mode: 'byok' | 'hosted' }
 */
export async function resolveAnthropicKey(orgId) {
  const byokKey = await getDecryptedKey(orgId, 'anthropic');

  if (byokKey) {
    return { key: byokKey, mode: 'byok' };
  }

  const hostedKey = process.env.ANTHROPIC_API_KEY;
  if (!hostedKey) {
    throw new Error('No Anthropic API key available. Configure ANTHROPIC_API_KEY or add a BYOK key.');
  }

  return { key: hostedKey, mode: 'hosted' };
}
