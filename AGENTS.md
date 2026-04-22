# OpenJCK Cloud — Agent Context

**Product**: Observability and reliability runtime for autonomous AI agent systems.  
**Analogy**: "The Cloudflare for AI agents."

> OpenJCK does not host agents. Agents run on customer infrastructure (AWS, GCP, Azure, on-prem). The SDK posts events to OpenJCK Cloud. We process, store, guard, and visualize.

---

## Repository Structure

```
openjck-cloud/
├── dashboard/           # Next.js 16 dashboard (Vercel)
│   ├── src/app/        # App Router
│   ├── src/components/ # UI components (shadcn/ui)
│   └── AGENTS.md       # Dashboard-specific rules
├── server/              # Node.js/Express API (Railway)
│   ├── routes/         # Express routes
│   ├── middleware/     # Auth, rate limiting
│   └── models/         # Data models (orgAiKey.js, etc.)
├── openjck/             # Python SDK (pip install openjck)
│   ├── claw.py         # ClawSession — core instrumentation
│   ├── guard.py        # GuardConfig — runtime protection
│   ├── replay.py       # ReplaySession — debug without rerunning
│   └── llm/            # Multi-provider support (Anthropic, Groq, etc.)
├── supabase/            # Database migrations
│   └── migrations/
└── docs/
    └── protocol/v1.md  # OpenJCK Protocol specification
```

---

## Architecture

### Service Boundaries

| Service | Stack | Responsibility |
|---------|-------|----------------|
| Dashboard | Next.js 16 + TypeScript + Tailwind 4 | All UI, auth flows, org management |
| API | Node.js Express (ES modules) | SDK ingestion, SSE, Guard, AI Fix |
| Database | Supabase PostgreSQL | All persistent data, Auth, RLS |
| Python SDK | Zero deps beyond anthropic SDK | Customer-side instrumentation |

### Auth Model — Two Systems, Zero Overlap

| System | Who | How | Surface |
|--------|-----|-----|---------|
| Web session auth | Dashboard users (humans) | Supabase Auth JWT | Next.js dashboard |
| API key auth | Python SDK (machines) | Custom hashed bearer | Railway Express |

A compromised API key cannot access the dashboard. A compromised dashboard session cannot post SDK events.

---

## Stack Decisions — LOCKED

### Dashboard (Next.js 16)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Next.js 16 App Router + TypeScript | Latest version, breaking changes from v14 |
| UI | shadcn/ui v4 + Tailwind CSS v4 | Native v4, no `@tailwind` directives |
| Server State | TanStack Query v5 | All server state. No raw `useState` for API data |
| UI State | Zustand | Sidebar, drawers, fleet density |
| Real-time | SSE only | `EventSource → queryClient.setQueryData`. No WebSockets |
| Fonts | IBM Plex Mono (data) + IBM Plex Sans (UI) | Not Inter |

### Backend (Node.js Express)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | Node.js + Express | `type: "module"` in package.json (ES modules) |
| ORM | Supabase client (no ORM) | Direct SQL via Supabase JS client |
| Auth | Supabase Auth (dashboard) + Custom bearer (SDK) | See auth model above |
| Rate limiting | Supabase PostgreSQL | No Redis in v1 |
| SSE | Express + PostgreSQL NOTIFY | Supabase Realtime for NOTIFY |
| Port | 7070 | Matches local tool |

### Python SDK

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Threading | `threading.Thread` | Not asyncio — works without active event loop |
| HTTP | `queue.Queue` + background thread | Non-blocking, never crashes user code |
| Fallback | `.openjck-fallback.jsonl` | Server unreachable → write to disk |

---

## Design System

**Colors**: Charcoal + Amber. No gradients, no purple.

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#1a1a1a` | Page background |
| Surface | `#242424` | Cards, panels |
| Surface hover | `#2a2a2a` | Hover states |
| Accent (amber) | `#f59e0b` | Primary actions, links |
| Success | `#22c55e` | Completed status |
| Danger/Failed | `#ef4444` | Failed status, errors |
| Muted text | `#8a8a8a` | Secondary text |
| Border | `#333333` | Dividers, borders |

**Typography**:
- IBM Plex Mono: Data, IDs, costs, timestamps
- IBM Plex Sans: Labels, prose, UI text

**Status Indicators**:
- Running: Amber pulse animation
- Completed: Green static
- Failed: Red static
- Terminated: Grey static

---

## Coding Patterns

### Database — RLS (Row Level Security)

Every table has `org_id`. PostgreSQL RLS enforces isolation at the database level.

```sql
-- Example RLS policy
CREATE POLICY "sessions_select_own_org" ON claw_sessions
  FOR SELECT USING (org_id IN (
    SELECT org_id FROM organization_members WHERE user_id = auth.uid()
  ));
```

**Rule**: Application-level `WHERE org_id = ?` is defense-in-depth, not the primary guard.

### API Routes — Express (ES Modules)

```javascript
import { Router } from 'express';
import { jwtAuth } from '../middleware/jwt-auth.js';
import { requireRole } from '../middleware/require-role.js';

const router = Router();

// All routes require JWT auth + admin/owner role
router.use(jwtAuth);
router.use(requireRole(['admin', 'owner']));

router.get('/:provider', async (req, res) => {
  try {
    // ... implementation
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Key imports**:
- Use ES module syntax (`import/export`)
- All imports must include `.js` extension
- `supabaseAdmin` from `../db.js` for server-side operations

### Dashboard — Next.js App Router

**Server State (TanStack Query)**:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['ai-keys', 'anthropic'],
  queryFn: async () => {
    const res = await apiClient.get<AiKeyStatus>('/api/v1/settings/ai-keys/anthropic');
    return res.data;
  },
});
```

**Real-time Updates (SSE)**:
```typescript
// EventSource receives SSE → update TanStack Query cache
const eventSource = new EventSource(`/api/sse?orgId=${orgId}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  queryClient.setQueryData(['sessions', data.session_id], data);
};
```

**Tailwind v4 Syntax**:
- NO `@tailwind` directives in CSS
- NO `tailwind.config.js` theme extensions
- Use `var(--color-name)` for theme colors
- Example: `bg-[var(--oj-surface)] text-[var(--oj-text-primary)]`

---

## BYOK (Bring Your Own Key) Feature

**Philosophy**: OpenJCK does not make margin on AI token costs. BYOK allows enterprise customers to use their own Anthropic API key.

| Mode | Who pays | When to use |
|------|----------|-------------|
| OpenJCK Hosted | OpenJCK (baked into plan) | Default. User doesn't want to think about it |
| BYOK | Customer pays Anthropic directly | Cost control, open source spirit |

**Implementation**:
- Keys stored encrypted (AES-256-GCM) in `org_ai_keys` table
- Keys are write-only — never returned in API responses
- Resolution order: org BYOK key → OpenJCK hosted key (`process.env.ANTHROPIC_API_KEY`)
- Keys are ORG-level (not per-user)

**Encryption**:
```javascript
// server/lib/encryption.js
const { encrypt, decrypt } = require('./server/lib/encryption.js');
const { encrypted, iv } = encrypt(plaintextKey);  // Returns { encrypted, iv }
const decrypted = decrypt(encrypted, iv);         // Returns plaintext
```

---

## Environment Variables

### Dashboard (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
OPENJCK_API_URL=http://localhost:7070
```

### Server (.env)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-[OpenJCK hosted key]
ENCRYPTION_KEY=[64 hex chars for AES-256-GCM]
PORT=7070
```

**Generate ENCRYPTION_KEY**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Commands

### Dashboard
```bash
cd dashboard
npm run dev      # Next.js dev server on :3000
npm run build    # Production build
npm run lint     # ESLint check
```

### Server
```bash
cd server
npm run dev      # Node.js --watch on :7070
npm start        # Production start
```

### Python SDK
```bash
cd openjck
pip install -e .  # Editable install
```

### Database
```bash
supabase db reset              # Reset local database
supabase db push              # Push migrations to remote
supabase migration new name   # Create new migration
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/lib/encryption.js` | AES-256-GCM encryption/decryption |
| `server/models/orgAiKey.js` | BYOK key CRUD + resolution |
| `server/routes/aiKeys.js` | BYOK API routes |
| `server/routes/ai-fix.js` | AI Fix endpoint (uses resolved key) |
| `dashboard/src/app/(app)/settings/ai-keys/page.tsx` | BYOK settings UI |
| `supabase/migrations/` | Database schema |

---

## Security Checklist (BYOK)

- [ ] `key_encrypted` NEVER in API responses
- [ ] `key_iv` NEVER in API responses
- [ ] Plaintext key NEVER logged (grep for "sk-ant-" — must be zero)
- [ ] `ENCRYPTION_KEY` set in Railway env vars (not hardcoded)
- [ ] Different `ENCRYPTION_KEY` in dev vs prod
- [ ] Org B cannot read Org A's key metadata (cross-org test)
- [ ] Invalid key format → rejected before calling Anthropic

---

## Documentation

| Document | Location | Contents |
|----------|----------|----------|
| Master Truth | `openjck-master-truth.md` | Architecture, roadmap, philosophy |
| Protocol Spec | `docs/protocol/v1.md` | OpenJCK Protocol v1 specification |
| Dashboard Rules | `dashboard/AGENTS.md` | Next.js 16 specific notes |

---

## AI Fix Feature

POST `/api/v1/sessions/:id/fix` — Claude analyzes failed session, returns root cause + fix.

**Key Resolution**:
```javascript
import { resolveAnthropicKey, markKeyVerified } from '../models/orgAiKey.js';

const { key: anthropicKey, mode: keyMode } = await resolveAnthropicKey(req.orgId);
const anthropic = new Anthropic({ apiKey: anthropicKey });

// After success, mark key verified (for BYOK)
if (keyMode === 'byok') {
  await markKeyVerified(req.orgId, 'anthropic').catch(() => {});
}
```

**Error Handling**:
```javascript
if (err.status === 401 && keyMode === 'byok') {
  return res.status(400).json({
    error: 'Your Anthropic API key is invalid or has expired. Update it in Settings → AI Keys.',
    key_mode: 'byok',
  });
}
```

---

## Change Log

### April 2026 - Edge Case Protection Implementation

**Frontend Boundaries:**
- Global Error Boundary component (`ErrorBoundary`) wraps major sections
- 404 and Forbidden pages with design system styling
- API error handler with status-specific toast notifications
- Form validation utilities for API keys, webhooks, and org names
- Stale data banner with reconciliation triggers
- Request deduplication with AbortController

**Backend Hardening:**
- Global error handler middleware with sanitized responses
- Input validation middleware for event payloads
- TTL cache for brute force protection
- Supabase connection safety with TTL and retry logic
- Health check endpoints with database status

**Auth Edge Cases:**
- JWT auth hardening with timeout protection and NO_ORG error code
- API key auth with brute force protection (20 attempts/minute)
- Revoked key detection with KEY_REVOKED error code

**Real-time Edge Cases (SSE):**
- Max 10 connections per org limit with 429 response
- Snapshot event on connect for data reconciliation
- Dead connection cleanup and heartbeat (15s)
- Client-side data reconciliation on long disconnects

**Guard Edge Cases:**
- Idempotent termination endpoint
- Atomic guard strike increment via PostgreSQL function

---

*Last updated: April 2026*
