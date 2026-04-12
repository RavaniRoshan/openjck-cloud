CREATE TABLE claw_sessions (
  session_id          TEXT PRIMARY KEY,
  org_id              UUID NOT NULL REFERENCES organizations(id),
  claw_name           TEXT NOT NULL,
  project             TEXT,
  environment         TEXT NOT NULL DEFAULT 'dev',
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running','completed','failed','terminated')),
  total_input_tokens  INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd      REAL NOT NULL DEFAULT 0.0,
  tool_calls          INTEGER NOT NULL DEFAULT 0,
  steps               INTEGER NOT NULL DEFAULT 0,
  failure_root_cause  TEXT,
  loop_detected       BOOLEAN NOT NULL DEFAULT FALSE,
  tags                JSONB NOT NULL DEFAULT '[]',
  metadata            JSONB NOT NULL DEFAULT '{}',
  guard_config        JSONB,
  guard_strikes       JSONB,
  guard_termination   JSONB,
  parent_session_id   TEXT REFERENCES claw_sessions(session_id)
);
CREATE INDEX idx_sessions_org ON claw_sessions(org_id);
CREATE INDEX idx_sessions_status ON claw_sessions(status);
CREATE INDEX idx_sessions_started ON claw_sessions(started_at DESC);
CREATE INDEX idx_sessions_org_started ON claw_sessions(org_id, started_at DESC);
