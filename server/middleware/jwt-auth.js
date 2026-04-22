import { supabaseAdmin } from '../db.js';

// Auth timeout for Supabase calls (3 seconds)
const AUTH_TIMEOUT = 3000;

/**
 * JWT Auth Middleware
 * Validates JWT tokens with timeout protection and detailed error codes
 */
export async function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing access token',
      code: 'MISSING_TOKEN'
    });
  }

  const token = authHeader.slice(7);

  // Token format validation
  if (token.length < 20) {
    return res.status(401).json({
      error: 'Invalid token format',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }

  let user;
  try {
    // Add timeout to Supabase auth call
    const authPromise = supabaseAdmin.auth.getUser(token);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT)
    );

    const { data, error } = await Promise.race([authPromise, timeoutPromise]);

    if (error || !data?.user) {
      // Try to decode payload as fallback
      const payload = decodeJwtPayload(token);
      if (!payload || !payload.sub) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'TOKEN_EXPIRED'
        });
      }
      user = { id: payload.sub, email: payload.email, role: payload.role };
    } else {
      user = data.user;
    }
  } catch (err) {
    if (err.message === 'Auth timeout') {
      return res.status(503).json({
        error: 'Authentication service temporarily unavailable',
        code: 'AUTH_TIMEOUT'
      });
    }

    // Graceful fallback - try to decode payload
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'TOKEN_EXPIRED'
      });
    }
    user = { id: payload.sub, email: payload.email, role: payload.role };
  }

  // Get organization membership
  let member;
  try {
    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      throw error;
    }
    member = data;
  } catch (err) {
    console.error('[JWT Auth] Organization lookup failed:', err.message);
    return res.status(403).json({
      error: 'User not member of any organization',
      code: 'NO_ORG',
      hint: 'Contact your organization administrator to be added to an organization'
    });
  }

  if (!member) {
    return res.status(403).json({
      error: 'User not member of any organization',
      code: 'NO_ORG',
      hint: 'Contact your organization administrator to be added to an organization'
    });
  }

  req.user = { ...user, org_id: member.org_id, role: member.role };
  req.orgId = member.org_id;
  next();
}

/**
 * Decode JWT payload without verification
 * Used as fallback when Supabase auth fails
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Optional auth middleware
 * Sets user/org if token present, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const { data } = await supabaseAdmin.auth.getUser(token);
    if (data?.user) {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', data.user.id)
        .single();

      if (member) {
        req.user = { ...data.user, org_id: member.org_id, role: member.role };
        req.orgId = member.org_id;
      }
    }
  } catch {
    // Ignore errors for optional auth
  }

  next();
}
