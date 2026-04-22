CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id)
);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invitations" ON organization_invitations FOR SELECT USING (
  org_id IN (SELECT om.org_id FROM organization_members om WHERE om.org_id = organization_invitations.org_id)
);

CREATE POLICY "Org admins can manage invitations" ON organization_invitations FOR ALL USING (
  org_id IN (SELECT om.org_id FROM organization_members om WHERE om.org_id = organization_invitations.org_id AND om.role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "Org members can view org" ON organizations;
CREATE POLICY "Org members can view org" ON organizations FOR SELECT USING (
  id IN (SELECT om.org_id FROM organization_members om WHERE om.org_id = organizations.id)
);

DROP POLICY IF EXISTS "Org admins can update org" ON organizations;
CREATE POLICY "Org admins can update org" ON organizations FOR UPDATE USING (
  id IN (SELECT om.org_id FROM organization_members om WHERE om.org_id = organizations.id AND om.role IN ('owner', 'admin'))
);
