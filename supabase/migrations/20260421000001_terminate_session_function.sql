-- Atomic session termination with guard strike increment
-- This function ensures idempotent termination even with concurrent requests

CREATE OR REPLACE FUNCTION terminate_session(
  p_session_id UUID,
  p_org_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_session RECORD;
  v_result JSONB;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT id, session_id, org_id, status, guard_strikes, total_input_tokens, total_output_tokens
  INTO v_session
  FROM claw_sessions
  WHERE session_id = p_session_id
    AND org_id = p_org_id
  FOR UPDATE;

  -- Check if session exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check if already terminal
  IF v_session.status IN ('completed', 'failed', 'terminated') THEN
    -- Return existing state with idempotent flag
    SELECT jsonb_build_object(
      'id', id,
      'session_id', session_id,
      'org_id', org_id,
      'status', status,
      'guard_strikes', guard_strikes,
      'total_input_tokens', total_input_tokens,
      'total_output_tokens', total_output_tokens,
      'ended_at', ended_at,
      '_note', 'Session already ' || status,
      '_idempotent', true
    )
    INTO v_result
    FROM claw_sessions
    WHERE id = v_session.id;

    RETURN v_result;
  END IF;

  -- Update session: set terminated status, increment guard strikes, set ended_at
  UPDATE claw_sessions
  SET
    status = 'terminated',
    guard_strikes = guard_strikes + 1,
    ended_at = NOW(),
    updated_at = NOW()
  WHERE id = v_session.id
  RETURNING jsonb_build_object(
    'id', id,
    'session_id', session_id,
    'org_id', org_id,
    'status', status,
    'guard_strikes', guard_strikes,
    'total_input_tokens', total_input_tokens,
    'total_output_tokens', total_output_tokens,
    'ended_at', ended_at,
    '_idempotent', false
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION terminate_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION terminate_session(UUID, UUID) TO service_role;

COMMENT ON FUNCTION terminate_session IS 'Atomically terminates a session, preventing race conditions on concurrent termination requests';
