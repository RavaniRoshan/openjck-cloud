import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../db.js';
import { TtlCache } from '../lib/ttl-cache.js';

// Brute force protection cache
const bruteForceCache = new TtlCache({ ttl: 60000 }); // 1 minute window

// Rate limiting: 20 attempts per minute per prefix
const MAX_ATTEMPTS = 20;

/**
 * API Key Auth Middleware
 * Validates API keys with brute force protection and revoked key detection
 */
export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing API key',
      code: 'MISSING_API_KEY'
    });
  }

  const key = authHeader.slice(7);

  // Key format validation
  if (!key.startsWith('openjck_') && !key.startsWith('sk-')) {
    return res.status(401).json({
      error: 'Invalid API key format',
      code: 'INVALID_KEY_FORMAT'
    });
  }

  const prefix = key.slice(0, 16);

  // Brute force protection
  const attemptKey = `auth:${prefix}`;
  const attempts = bruteForceCache.get(attemptKey) || 0;

  if (attempts >= MAX_ATTEMPTS) {
    return res.status(429).json({
      error: 'Too many authentication attempts',
      code: 'RATE_LIMITED',
      retryAfter: 60
    });
  }

  // Increment attempt counter
  bruteForceCache.increment(attemptKey, 1, 60000);

  try {
    const { data: keys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, org_id, key_hash, env, revoked_at, revoked_reason')
      .eq('prefix', prefix);

    if (error) {
      console.error('[API Key Auth] Database error:', error.message);
      return res.status(503).json({
        error: 'Authentication service temporarily unavailable',
        code: 'AUTH_SERVICE_ERROR'
      });
    }

    if (!keys?.length) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_KEY'
      });
    }

    let match = null;
    let isRevoked = false;
    let revokedReason = null;

    for (const k of keys) {
      if (k.revoked_at) {
        isRevoked = true;
        revokedReason = k.revoked_reason;
        continue;
      }

      const valid = await bcrypt.compare(key, k.key_hash);
      if (valid) {
        match = k;
        break;
      }
    }

    if (!match) {
      if (isRevoked) {
        return res.status(401).json({
          error: 'API key has been revoked',
          code: 'KEY_REVOKED',
          reason: revokedReason || 'Key was manually revoked'
        });
      }

      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_KEY'
      });
    }

    // Reset attempt counter on successful auth
    bruteForceCache.delete(attemptKey);

    req.orgId = match.org_id;
    req.apiKeyId = match.id;
    req.apiKeyEnv = match.env;
    next();
  } catch (err) {
    console.error('[API Key Auth] Unexpected error:', err.message);
    return res.status(503).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Get current attempt count for a key prefix (for monitoring)
 */
export function getAuthAttempts(prefix) {
  return bruteForceCache.get(`auth:${prefix}`) || 0;
}

/**
 * Reset attempt count for a key prefix (for testing/admin)
 */
export function resetAuthAttempts(prefix) {
  bruteForceCache.delete(`auth:${prefix}`);
}
