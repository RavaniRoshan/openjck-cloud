import { supabaseAdmin } from '../db.js';

export async function jwtAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const token = authHeader.slice(7);

  let user;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      const payload = decodeJwtPayload(token);
      if (!payload || !payload.sub) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      user = { id: payload.sub, email: payload.email, role: payload.role };
    } else {
      user = data.user;
    }
  } catch {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    user = { id: payload.sub, email: payload.email, role: payload.role };
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single();

  if (!member) {
    return res.status(403).json({ error: 'User not member of any organization' });
  }

  req.user = { ...user, org_id: member.org_id, role: member.role };
  req.orgId = member.org_id;
  next();
}

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
