CREATE TABLE organization_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);
