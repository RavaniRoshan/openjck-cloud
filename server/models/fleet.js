import { supabaseAdmin } from '../db.js';

/**
 * Parse window string to hours
 * @param {string} windowStr - "1h", "6h", "24h", "7d"
 * @returns {number} hours
 */
export function parseWindow(windowStr) {
  const map = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
  return map[windowStr] || 24;
}

/**
 * Get fleet health summary for an org
 * @param {string} orgId
 * @param {number} windowHours
 * @returns {object} health data with counts, status, agents list
 */
export async function getFleetHealth(orgId, windowHours) {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

   // Get all sessions in window with required fields
   const { data: sessions, error } = await supabaseAdmin
     .from('claw_sessions')
     .select(`
       session_id,
       claw_name,
       status,
       total_cost_usd,
       steps,
       tool_calls,
       loop_detected,
       started_at,
       ended_at,
       tags,
       parent_session_id
     `)
     .eq('org_id', orgId)
     .gte('started_at', windowStart)
     .order('started_at', { ascending: false });

  if (error) throw error;

  const running = [];
  let completed = 0;
  let failed = 0;
  let terminated = 0;
  let totalCost = 0;
  let totalToolCalls = 0;

  for (const session of sessions || []) {
    const status = session.status;
    if (status === 'running') {
      running.push(session);
    } else if (status === 'completed') {
      completed++;
    } else if (status === 'failed') {
      failed++;
    } else if (status === 'terminated') {
      terminated++;
    }

    totalCost += session.total_cost_usd || 0;
    totalToolCalls += session.tool_calls || 0;
  }

  // Calculate health status
  let healthStatus = 'healthy';
  if (failed > 0) {
    healthStatus = 'critical';
  } else if (running.some(s => s.loop_detected)) {
    healthStatus = 'warning';
  }

   return {
     running: running.length,
     completed,
     failed,
     terminated,
     total_cost: totalCost,
     total_tool_calls: totalToolCalls,
     status: healthStatus,
     agents: running.map(s => ({
       session_id: s.session_id,
       claw_name: s.claw_name,
       status: s.status,
       total_cost_usd: s.total_cost_usd,
       steps: s.steps || 0,
       tool_calls: s.tool_calls || 0,
       loop_detected: s.loop_detected || false,
       started_at: s.started_at,
       ended_at: s.ended_at || null,
       tags: s.tags || [],
       parent_session_id: s.parent_session_id || null,
     }))
   };
}

/**
 * Get fleet activity events
 * Tries audit_logs first, falls back to synthesis
 * @param {string} orgId
 * @param {number} limit
 * @returns {Array} activity events sorted by timestamp desc
 */
export async function getFleetActivity(orgId, limit = 100) {
  // Try audit_logs first
  const { data: auditEvents, error: auditError } = await supabaseAdmin
    .from('audit_logs')
    .select('created_at, action, details')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!auditError && auditEvents && auditEvents.length > 0) {
    // Map audit_logs to activity format
    return auditEvents.map(event => {
      const { created_at, action, details } = event;
      let event_type = 'unknown';
      let claw_name = details?.claw_name || 'unknown';
      let session_id = details?.session_id || null;
      let description = action;

      // Map action to event_type
      if (action === 'session.start') {
        event_type = 'session_start';
      } else if (action === 'session.end') {
        event_type = 'session_end';
        description = `Session ended: ${details?.status || 'unknown'}`;
      } else if (action === 'guard.triggered') {
        event_type = 'guard_triggered';
        description = `Guard: ${details?.guard_type} (strike ${details?.strike})`;
      } else if (action === 'loop.detected') {
        event_type = 'loop_detected';
        description = details?.detail || 'Loop detected';
      }

      return {
        timestamp: created_at,
        session_id,
        claw_name,
        event_type,
        detail: description,
      };
    });
  }

  // Fallback: synthesize from step_packets + claw_sessions
  const activities = [];

  // Get recent sessions (start/end events)
  const { data: sessions } = await supabaseAdmin
    .from('claw_sessions')
    .select('session_id, claw_name, started_at, ended_at, status, guard_termination, loop_detected')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (sessions) {
    for (const s of sessions) {
      // Session start
      activities.push({
        timestamp: s.started_at,
        session_id: s.session_id,
        claw_name: s.claw_name,
        event_type: 'session_start',
        detail: `Session started`,
      });

      // Session end if exists
      if (s.ended_at) {
        activities.push({
          timestamp: s.ended_at,
          session_id: s.session_id,
          claw_name: s.claw_name,
          event_type: 'session_end',
          detail: `Session ended: ${s.status}`,
        });
      }

      // Loop detected (from session.flag event)
      if (s.loop_detected) {
        activities.push({
          timestamp: s.ended_at || s.started_at,
          session_id: s.session_id,
          claw_name: s.claw_name,
          event_type: 'loop_detected',
          detail: 'Loop detected in session',
        });
      }
    }
  }

  // Get step events (including guard events from step packets)
  const { data: steps } = await supabaseAdmin
    .from('step_packets')
    .select('created_at, session_id, step_number, payload')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (steps) {
    for (const step of steps) {
      // Find claw_name from session_id
      const session = sessions?.find(s => s.session_id === step.session_id);
      const clawName = session?.claw_name || 'unknown';

      // Emit step event
      activities.push({
        timestamp: step.created_at,
        session_id: step.session_id,
        claw_name: clawName,
        event_type: 'step',
        detail: `Step ${step.step_number} completed`,
      });

      // Check for guard events in step payload
      if (step.payload && step.payload.guard && Array.isArray(step.payload.guard.events)) {
        for (const guardEvent of step.payload.guard.events) {
          activities.push({
            timestamp: step.created_at,
            session_id: step.session_id,
            claw_name: clawName,
            event_type: 'guard_triggered',
            detail: `Guard: ${guardEvent.guard_type} — ${guardEvent.detail}`,
          });
        }
      }
    }
  }

  // Sort by timestamp desc and deduplicate by (session_id, event_type, timestamp rounded)
  const unique = new Map();
  const deduped = [];

  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const act of activities) {
    const key = `${act.session_id}:${act.event_type}:${act.timestamp.slice(0, 13)}`; // minute precision
    if (!unique.has(key)) {
      unique.set(key, act);
      deduped.push(act);
    }
  }

  return deduped.slice(0, limit);
}

/**
 * Count running sessions for an org (used for SSE emission logic)
 * @param {string} orgId
 * @returns {number}
 */
export async function getRunningSessionsCount(orgId) {
  const { count, error } = await supabaseAdmin
    .from('claw_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'running');

  if (error) throw error;
  return count || 0;
}
