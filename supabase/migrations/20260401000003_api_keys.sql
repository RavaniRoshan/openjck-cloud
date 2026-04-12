CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  env          TEXT NOT NULL CHECK (env IN ('prod', 'staging', 'dev')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES auth.users(id)
);
CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
