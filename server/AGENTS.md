# OpenJCK Cloud Server — Agent Context

**Stack**: Node.js 20 + Express 4 + ES Modules + Supabase PostgreSQL

> Express API running on Render (port 7070). All routes use ES module syntax (`import/export`).

---

## Stack

| Category | Choice |
|----------|--------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Modules | ES Modules (`"type": "module"` in package.json) |
| Database | Supabase PostgreSQL |
| ORM | None — raw Supabase client |
| Auth | Supabase Auth (JWT) for dashboard, Custom bearer for SDK |

---

## ES Module Syntax

**CRITICAL**: This project uses ES modules. All imports must include `.js` extension.

```javascript
// ✅ CORRECT
import { Router } from 'express';
import { supabaseAdmin } from '../db.js';
import { encrypt, decrypt } from '../lib/encryption.js';

// ❌ WRONG — will fail
import { supabaseAdmin } from '../db';
import { encrypt } from '../lib/encryption';
```

---

## Project Structure

```
server/
├── server.js           # Entry point, Express setup
├── db.js               # Supabase client initialization
├── config/             # Configuration (pricing, etc.)
├── lib/                # Shared utilities
│   └── encryption.js   # AES-256-GCM encryption
├── middleware/         # Express middleware
│   ├── jwt-auth.js     # JWT validation
│   ├── require-role.js # Role-based access
│   └── rate-limit.js   # Rate limiting
├── models/             # Data models
│   └── orgAiKey.js     # BYOK key management
├── routes/             # API routes
│   ├── aiKeys.js       # BYOK routes
│   ├── ai-fix.js       # AI Fix endpoint
│   ├── events.js       # SDK event ingestion
│   ├── sessions.js     # Session CRUD
│   └── ...
└── services/           # Business logic
    └── anthropicClient.js
```

---

## Database Access

**Always use `supabaseAdmin` for server-side operations.**

```javascript
import { supabaseAdmin } from '../db.js';

// Query
const { data, error } = await supabaseAdmin
  .from('claw_sessions')
  .select('*')
  .eq('org_id', orgId)
  .single();

if (error) throw error;
```

**RLS**: Server uses `supabaseAdmin` (service role key) which bypasses RLS. Application-level filtering is required.

---

## Route Pattern

```javascript
import { Router } from 'express';
import { jwtAuth } from '../middleware/jwt-auth.js';
import { requireRole } from '../middleware/require-role.js';

const router = Router();

// Apply middleware
router.use(jwtAuth);
router.use(requireRole(['admin', 'owner']));

router.get('/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const orgId = req.orgId; // Set by jwtAuth middleware

    // Implementation...

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
```

---

## Middleware

### JWT Auth

Sets `req.user` and `req.orgId` from Supabase JWT.

```javascript
// After jwtAuth middleware:
req.user.id       // User UUID
req.user.email    // User email
req.orgId         // Organization UUID
```

### Require Role

```javascript
import { requireRole } from '../middleware/require-role.js';

router.use(requireRole(['admin', 'owner']));  // Must be admin or owner
router.use(requireRole(['owner']));            // Must be owner only
```

---

## Encryption (BYOK)

**AES-256-GCM for encrypting API keys at rest.**

```javascript
import { encrypt, decrypt, getKeyPrefix } from '../lib/encryption.js';

// Encrypt
const { encrypted, iv } = encrypt(plaintextKey);
// Returns: { encrypted: string, iv: string }

// Decrypt
const plaintext = decrypt(encrypted, iv);

// Get prefix for display
const prefix = getKeyPrefix(plaintextKey, 10); // "sk-ant-api0"
```

**Environment**: `ENCRYPTION_KEY` must be 64 hex characters (32 bytes).

```bash
# Generate
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## BYOK Key Resolution

```javascript
import { resolveAnthropicKey } from '../models/orgAiKey.js';

// In route handler:
const { key, mode } = await resolveAnthropicKey(req.orgId);
// Returns: { key: string, mode: 'byok' | 'hosted' }

const anthropic = new Anthropic({ apiKey: key });
```

**Resolution order**:
1. Check `org_ai_keys` table for org's BYOK key
2. If found → decrypt and return `{ key: decrypted, mode: 'byok' }`
3. If not found → return `{ key: process.env.ANTHROPIC_API_KEY, mode: 'hosted' }`

---

## Error Handling

**Always return JSON errors with consistent format:**

```javascript
try {
  // ...
} catch (err) {
  console.error('Route error:', err);
  return res.status(500).json({ error: err.message });
}
```

**Specific status codes**:
- `400` — Bad request (validation errors)
- `401` — Unauthorized (missing/invalid auth)
- `403` — Forbidden (insufficient permissions)
- `404` — Not found
- `500` — Server error

---

## AI Fix Integration

```javascript
import { resolveAnthropicKey, markKeyVerified } from '../models/orgAiKey.js';
import Anthropic from '@anthropic-ai/sdk';

// In /fix endpoint:
const { key: anthropicKey, mode: keyMode } = await resolveAnthropicKey(req.orgId);
const anthropic = new Anthropic({ apiKey: anthropicKey });

try {
  const response = await anthropic.messages.create({ ... });

  // Mark BYOK key as verified on success
  if (keyMode === 'byok') {
    await markKeyVerified(req.orgId, 'anthropic').catch(() => {});
  }

  return res.json({
    root_cause: '...',
    fix: '...',
    _meta: { key_mode: keyMode },
  });
} catch (err) {
  // Special handling for BYOK auth errors
  if (err.status === 401 && keyMode === 'byok') {
    return res.status(400).json({
      error: 'Your Anthropic API key is invalid or has expired. Update it in Settings → AI Keys.',
      key_mode: 'byok',
    });
  }
  return res.status(503).json({ error: 'AI analysis temporarily unavailable' });
}
```

---

## Audit Logging

**Log all security-relevant actions:**

```javascript
await supabaseAdmin.from('audit_logs').insert({
  org_id: req.orgId,
  user_id: req.user.id,
  action: 'ai_key_configured',  // or 'ai_key_removed', etc.
  resource_type: 'org_ai_key',
  details: { provider, mode: 'byok', key_prefix },
});
```

---

## Commands

```bash
npm run dev      # Node.js --watch on :7070
npm start        # Production on :7070
```

---

## Security Rules

- NEVER return `key_encrypted` or `key_iv` in API responses
- NEVER log plaintext API keys (grep logs for "sk-ant-" — must be zero)
- Always validate Anthropic key format before storing (`startsWith('sk-ant-')`)
- Use `supabaseAdmin` only in trusted server code
- All routes must use `jwtAuth` middleware (except public endpoints)

---

## Environment Variables

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For AI Fix
ANTHROPIC_API_KEY=sk-ant-[OpenJCK hosted key]
ENCRYPTION_KEY=[64 hex chars for BYOK encryption]

# Optional
PORT=7070 # Default: 7070
```

---

## Change Log

### April 2026 - Edge Case Protection

**Error Handling:**
- Global error handler middleware with sanitized responses
- Consistent error format: `{ error, code, errorId }`
- Stack traces hidden in production
- Unhandled rejection and uncaught exception handlers

**Input Validation:**
- Event payload validation middleware
- Batch size limit (100 events)
- Session ID sanitization (prevent path traversal)
- Protocol version checking
- UUID parameter validation middleware

**Auth Hardening:**
- JWT auth with 3s timeout protection
- Token format validation
- NO_ORG error code with helpful hint
- API key auth with brute force protection (20 attempts/minute)
- Revoked key detection with KEY_REVOKED error code
- TTL cache for attempt tracking

**Supabase Connection Safety:**
- Client TTL (30 min) with auto-recreation
- `dbQuery` wrapper with timeout and retry
- `checkDbHealth` function for health checks
- Connection error handling with exponential backoff

**SSE Improvements:**
- Max 10 connections per org limit
- 429 response for connection limit exceeded
- Snapshot event on connect for data reconciliation
- Dead connection cleanup with 15s heartbeat
- Connection count tracking

**Guard Edge Cases:**
- Idempotent termination endpoint
- Atomic guard strike increment via PostgreSQL function
- `terminate_session` RPC prevents race conditions
- Already-terminated sessions return `_idempotent: true`
