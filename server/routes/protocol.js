import { Router } from 'express';
import { createSession, accumulateTokens, endSession, setLoopDetected } from '../models/clawSession.js';
import { writeStep } from '../models/stepPackets.js';
import { emitToOrg } from '../sse-emitter.js';

const router = Router();

/**
 * OpenJCK Protocol v1 receiver
 * Unauthenticated open standard for agent observability events
 * 
 * Required fields per event:
 * - at_version: protocol version (e.g., "1.0")
 * - event: event type ("session.start", "session.step", "session.flag", "session.end")
 * - session_id: unique session identifier
 * - timestamp: ISO8601 timestamp
 * - org_id: UUID of the organization (for dashboard routing)
 */

router.post('/', async (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];
  const errors = [];
  let accepted = 0;

  for (const event of events) {
    try {
      // 1. Validation: required fields
      const missing = [];
      if (!event.at_version) missing.push('at_version');
      if (!event.event) missing.push('event');
      if (!event.session_id) missing.push('session_id');
      if (!event.timestamp) missing.push('timestamp');
      if (!event.org_id) missing.push('org_id');
      if (missing.length > 0) {
        errors.push({ 
          event: sanitizeEvent(event), 
          reason: `Missing required fields: ${missing.join(', ')}` 
        });
        continue;
      }

      // 2. Version check: parse major version, reject if > 1
      const major = parseInt(event.at_version.split('.')[0], 10);
      if (isNaN(major) || major > 1) {
        errors.push({ event: sanitizeEvent(event), reason: `Unsupported protocol version: ${event.at_version}. Major version > 1 not supported` });
        continue;
      }

      const eventType = event.event;
      const sessionId = event.session_id;
      const orgId = event.org_id;

      // 3. Route by event type
      switch (eventType) {
        case 'session.start': {
          const { claw_name = 'unknown', project = null, environment = 'dev', tags = [], metadata = {}, guard_config = null } = event;
          
          await createSession({
            session_id: sessionId,
            org_id: orgId,
            claw_name,
            project,
            environment,
            tags,
            metadata,
            guard_config,
          });
          
          emitToOrg(orgId, 'session_created', { session_id: sessionId, claw_name, status: 'running' });
          accepted++;
          break;
        }

         case 'session.step': {
           const usage = event.usage || {};
           const request = event.request || {};
           const sdk = event.sdk || {};
           const provider = sdk.provider;
           
           // Accumulate tokens
           const updated = await accumulateTokens(sessionId, orgId, {
             input_tokens: usage.input_tokens || 0,
             output_tokens: usage.output_tokens || 0,
             model: request.model || 'claude-sonnet-4',
             tool_call_count: usage.tool_call_count || 0,
             provider: provider,
           });

          // Write step packet if provided
          if (event.step_packet) {
            const stepNumber = event.step_number ?? usage.step_number ?? updated.steps;
            try {
              await writeStep(sessionId, orgId, stepNumber, event.step_packet);
            } catch (writeErr) {
              // Idempotency: UNIQUE constraint violation (23505) is OK, ignore
              if (writeErr.code !== '23505') {
                throw writeErr;
              }
            }
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
          // For guard flags, we'd need additional handling in v1
          emitToOrg(orgId, 'loop_detected', {
            session_id: sessionId,
            detail: event.detail || '',
            flag_type: event.flag_type,
          });
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
          accepted++;
          break;
        }

        default:
          errors.push({ event: sanitizeEvent(event), reason: `Unknown event type: ${eventType}` });
      }
    } catch (err) {
      errors.push({ event: sanitizeEvent(event), reason: err.message });
    }
  }

  res.json({ accepted, rejected: errors.length, errors: errors.slice(0, 100) });
});

/**
 * Redact sensitive fields for error reporting
 */
function sanitizeEvent(event) {
  if (!event) return event;
  return {
    ...event,
    at_version: event.at_version ? '***' : undefined,
    session_id: event.session_id ? event.session_id.slice(0, 8) + '...' : undefined,
    org_id: event.org_id ? event.org_id.slice(0, 8) + '...' : undefined,
  };
}

export default router;
