# OpenJCK Cloud Database — Agent Context

**Stack**: Supabase PostgreSQL + Row Level Security (RLS)

> All data is stored in Supabase. RLS enforces tenant isolation at the database level.

---

## Architecture

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL 15 |
| Auth | Supabase Auth (GoTrue) |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime (PostgreSQL NOTIFY) |
| Migrations | Supabase CLI |

---

## Migrations

**Location**: `supabase/migrations/`

**Naming**: `YYYYMMDD000000_description.sql`

```bash
# Create new migration
supabase migration new org_ai_keys

# Apply migrations locally
supabase db reset

# Push to remote
supabase db push
```

---

## Core Tables

### organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ai_key_mode TEXT NOT NULL DEFAULT 'hosted'  -- 'hosted' | 'byok'
    CHECK (ai_key_mode IN ('hosted', 'byok'))
);
```

### org_ai_keys (BYOK)

```sql
CREATE TABLE org_ai_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic')),
  key_encrypted TEXT NOT NULL,      -- AES-256-GCM encrypted
  key_iv TEXT NOT NULL,             -- IV for decryption
  key_prefix TEXT NOT NULL,         -- "sk-ant-api0" for display
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE (org_id, provider)
);

CREATE INDEX idx_org_ai_keys_org ON org_ai_keys(org_id);
```

**Security**: Key is encrypted, never returned in API responses.

### claw_sessions

```sql
CREATE TABLE claw_sessions (
  session_id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claw_name TEXT NOT NULL,
  project TEXT,
  environment TEXT DEFAULT 'dev',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'terminated')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  steps INTEGER DEFAULT 0,
  loop_detected BOOLEAN DEFAULT FALSE,
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  parent_session_id UUID REFERENCES claw_sessions(session_id)
);

CREATE INDEX idx_claw_sessions_org ON claw_sessions(org_id);
CREATE INDEX idx_claw_sessions_status ON claw_sessions(status);
CREATE INDEX idx_claw_sessions_started ON claw_sessions(started_at DESC);
```

### step_packets

```sql
CREATE TABLE step_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES claw_sessions(session_id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  tool_calls JSONB DEFAULT '[]',
  stop_reason TEXT,
  duration_ms INTEGER,
  guard_events JSONB DEFAULT '[]',
  step_packet JSONB NOT NULL,  -- Full packet JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, step_number)
);

CREATE INDEX idx_step_packets_session ON step_packets(session_id);
```

### api_keys

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,  -- bcrypt hash only
  key_prefix TEXT NOT NULL,        -- "openjck_prod_xk7m"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_api_keys_org ON api_keys(org_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

**Security**: Only hash is stored. Plaintext shown once, never logged.

### organization_members

```sql
CREATE TABLE organization_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);
```

### audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,           -- 'ai_key_configured', etc.
  resource_type TEXT NOT NULL,    -- 'org_ai_key', etc.
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

---

## RLS Policies

**Enable RLS on all tables:**

```sql
ALTER TABLE org_ai_keys ENABLE ROW LEVEL SECURITY;
```

**Policy pattern:**

```sql
-- Read own org only
CREATE POLICY "ai_keys_select_own_org" ON org_ai_keys
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Insert with org membership check
CREATE POLICY "ai_keys_insert_own_org" ON org_ai_keys
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Update own org
CREATE POLICY "ai_keys_update_own_org" ON org_ai_keys
  FOR UPDATE USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Delete own org
CREATE POLICY "ai_keys_delete_own_org" ON org_ai_keys
  FOR DELETE USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

---

## Functions & Triggers

### updated_at trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Migration Template

```sql
-- Migration: YYYYMMDD000000_feature_name.sql

-- Create table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- ... other columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_new_table_org ON new_table(org_id);

-- RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "new_table_select_own_org" ON new_table
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "new_table_insert_own_org" ON new_table
  FOR INSERT WITH CHECK (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "new_table_update_own_org" ON new_table
  FOR UPDATE USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "new_table_delete_own_org" ON new_table
  FOR DELETE USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER update_new_table_updated_at
  BEFORE UPDATE ON new_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset database (apply all migrations fresh)
supabase db reset

# Create new migration
supabase migration new description

# Push to remote
supabase db push

# Pull remote schema
supabase db pull

# Generate types
supabase gen types typescript --local > src/types/supabase.ts
```

---

## Connection Strings

```bash
# Local (from supabase start)
postgresql://postgres:postgres@localhost:54322/postgres

# Remote (from dashboard)
postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

---

## Security Checklist

- [ ] All tables have `org_id` column
- [ ] RLS enabled on all tables
- [ ] Policies restrict to `auth.uid()` membership
- [ ] `ON DELETE CASCADE` on org foreign keys
- [ ] Indexes on `org_id` for performance
- [ ] Never store plaintext API keys (only hashes)
- [ ] Sensitive data encrypted (AES-256-GCM)
- [ ] Audit logging on security events
