import { supabaseAdmin } from '../db.js';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 100;

export async function rateLimit(req, res, next) {
  const keyId = req.apiKeyId;
  if (!keyId) return next();

  const now = new Date();
  const windowStart = new Date(now.getTime() - (now.getTime() % WINDOW_MS)).toISOString();

  const { data: existing, error } = await supabaseAdmin
    .from('api_key_usage')
    .select('request_count')
    .eq('key_id', keyId)
    .eq('window_start', windowStart)
    .single();

  if (error && error.code !== 'PGRST116') {
    return next();
  }

  if (existing && existing.request_count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  await supabaseAdmin
    .from('api_key_usage')
    .upsert(
      { key_id: keyId, window_start: windowStart, request_count: (existing?.request_count || 0) + 1 },
      { onConflict: 'key_id,window_start' }
    );

  next();
}
