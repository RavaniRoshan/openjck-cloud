-- Org-level AI provider keys (BYOK)
CREATE TABLE org_ai_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('anthropic')),
  -- NEVER store plaintext. Always AES-256-GCM encrypted.
  key_encrypted   TEXT NOT NULL,
  -- Initialization vector for AES-GCM (base64)
  key_iv          TEXT NOT NULL,
  -- First 10 chars of plaintext key for display: "sk-ant-ap..." → shows user which key
  key_prefix      TEXT NOT NULL,
  -- Verification: store whether the key has been validated successfully
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  -- One key per provider per org
  UNIQUE (org_id, provider)
);

CREATE INDEX idx_org_ai_keys_org ON org_ai_keys(org_id);

-- RLS: org members can see key metadata, never the encrypted value
ALTER TABLE org_ai_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_keys_select_own_org" ON org_ai_keys
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "ai_keys_insert_own_org" ON org_ai_keys
  FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "ai_keys_update_own_org" ON org_ai_keys
  FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "ai_keys_delete_own_org" ON org_ai_keys
  FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Add ai_key_mode column to organizations table
ALTER TABLE organizations
ADD COLUMN ai_key_mode TEXT NOT NULL DEFAULT 'hosted'
  CHECK (ai_key_mode IN ('hosted', 'byok'));
