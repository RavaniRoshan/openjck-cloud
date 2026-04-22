# OpenJCK Cloud

> [!IMPORTANT]
> **🚧 Phase 7: Protocol + AI Fix — COMPLETE**
> 
> This repository contains the complete OpenJCK Cloud implementation, including:
> - **OpenJCK Protocol v1** — Language-agnostic observability standard for AI agents
> - **AI Fix** — Claude-powered failure analysis with actionable fixes
> - Full backend (Node.js/Express), dashboard (Next.js 15), and Python SDK

---

## 🌟 What is OpenJCK Cloud?

**OpenJCK Cloud is the observability and reliability runtime for autonomous AI agent systems.**

> *"The Cloudflare for AI agents."*

Agents run anywhere — AWS, GCP, Azure, on-prem. They post events to OpenJCK Cloud. We process, store, guard, and visualize.

| Need | Answer |
|------|--------|
| What CAN the agent do? | ✅ **What DID the agent actually do?** |
| Why did it fail? | ✅ **How do we fix it?** |
| Who's watching the fleet? | ✅ **Real-time monitoring & AI analysis** |

---

## 🚫 What's NOT in v1

These features are intentionally excluded from v1 to focus on core functionality. They're on the roadmap for future releases.

| Feature | Status | Notes |
|---------|--------|-------|
| **Redis** | ❌ Using Supabase | Rate limiting uses Supabase (slower but sufficient at v1 scale). Redis may be added for higher throughput later. |
| **Per-user API keys** | ❌ Org-level only | All API keys are scoped to organizations. User-level keys may be added in future versions. |
| **EU data residency** | ❌ US-only | All data is stored in US regions. EU/GDPR-compliant regions are on the roadmap. |
| **SOC 2 certification** | ❌ On roadmap | Security compliance is in progress but not yet certified. |
| **Streaming SDK support** | ❌ Sync only | SDK only supports synchronous calls. Streaming/iterative responses are planned. |
| **AI Fix rate limits** | ⚠️ 10/hour | Limited to 10 analyses per session per hour. Resets hourly. |
| **Recording retention** | ⚠️ 30 days | Step recordings are retained for 30 days by default. Configurable via SDK. |
| **Custom pricing map** | ❌ SDK-only | Pricing maps must be set via SDK constructor, not in dashboard UI. |
| **Multi-region deployment** | ❌ Single region | Deployed to a single geographic region. Multi-region failover is planned. |
| **Billing integration** | ❌ Manual | No automated billing. Usage is tracked; manual invoicing in v1. |

---

## 🚀 Quick Start

### For Users (Dashboard)

1. **Sign up** at [dashboard.openjck.cloud](https://dashboard.openjck.cloud)
2. **Create an API key** in Settings
3. **Instrument your agents** with the Python SDK (see below)
4. **Watch live** in the dashboard with SSE updates
5. **Click AI Fix** on any failed session for Claude-powered root cause analysis

### For Developers (Local Setup)

#### Prerequisites
- Node.js 20+
- Python 3.10+
- Supabase account
- Railway CLI (for backend)
- Vercel CLI (for dashboard)
- Anthropic API key (for AI Fix)

#### Environment Setup

```bash
# 1. Clone and install
git clone https://github.com/RavaniRoshan/openjck-cloud.git
cd openjck-cloud

# 2. Install dependencies
cd server && npm install
cd ../dashboard && npm install
cd ../openjck && pip install -e .

# 3. Set up Supabase (see supabase/ directory)
supabase db reset

# 4. Configure environment
cp server/.env.example server/.env
# Edit .env with your Supabase credentials and ANTHROPIC_API_KEY
```

#### Run Locally

```bash
# Terminal 1: Start backend (Railway Express)
cd server
npm run dev
# → API listening on http://localhost:7070

# Terminal 2: Start dashboard (Next.js)
cd dashboard
npm run dev
# → Dashboard at http://localhost:3000

# Terminal 3: Start Python SDK tests
cd openjck
pytest tests/ -v
```

---

## 📦 What's Included

### Repository Structure

```
openjck-cloud/
├── openjck/                 # Python SDK (pip install openjck)
│   ├── claw.py             # ClawSession — core instrumentation
│   ├── guard.py            # GuardConfig — runtime protection
│   ├── protocol.py         # ProtocolEmitter — v1 spec implementation
│   ├── replay.py           # ReplaySession — debug without rerunning
│   └── alerts.py           # SlackAlert, EmailAlert
├── server/                  # Backend API (Node.js/Express)
│   ├── routes/
│   │   ├── ai-fix.js       # AI Fix endpoints (Phase 7)
│   │   ├── protocol.js     # Open Protocol endpoint
│   │   ├── events.js       # SDK event ingestion
│   │   ├── sessions.js     # Session CRUD
│   │   └── sse.js          # Server-Sent Events
│   ├── services/
│   │   └── anthropicClient.js  # Claude integration
│   └── middleware/         # Auth, rate limiting
├── dashboard/               # Next.js 15 dashboard
│   ├── src/components/sessions/
│   │   ├── ai-fix-panel.tsx    # AI Fix UI component
│   │   └── session-drawer.tsx  # Session detail drawer
│   ├── src/hooks/
│   │   └── use-ai-fix.ts       # TanStack Query mutations
│   └── src/lib/types.ts        # TypeScript types
├── supabase/                # Database migrations & schema
│   ├── migrations/
│   │   ├── 20260401000004_claw_sessions.sql
│   │   ├── 20260401000005_step_packets.sql
│   │   └── 20260401000007_rls_policies.sql
│   └── config.toml
├── docs/
│   └── protocol/
│       └── v1.md           # Full OpenJCK Protocol v1 spec
├── tests/                   # Python SDK test suite
├── pyproject.toml          # Python packaging
└── package.json            # Root (monorepo coming soon)
```

---

## 🔥 Key Features

### Phase 1: The Pivot (v0.3) ✅
- One-line Python instrumentation: `pip install openjck`
- Automatic tracking: tokens, cost, tool calls, steps
- Live dashboard with SSE updates

### Phase 2: The Guard (v0.4) ✅
- Active runtime protection
- Two-strike system: warn → terminate
- Guards: cost, steps, tool_calls, duration, loop detection

### Phase 3: The Fleet (v0.5) ✅
- Multi-agent grid view
- Cross-claw correlation
- Real-time activity feed

### Phase 4: The Replay (v0.6) ✅
- Debug without rerunning
- `.openjck/sessions/` file recordings
- `.agtrace` export/import
- Mock overrides for deterministic testing

### Phase 5: The Protocol (v0.7) ✅
- **OpenJCK Protocol v1** — language-agnostic spec
- **AI Fix** — Claude analyzes failures, suggests fixes
- POST `/api/protocol/events` — unauthenticated, open standard
- POST `/api/v1/sessions/:id/fix` — authenticated, AI-powered

---

## 🎯 AI Fix in Action

```python
from openjck import ClawSession
import anthropic

session = ClawSession(
    client=anthropic.Anthropic(),
    api_key="openjck_prod_xxx"
)

# Agent runs and fails...
# In dashboard: click "AI Fix" → Claude returns:

{
  "root_cause": "Tool parameters schema mismatch",
  "fix": "Update read_file tool definition to accept 'path' as string, not array",
  "fix_type": "tool_definition",
  "confidence": "high",
  "verification_test": "Run agent with test input that calls read_file({'path': 'test.py'})"
}
```

---

## 📡 API Reference

### Protocol Events (Unauthenticated)
```
POST /api/protocol/events
Content-Type: application/json

{
  "at_version": "1.0",
  "event": "session.start",
  "session_id": "uuid",
  "org_id": "uuid",
  "timestamp": "2026-04-12T15:30:00Z",
  "payload": { ... }
}
```

### AI Fix (Authenticated)
```
POST /api/v1/sessions/:id/fix
Authorization: Bearer <JWT_TOKEN>

Response:
{
  "root_cause": "...",
  "fix": "...",
  "fix_type": "prompt | tool_definition | guard_config | code | unknown",
  "confidence": "high | medium | low",
  "verification_test": "...",
  "analyzed_at": "2026-04-12T15:35:00Z"
}
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js 20** + **Express 4**
- **Supabase** (PostgreSQL 15 + RLS + Auth)
- **Railway** hosting (port 7070)
- **Cloudflare** edge (DNS, WAF, DDoS)

### Dashboard
- **Next.js 15** (App Router)
- **TanStack Query v5** (server state)
- **Zustand** (UI state)
- **shadcn/ui** (component library)
- **Vercel** hosting

### Python SDK
- **Zero dependencies** beyond `anthropic`
- **Threading** for async HTTP (no asyncio)
- **fallback to `.openjck-fallback.jsonl`** when offline

---

## 📖 Documentation

- **Master Truth** — `openjck-master-truth.md` (local only — not on GitHub)
- **Protocol v1 Spec** — `docs/protocol/v1.md`
- **Architecture** — `skills/system-design/SKILL.md`
- **Frontend Patterns** — `skills/frontend-patterns/SKILL.md`
- **Design System** — `skills/design-system-patterns/SKILL.md`

---

## 🧪 Testing

```bash
# Backend tests
cd server
npm test  # Coming in v0.8

# Dashboard type check
cd dashboard
npm run lint

# Python SDK tests
cd openjck
pytest tests/ -v

# AI Fix verification
cd server
npm run test:ai-fix
```

---

## 🚢 Deployment

### Railway (Backend)
```bash
cd server
railway up --prod
# Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, JWT_SECRET
```

### Vercel (Dashboard)
```bash
cd dashboard
vercel --prod
# Set env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_OPENJCK_API_URL
```

---

## 📄 License

Proprietary — All rights reserved. See LICENSE file for details.

---

## 🤝 Contributing

We're not accepting external contributions yet. This is an internal project under active development.

For issues or feature requests, contact: roshan@openjck.cloud

---

**Built with ❤️ by the OpenJCK Team**

*The Cloudflare for AI agents.*