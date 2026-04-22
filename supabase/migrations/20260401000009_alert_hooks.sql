CREATE TABLE IF NOT EXISTS alert_hooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  webhook_url text NOT NULL,
  alert_type text NOT NULL DEFAULT 'webhook',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE alert_hooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage alert hooks" ON alert_hooks FOR ALL USING (
  org_id IN (SELECT om.org_id FROM organization_members om WHERE om.org_id = alert_hooks.org_id)
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alert_hooks_updated_at ON alert_hooks;
CREATE TRIGGER alert_hooks_updated_at BEFORE UPDATE ON alert_hooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
