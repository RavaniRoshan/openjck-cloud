import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../db.js';

export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  const key = authHeader.slice(7);
  const prefix = key.slice(0, 16);

  const { data: keys, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, org_id, key_hash, env, revoked_at')
    .eq('prefix', prefix);

  if (error || !keys?.length) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  let match = null;
  for (const k of keys) {
    if (k.revoked_at) continue;
    const valid = await bcrypt.compare(key, k.key_hash);
    if (valid) {
      match = k;
      break;
    }
  }

  if (!match) {
    return res.status(401).json({ error: 'Invalid or revoked API key' });
  }

  req.orgId = match.org_id;
  req.apiKeyId = match.id;
  next();
}
