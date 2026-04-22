/**
 * Requires the authenticated user to have one of the specified roles in their org.
 * Must be used AFTER jwtAuth middleware (which sets req.user and req.orgId).
 */
import { supabaseAdmin } from '../db.js';

export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user?.id || !req.orgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('user_id', req.user.id)
      .eq('org_id', req.orgId)
      .single();

    if (!data || !allowedRoles.includes(data.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: data?.role || 'none',
      });
    }

    req.userRole = data.role;
    next();
  };
}
