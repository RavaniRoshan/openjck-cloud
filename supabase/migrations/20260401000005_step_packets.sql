CREATE TABLE step_packets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  TEXT NOT NULL REFERENCES claw_sessions(session_id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id),
  step_number INTEGER NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_number)
);
CREATE INDEX idx_steps_session ON step_packets(session_id, step_number);
