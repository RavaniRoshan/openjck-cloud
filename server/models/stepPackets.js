import { supabaseAdmin } from '../db.js';

export async function writeStep(session_id, org_id, step_number, payload) {
  const { data, error } = await supabaseAdmin
    .from('step_packets')
    .upsert(
      { session_id, org_id, step_number, payload },
      { onConflict: 'session_id,step_number', ignoreDuplicates: true }
    )
    .select();

  if (error) throw error;
  return data?.[0] || null;
}

export async function getSteps(session_id, org_id) {
  const { data, error } = await supabaseAdmin
    .from('step_packets')
    .select('payload')
    .eq('session_id', session_id)
    .eq('org_id', org_id)
    .order('step_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(row => row.payload);
}

export async function hasRecording(session_id, org_id) {
  const { count, error } = await supabaseAdmin
    .from('step_packets')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session_id)
    .eq('org_id', org_id);

  if (error) throw error;
  const step_count = count ?? 0;
  return { has_recording: step_count > 0, step_count };
}
