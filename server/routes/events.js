import { Router } from 'express';
import {
  createSession,
  accumulateTokens,
  endSession,
  setLoopDetected,
} from '../models/clawSession.js';
import { writeStep } from '../models/stepPackets.js';
import { emitToOrg } from '../sse-emitter.js';
import { supabaseAdmin } from '../db.js';

const router = Router();

/**
 * Write an audit log entry
 */
async function auditLog(orgId, action, details = {}, req, resourceType = null, resourceId = null) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress;
    const timestamp = new Date().toISOString();

    await supabaseAdmin.from('audit_logs').insert({
      org_id: orgId,
      user_id: null, // SDK events are system-generated
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ip,
      created_at: timestamp,
    });
  } catch (err) {
    // Audit log failures should NOT break event processing
    console.warn('Audit log failed:', err.message);
  }
}

router.post('/', async (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];
  const errors = [];
  let accepted = 0;

  for (const event of events) {
    try {
      if (!event.at_version || !event.event || !event.session_id || !event.timestamp) {
        errors.push({ event, reason: 'Missing required fields: at_version, event, session_id, timestamp' });
        continue;
      }

      const [major] = event.at_version.split('.').map(Number);
      if (major > 1) {
        errors.push({ event, reason: 'Unsupported protocol version' });
        continue;
      }

      const eventType = event.event;
      const sessionId = event.session_id;
      const orgId = req.orgId;

      switch (eventType) {
         case 'session.start': {
           const session = await createSession({
             session_id: sessionId,
             org_id: orgId,
             claw_name: event.claw_name || 'unknown',
             project: event.project || null,
             environment: event.environment || 'dev',
             tags: event.tags || [],
             metadata: event.metadata || {},
             guard_config: event.guard_config || null,
           });
           emitToOrg(orgId, 'session_created', session);
           
           // Audit log
           await auditLog(orgId, 'session.start', {
             session_id: sessionId,
             claw_name: event.claw_name,
             project: event.project,
             environment: event.environment,
           }, req, 'claw_session', sessionId);
           
           accepted++;
           break;
         }

         case 'session.step': {
           const usage = event.usage || {};
           const request = event.request || {};
           const sdk = event.sdk || {};
           const provider = sdk.provider;  // e.g., "anthropic", "groq", "openai"
           
           const updated = await accumulateTokens(sessionId, orgId, {
             input_tokens: usage.input_tokens || 0,
             output_tokens: usage.output_tokens || 0,
             model: request.model || 'claude-sonnet-4',
             tool_call_count: usage.tool_call_count || 0,
             provider: provider,  // may be undefined for legacy
           });

          if (event.step_packet) {
            const stepNumber = event.step_number ?? usage.step_number ?? 0;
            await writeStep(sessionId, orgId, stepNumber, event.step_packet);
          }

          emitToOrg(orgId, 'session_update', {
            session_id: sessionId,
            total_input_tokens: updated.total_input_tokens,
            total_output_tokens: updated.total_output_tokens,
            total_cost_usd: updated.total_cost_usd,
            steps: updated.steps,
            tool_calls: updated.tool_calls,
          });
          accepted++;
          break;
        }

         case 'session.flag': {
           if (event.flag_type === 'loop_detected') {
             await setLoopDetected(sessionId, orgId);
           }
           emitToOrg(orgId, 'loop_detected', {
             session_id: sessionId,
             detail: event.detail || '',
             flag_type: event.flag_type,
           });
           
           // Audit log for loop detection
           if (event.flag_type === 'loop_detected') {
             await auditLog(orgId, 'loop.detected', {
               session_id: sessionId,
               detail: event.detail,
             }, req, 'claw_session', sessionId);
           }
           accepted++;
           break;
         }

         case 'session.end': {
           const ended = await endSession(sessionId, orgId, {
             status: event.status || 'completed',
             failure_root_cause: event.failure_root_cause || null,
             ended_at: event.ended_at || new Date().toISOString(),
           });
           emitToOrg(orgId, 'session_ended', ended);
           
           // Audit log
           await auditLog(orgId, 'session.end', {
             session_id: sessionId,
             status: event.status,
             failure_root_cause: event.failure_root_cause,
           }, req, 'claw_session', sessionId);
           
           accepted++;
           break;
         }

        default:
          errors.push({ event, reason: `Unknown event type: ${eventType}` });
      }
    } catch (err) {
      errors.push({ event, reason: err.message });
    }
  }

  res.json({ accepted, rejected: errors.length, errors });
});

export default router;
