CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  user_id       UUID,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  details       JSONB,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org ON audit_logs(org_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_select_own_org" ON audit_logs FOR SELECT USING (
  org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid())
);
