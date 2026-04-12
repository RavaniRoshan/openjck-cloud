import { supabaseAdmin } from '../db.js';
import { calculateCost } from '../config/pricing.js';

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
  return data || [];
}

export async function accumulateTokens(session_id, org_id, { input_tokens, output_tokens, model, tool_call_count }) {
  const session = await getSession(session_id, org_id);
  if (!session) throw new Error(`Session ${session_id} not found`);

  const newInput = (session.total_input_tokens || 0) + (input_tokens || 0);
  const newOutput = (session.total_output_tokens || 0) + (output_tokens || 0);
  const totalCost = calculateCost(model, newInput, newOutput);

  const { data, error } = await supabaseAdmin
    .from('claw_sessions')
    .update({
      total_input_tokens: newInput,
      total_output_tokens: newOutput,
      total_cost_usd: totalCost,
      steps: (session.steps || 0) + 1,
      tool_calls: (session.tool_calls || 0) + (tool_call_count || 0),
    })
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .select()
    .single();

  if (error) throw error;
  return data;
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
