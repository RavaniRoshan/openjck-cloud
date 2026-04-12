CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  plan       TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  slug       TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
