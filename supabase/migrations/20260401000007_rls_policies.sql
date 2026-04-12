ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own_org" ON claw_sessions
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "sessions_insert_own_org" ON claw_sessions
  FOR INSERT WITH CHECK (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "sessions_update_own_org" ON claw_sessions
  FOR UPDATE USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "steps_select_own_org" ON step_packets
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "steps_insert_own_org" ON step_packets
  FOR INSERT WITH CHECK (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "steps_update_own_org" ON step_packets
  FOR UPDATE USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "api_keys_select_own_org" ON api_keys
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "api_keys_insert_own_org" ON api_keys
  FOR INSERT WITH CHECK (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
CREATE POLICY "api_keys_update_own_org" ON api_keys
  FOR UPDATE USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
