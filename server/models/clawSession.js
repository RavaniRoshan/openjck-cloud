import { supabaseAdmin } from '../db.js';
import { calculateCost, calculateCostLegacy } from '../config/pricing.js';

export async function createSession({ session_id, org_id, claw_name, project, environment, tags, metadata, guard_config }) {
  const { data, error } = await supabaseAdmin
    .from('claw_sessions')
    .insert({
      session_id,
      org_id,
      claw_name,
      project: project || null,
      environment: environment || 'dev',
      tags: tags || [],
      metadata: metadata || {},
      guard_config: guard_config || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function accumulateTokens(session_id, org_id, { input_tokens, output_tokens, model, tool_call_count, provider }) {
  const { data, error } = await supabaseAdmin
    .from('claw_sessions')
    .select('total_input_tokens, total_output_tokens, steps, tool_calls, total_cost_usd')
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Session ${session_id} not found`);
    }
    throw error;
  }

  const newInput = (data.total_input_tokens || 0) + (input_tokens || 0);
  const newOutput = (data.total_output_tokens || 0) + (output_tokens || 0);
  
  // Calculate cost with provider-aware pricing
  let totalCost;
  if (provider) {
    totalCost = calculateCost(provider, model, newInput, newOutput);
  } else {
    // Legacy: infer provider from model name
    totalCost = calculateCostLegacy(model, newInput, newOutput);
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('claw_sessions')
    .update({
      total_input_tokens: newInput,
      total_output_tokens: newOutput,
      total_cost_usd: totalCost,
      steps: (data.steps || 0) + 1,
      tool_calls: (data.tool_calls || 0) + (tool_call_count || 0),
    })
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated;
}

export async function updateSession(session_id, org_id, updates) {
  const { data, error } = await supabaseAdmin
    .from('claw_sessions')
    .update(updates)
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSession(session_id, org_id) {
  const { data, error } = await supabaseAdmin
    .from('claw_sessions')
    .select('*')
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function listSessions(org_id, { status, claw_name, project, limit = 50, offset = 0 } = {}) {
  let query = supabaseAdmin
    .from('claw_sessions')
    .select('*')
    .eq('org_id', org_id)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (claw_name) query = query.eq('claw_name', claw_name);
  if (project) query = query.eq('project', project);

  const { data, error } = await query;
  if (error) throw error;

  // Enrich with recording status: count step_packets for each session
  const sessions = data || [];
  if (sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.session_id);
  const { data: stepCounts, error: countError } = await supabaseAdmin
    .from('step_packets')
    .select('session_id')
    .in('session_id', sessionIds)
    .in('org_id', [org_id]);

  if (countError) throw countError;

  // Build a map: session_id -> step count
  const countMap = new Map();
  for (const row of stepCounts) {
    countMap.set(row.session_id, (countMap.get(row.session_id) || 0) + 1);
  }

  // Merge into sessions
  return sessions.map(session => ({
    ...session,
    has_recording: countMap.get(session.session_id) > 0,
  }));
}

export async function endSession(session_id, org_id, { status, failure_root_cause, ended_at }) {
  const updates = {
    status: status || 'completed',
    ended_at: ended_at || new Date().toISOString(),
  };
  if (failure_root_cause) updates.failure_root_cause = failure_root_cause;

  return updateSession(session_id, org_id, updates);
}

export async function setLoopDetected(session_id, org_id) {
  return updateSession(session_id, org_id, { loop_detected: true });
}

/**
 * Terminate a session with atomic guard strike increment
 * This ensures idempotent termination even with concurrent requests
 */
export async function terminateSession(session_id, org_id) {
  const { data, error } = await supabaseAdmin.rpc('terminate_session', {
    p_session_id: session_id,
    p_org_id: org_id,
  });

  if (error) {
    // Fallback to regular update if RPC doesn't exist
    if (error.message?.includes('terminate_session')) {
      return endSession(session_id, org_id, {
        status: 'terminated',
        ended_at: new Date().toISOString(),
      });
    }
    throw error;
  }

  return data;
}
