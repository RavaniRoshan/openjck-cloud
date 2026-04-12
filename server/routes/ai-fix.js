import { Router } from 'express';
import { getSession, updateSession } from '../models/clawSession.js';
import { getSteps, hasRecording } from '../models/stepPackets.js';
import { analyzeSession } from '../services/anthropicClient.js';

const router = Router();

/**
 * In-memory rate limit store for AI Fix endpoints
 * Structure: session_id -> { count: number, reset_at: timestamp }
 */
const rateLimitStore = new Map();

/**
 * Check rate limit for a session
 * @param {string} sessionId 
 * @returns {Object} - { allowed: boolean, cooldown_seconds?: number, reset_at?: string }
 */
function checkRateLimit(sessionId) {
  const now = Date.now();
  const record = rateLimitStore.get(sessionId);

  if (!record || now > record.reset_at) {
    // New window or expired
    rateLimitStore.set(sessionId, {
      count: 1,
      reset_at: now + 3600000 // 1 hour in ms
    });
    return { allowed: true };
  }

  if (record.count >= 10) {
    return {
      allowed: false,
      cooldown_seconds: Math.ceil((record.reset_at - now) / 1000),
      reset_at: new Date(record.reset_at).toISOString()
    };
  }

  record.count++;
  return { allowed: true };
}

/**
 * Format a step for the last 5 steps summary
 */
function formatStepSummary(stepPacket) {
  const { step_number, payload } = stepPacket;
  const { request, usage, tools, error } = payload;
  
  let summary = `Step ${step_number}: ${request.model}`;
  if (tools && tools.length > 0) {
    summary += ` | Tools: ${tools.map(t => t.tool_name).join(', ')}`;
  }
  if (error) {
    summary += ` | Error: ${error.message || 'Unknown error'}`;
  }
  summary += ` | Cost: $${usage.step_cost_usd?.toFixed(6) || '0.000000'}`;
  
  return summary;
}

/**
 * Build the user prompt with session metadata, last 5 steps, and final step
 */
function buildUserPrompt(session, steps, finalStep) {
  const { claw_name, status, steps: total_steps, total_cost_usd, failure_root_cause } = session;
  
  // Take last 5 steps before the final step
  const stepsBeforeFinal = steps.slice(0, -1);
  const lastFiveSteps = stepsBeforeFinal.slice(-5);
  
  // Format last 5 steps summary
  const formattedSteps = lastFiveSteps.map(formatStepSummary).join('\n');
  
  // Format final step in full detail
  const finalStepFormatted = JSON.stringify(finalStep.payload, null, 2);
  
  return `Session: ${claw_name} | Status: ${status} | Steps: ${total_steps} | Cost: $${total_cost_usd.toFixed(4)}

Root cause from Failure Intelligence: ${failure_root_cause || 'not identified'}

Last 5 steps:
${formattedSteps}

Failing step (full detail):
${finalStepFormatted}`;
}

/**
 * POST /api/v1/sessions/:id/fix
 * Analyze a failed session and get AI-powered fix suggestions
 */
router.post('/', async (req, res) => {
  const sessionId = req.params.id;
  const orgId = req.orgId;

  try {
    // 1. Rate limit check (in-memory, per session)
    const rateLimit = checkRateLimit(sessionId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        cooldown_seconds: rateLimit.cooldown_seconds,
        reset_at: rateLimit.reset_at
      });
    }

    // 2. Fetch session
    const session = await getSession(sessionId, orgId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 3. Cache check - if ai_fix exists in metadata, return cached
    if (session.metadata?.ai_fix) {
      return res.json(session.metadata.ai_fix);
    }

    // 4. Recording check - ensure step packets exist
    const recordingCheck = await hasRecording(sessionId, orgId);
    if (!recordingCheck.has_recording) {
      return res.status(400).json({
        error: 'Session recording not available. AI Fix requires v0.6+ recordings.'
      });
    }

    // 5. Fetch all steps
    const allSteps = await getSteps(sessionId, orgId);
    if (allSteps.length === 0) {
      return res.status(400).json({
        error: 'Session recording not available. AI Fix requires v0.6+ recordings.'
      });
    }

    // 6. Get the final step (should be the one that failed)
    const finalStep = allSteps[allSteps.length - 1];

    // 7. Build prompts
    const SYSTEM_PROMPT = `You are an AI agent debugging assistant. You analyze failed autonomous agent sessions recorded by OpenJCK and provide specific, actionable fix suggestions.

You receive structured data: session metadata, steps leading to failure, and the failing step in full detail.

Your job:
1. Identify the root cause — not where it crashed, but WHY it was set up to fail
2. Suggest a specific fix: prompt change, tool definition, guard config, or code change
3. State confidence: High / Medium / Low
4. Suggest a concrete verification test

Rules: Be direct. No hedging. Root cause = earliest decision that made failure inevitable. Respond ONLY with valid JSON. No preamble. No markdown fences.`;

    const userPrompt = buildUserPrompt(session, allSteps, finalStep);

    // 8. Call Anthropic API
    let result;
    try {
      result = await analyzeSession(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error('AI Fix analysis failed:', err);
      return res.status(502).json({
        error: 'Analysis service unavailable',
        details: err.message
      });
    }

    // 9. Add analyzed_at timestamp
    const cachedResult = {
      ...result,
      analyzed_at: new Date().toISOString()
    };

    // 10. Cache result in session metadata
    try {
      const currentMetadata = session.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        ai_fix: cachedResult
      };
      await updateSession(sessionId, orgId, { metadata: updatedMetadata });
    } catch (err) {
      console.warn('Failed to cache AI fix result:', err.message);
      // Continue - we still return the result, just not cached
    }

    // 11. Return result
    res.json(cachedResult);

  } catch (err) {
    console.error('AI Fix endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Build a two-message conversation for deeper analysis
 */
function buildDeeperUserPrompt(followUp, originalResult, session, steps, finalStep) {
  const { claw_name, status, steps: total_steps, total_cost_usd } = session;
  const finalStepFormatted = JSON.stringify(finalStep.payload, null, 2);
  
  // Build context
  const stepsBeforeFinal = steps.slice(0, -1);
  const lastFiveSteps = stepsBeforeFinal.slice(-5);
  const formattedSteps = lastFiveSteps.map(formatStepSummary).join('\n');
  
  return `Session: ${claw_name} | Status: ${status} | Steps: ${total_steps} | Cost: $${total_cost_usd.toFixed(4)}

Previous AI Analysis:
- Root cause: ${originalResult.root_cause}
- Fix: ${originalResult.fix}
- Confidence: ${originalResult.confidence}

Follow-up question: ${followUp}

Context from session:
Last 5 steps:
${formattedSteps}

Failing step (full detail):
${finalStepFormatted}

Provide an updated analysis considering the follow-up question. Respond ONLY with valid JSON matching the same schema.`;
}

/**
 * POST /api/v1/sessions/:id/fix/deeper
 * Two-message conversation for deeper analysis (not cached)
 */
router.post('/deeper', async (req, res) => {
  const sessionId = req.params.id;
  const orgId = req.orgId;
  const { follow_up } = req.body;

  if (!follow_up || typeof follow_up !== 'string' || follow_up.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid follow_up field in request body' });
  }

  try {
    // 1. Rate limit check
    const rateLimit = checkRateLimit(sessionId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        cooldown_seconds: rateLimit.cooldown_seconds,
        reset_at: rateLimit.reset_at
      });
    }

    // 2. Fetch session
    const session = await getSession(sessionId, orgId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 3. Get cached original result (must exist)
    if (!session.metadata?.ai_fix) {
      return res.status(400).json({
        error: 'No previous analysis found. Call /fix first before using /deeper.'
      });
    }

    const originalResult = session.metadata.ai_fix;

    // 4. Recording check
    const recordingCheck = await hasRecording(sessionId, orgId);
    if (!recordingCheck.has_recording) {
      return res.status(400).json({
        error: 'Session recording not available. AI Fix requires v0.6+ recordings.'
      });
    }

    // 5. Fetch all steps
    const allSteps = await getSteps(sessionId, orgId);
    if (allSteps.length === 0) {
      return res.status(400).json({
        error: 'Session recording not available. AI Fix requires v0.6+ recordings.'
      });
    }

    const finalStep = allSteps[allSteps.length - 1];

    // 6. Build prompt with conversation context
    const SYSTEM_PROMPT = `You are an AI agent debugging assistant. You analyze failed autonomous agent sessions recorded by OpenJCK and provide specific, actionable fix suggestions.

You receive structured data: session metadata, previous AI analysis, a follow-up question, and the failing step in full detail.

Your job:
1. Identify the root cause — not where it crashed, but WHY it was set up to fail
2. Suggest a specific fix: prompt change, tool definition, guard config, or code change
3. State confidence: High / Medium / Low
4. Suggest a concrete verification test

Rules: Be direct. No hedging. Root cause = earliest decision that made failure inevitable. Respond ONLY with valid JSON. No preamble. No markdown fences.`;

    const userPrompt = buildDeeperUserPrompt(follow_up.trim(), originalResult, session, allSteps, finalStep);

    // 7. Call Anthropic API
    let result;
    try {
      result = await analyzeSession(SYSTEM_PROMPT, userPrompt);
    } catch (err) {
      console.error('AI Fix deeper analysis failed:', err);
      return res.status(502).json({
        error: 'Analysis service unavailable',
        details: err.message
      });
    }

    // 8. Return result (NOT cached)
    const response = {
      ...result,
      analyzed_at: new Date().toISOString(),
      based_on_previous: true
    };

    res.json(response);

  } catch (err) {
    console.error('AI Fix deeper endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;