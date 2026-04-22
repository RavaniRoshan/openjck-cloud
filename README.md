<div align="center">

<img src="https://img.shields.io/badge/version-0.7.0-f59e0b?style=flat-square&labelColor=111110" alt="version" />
<img src="https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square&labelColor=111110" alt="license" />
<img src="https://img.shields.io/badge/python-3.10+-f59e0b?style=flat-square&labelColor=111110" alt="python" />
<img src="https://img.shields.io/badge/node-20+-f59e0b?style=flat-square&labelColor=111110" alt="node" />
<img src="https://img.shields.io/badge/next.js-15-f59e0b?style=flat-square&labelColor=111110" alt="nextjs" />
<img src="https://img.shields.io/badge/protocol-v1.0-22c55e?style=flat-square&labelColor=111110" alt="protocol" />

<br /><br />

<img width="1774" height="887" alt="image" src="https://github.com/user-attachments/assets/99f62d6e-dbba-4f0d-944b-108a99017194" />


```
 ██████╗ ██████╗ ███████╗███╗   ██╗     ██╗ ██████╗██╗  ██╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║     ██║██╔════╝██║ ██╔╝
██║   ██║██████╔╝█████╗  ██╔██╗ ██║     ██║██║     █████╔╝
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██   ██║██║     ██╔═██╗
╚██████╔╝██║     ███████╗██║ ╚████║╚█████╔╝╚██████╗██║  ██╗
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚════╝  ╚═════╝╚═╝  ╚═╝
                                                    CLOUD
```

**The observability and reliability runtime for autonomous AI agent systems.**

*The Cloudflare for AI agents.*

<br />

[Dashboard](https://dashboard.openjck.cloud) · [Docs](https://docs.openjck.cloud) · [Protocol Spec](docs/protocol/v1.md) · [Changelog](CHANGELOG.md)

</div>

---

## What is OpenJCK?

Your agents run on AWS, GCP, Azure, wherever. OpenJCK sits in front of all of them — watching every step, guarding every dollar, alerting when something breaks, and using Claude to tell you exactly why.

```
NVIDIA OpenShell → "What CAN the agent do?"
OpenJCK Cloud   → "What DID it do? Why did it fail? How do we fix it?"
```

These are complementary. OpenShell is the gate. OpenJCK is the eyes, the memory, and the immune system.

---

## Quick Start

```bash
pip install openjck
```

```python
from openjck import ClawSession
from openjck.guard import GuardConfig
from openjck.alerts import SlackAlert
import anthropic

guard = GuardConfig(
    max_cost_usd=1.00,           # Hard stop at $1
    max_steps=100,               # No infinite loops
    alerts=[SlackAlert("https://hooks.slack.com/...")]
)

with ClawSession(
    client=anthropic.Anthropic(),
    api_key="openjck_prod_xxx",  # Get from dashboard.openjck.cloud
    project="my-agent",
    guard=guard,
) as session:
    response = session.client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        messages=[{"role": "user", "content": "Research quantum computing trends"}]
    )

# Every step tracked. Cost calculated. Guard active.
# Session visible in dashboard in real time.
```

That's it. No framework changes. No config files. One line wraps your existing Anthropic client.

---

## The Five Phases

| Phase | Version | What It Does | Status |
|-------|---------|-------------|--------|
| **The Pivot** | v0.3 | Native Claude SDK instrumentation, live dashboard, loop detection | ✅ Done |
| **The Guard** | v0.4 | Cost circuit breaker, two-strike system, Slack/webhook alerts | ✅ Done |
| **The Fleet** | v0.5 | Multi-agent grid view, cross-claw correlation, activity feed | ✅ Done |
| **The Replay** | v0.6 | Session recording, mock replay, `.agtrace` export | ✅ Done |
| **The Protocol** | v0.7 | OpenJCK Protocol v1 open standard, AI Fix via Claude | ✅ Done |

---

## Features

### Instrumentation
- **Zero-config wrapping** — `session.client` is a drop-in for `anthropic.Anthropic()`
- **Full step tracking** — tokens, cost, tool calls, stop reason, duration per step
- **Live cost calculation** — Opus, Sonnet, Haiku pricing maps, auto-updates
- **Loop detection** — flags when the same tool is called with identical inputs 3× in 10 steps
- **LangGraph / CrewAI support** — via `@trace` decorator (legacy framework agents)

### The Guard
- **Cost circuit breaker** — `max_cost_usd=1.0` terminates the session, no surprises at 3am
- **Two-strike system** — warning on first violation, hard termination on second
- **Step + duration limits** — cap runaway sessions by step count or wall-clock time
- **Tool rate limiting** — throttle per-tool call frequency
- **Alert hooks** — `SlackAlert`, `WebhookAlert`, `ConsoleAlert` fire on any guard trigger
- **`GuardTriggered` exception** — catchable, carries full context (which guard, current vs threshold, session ID)

### The Fleet
- **Live fleet grid** — all running agents as cards, density-configurable
- **Fleet health bar** — Healthy / Warning / Critical at a glance
- **Cross-claw correlation** — visual arrows connecting parent → child agent sessions
- **Activity feed** — timestamped log of all events across all agents, virtualized

### The Replay
- **Recording on by default** — opt out with `record=False`
- **Mock replay** — `ReplaySession.load(id).run(overrides={...})` — zero API cost
- **Divergence detection** — flags exactly which step behaved differently
- **`.agtrace` format** — portable ZIP export, share and import any session

### AI Fix
- **One click** — click AI Fix on any failed session in the dashboard
- **Root cause, not crash site** — Claude identifies the earliest decision that made failure inevitable
- **Actionable output** — fix type, confidence level, verification test
- **BYOK or hosted** — use your own Anthropic key or our hosted key, zero margin either way

### OpenJCK Protocol v1
- **Language-agnostic** — emit `session.start / step / flag / end` events from any framework
- **Batch ingestion** — `POST /api/protocol/events` with array of events
- **Idempotent** — duplicate events silently ignored
- **Open spec** — see `docs/protocol/v1.md`

---

## Repository Structure

```
openjck-cloud/
│
├── openjck/                    Python SDK (pip install openjck)
│   ├── claw.py                 ClawSession — core instrumentation
│   ├── guard.py                GuardConfig, GuardTriggered, GuardEvent
│   ├── alerts.py               SlackAlert, WebhookAlert, ConsoleAlert
│   ├── replay.py               ReplaySession — debug without rerunning
│   ├── protocol.py             ProtocolEmitter — v1 open spec implementation
│   └── __init__.py
│
├── server/                     Backend API (Node.js / Express → Railway)
│   ├── routes/
│   │   ├── events.js           POST /api/v1/events — SDK ingestion
│   │   ├── sessions.js         Session CRUD, terminate, fix
│   │   ├── sse.js              GET /api/sse — Server-Sent Events
│   │   ├── fleet.js            GET /api/v1/fleet — aggregation
│   │   ├── replay.js           Step packet read/write
│   │   ├── ai-fix.js           POST /api/v1/sessions/:id/fix
│   │   ├── protocol.js         POST /api/protocol/events
│   │   ├── ai-keys.js          BYOK key management
│   │   └── health.js           GET /health
│   ├── middleware/
│   │   ├── api-key-auth.js     SDK bearer token validation
│   │   ├── jwt-auth.js         Dashboard JWT validation
│   │   ├── rate-limit.js       Per-key sliding window
│   │   └── require-role.js     Role enforcement (owner/admin/member)
│   ├── models/
│   │   ├── clawSession.js      Session CRUD
│   │   ├── stepPackets.js      Step recording
│   │   └── orgAiKey.js         BYOK key storage (AES-256-GCM)
│   ├── config/
│   │   ├── pricing.js          PRICING_MAP + calculateCost
│   │   └── guards.js           DEFAULT_GUARD_CONFIG
│   └── lib/
│       └── encryption.js       AES-256-GCM for BYOK keys
│
├── dashboard/                  Next.js 15 dashboard (→ Vercel)
│   └── src/
│       ├── app/
│       │   ├── (app)/          Authenticated routes
│       │   │   ├── sessions/   Primary session view
│       │   │   ├── fleet/      Multi-agent grid
│       │   │   ├── replay/     Session replay
│       │   │   ├── failure-log/ Failed sessions
│       │   │   └── settings/   API keys, alerts, AI keys, billing
│       │   ├── (auth)/         Login, signup, invite
│       │   └── (public)/       Landing, pricing, docs, changelog
│       ├── components/
│       │   ├── sessions/       Table, drawer, trace, AI fix panel
│       │   ├── fleet/          Health bar, grid, cards, activity feed
│       │   ├── replay/         Launcher, diff viewer, divergence report
│       │   ├── settings/       API key manager, BYOK settings, alerts
│       │   └── layout/         Sidebar, topbar, SSE indicator
│       └── hooks/              TanStack Query hooks per feature
│
├── supabase/
│   └── migrations/             All schema migrations (10 files)
│
├── docs/
│   └── protocol/
│       └── v1.md               OpenJCK Protocol v1 full specification
│
└── sdk/                        Python SDK (separate publish target)
    └── tests/                  Full SDK test suite
```

---

## API Reference

### SDK Event Ingestion

```
POST https://api.openjck.cloud/api/v1/events
Authorization: Bearer openjck_prod_xxx
Content-Type: application/json

[
  { "at_version": "1.0", "event": "session.start",  "session_id": "...", "claw_name": "...", "timestamp": "..." },
  { "at_version": "1.0", "event": "session.step",   "session_id": "...", "step": 1, "model": "...", "input_tokens": 1000, "output_tokens": 500, "timestamp": "..." },
  { "at_version": "1.0", "event": "session.end",    "session_id": "...", "status": "completed", "timestamp": "..." }
]

→ { "accepted": 3, "rejected": 0, "errors": [] }
```

### AI Fix

```
POST /api/v1/sessions/:id/fix
Authorization: Bearer <dashboard JWT>

→ {
    "root_cause": "Tool parameters schema mismatch on step 3",
    "fix": "Update read_file tool definition to accept 'path' as string, not array",
    "fix_type": "tool_definition",
    "confidence": "high",
    "verification_test": "Run agent with test input: read_file({'path': 'test.py'})",
    "analyzed_at": "2026-04-22T15:35:00Z"
  }
```

### OpenJCK Protocol (Open, Unauthenticated)

```
POST /api/protocol/events
Content-Type: application/json

→ { "accepted": N, "rejected": M, "errors": [] }
```

Full spec: [`docs/protocol/v1.md`](docs/protocol/v1.md)

---

## Competitive Position

| | OpenJCK | LangSmith | Langfuse | Arize Phoenix | Helicone |
|---|:---:|:---:|:---:|:---:|:---:|
| Claude-native instrumentation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Live cost tracking | ✅ | Partial | Partial | ❌ | ✅ |
| Guard (auto-terminate) | ✅ | ❌ | ❌ | ❌ | Edge only |
| Mock replay | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fleet multi-agent view | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI-powered fix suggestions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Open observability protocol | ✅ | ❌ | ❌ | ❌ | ❌ |
| Framework agnostic | ✅ | Partial | ✅ | ✅ | ✅ |
| BYOK (no margin on AI) | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## BYOK — Bring Your Own Anthropic Key

OpenJCK makes zero margin on AI token costs. Two modes:

| Mode | Who pays Anthropic | Setup |
|------|-------------------|-------|
| **OpenJCK Hosted** | Included in plan | No setup — works by default |
| **BYOK** | You pay directly, at cost | Settings → AI Keys → add your key |

Your key is validated, then stored AES-256-GCM encrypted. It is never returned via API after creation. Full audit log on every use.

---

## Deployment

### Backend — Railway

```bash
cd server
railway up --prod
```

Required environment variables:
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
JWT_SECRET
ENCRYPTION_KEY          (64 hex chars — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### Dashboard — Vercel

```bash
cd dashboard
vercel --prod
```

Required environment variables:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_OPENJCK_API_URL
```

### Database — Supabase

```bash
supabase db push --db-url $SUPABASE_PROD_DB_URL
```

---

## Local Development

```bash
# Prerequisites: Node.js 20+, Python 3.10+, pnpm 9+, Supabase CLI

# 1. Install
git clone https://github.com/RavaniRoshan/openjck-cloud.git
cd openjck-cloud
cd server && npm install
cd ../dashboard && npm install
cd ../openjck && pip install -e ".[dev]"

# 2. Database
supabase start
supabase db reset      # applies all migrations

# 3. Environment
cp server/.env.example server/.env
cp dashboard/.env.example dashboard/.env.local
# Fill in Supabase credentials from: supabase status

# 4. Run
# Terminal 1
cd server && npm run dev           # → http://localhost:7070

# Terminal 2
cd dashboard && npm run dev        # → http://localhost:3000

# Terminal 3 — test the SDK
python -c "
from openjck import ClawSession
import anthropic
session = ClawSession(client=anthropic.Anthropic(), endpoint='http://localhost:7070')
print('SDK connected to local API ✓')
"
```

---

## v1 Limitations

Intentional exclusions — not forgotten, not broken.

| Feature | Status | Reason |
|---------|--------|--------|
| Redis rate limiting | ❌ Using Supabase | Sufficient at v1 scale. Redis is v2 upgrade. |
| Per-user API keys | ❌ Org-level only | Simplicity. Per-user keys ship with RBAC in v2. |
| EU data residency | ❌ US-only | Supabase EU region planned for v2. |
| SOC 2 | ❌ On roadmap | Target: Q4 2026. |
| Streaming SDK support | ❌ Sync only | Streaming sessions ship as a separate mode. |
| Custom pricing in dashboard | ❌ SDK-only | Set via `ClawSession(pricing_map={...})`. |
| Multi-region | ❌ Single region | Cloudflare Workers migration handles this. |
| Automated billing | ❌ Manual | Stripe integration ships with public launch. |

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Python SDK | Pure Python, zero extra dependencies, `threading.Thread` background sender |
| Backend | Node.js 20, Express, Railway |
| Database | Supabase (PostgreSQL 15, PgBouncer, RLS) |
| Dashboard | Next.js 15 App Router, TanStack Query v5, Zustand, shadcn/ui |
| Real-time | Server-Sent Events (SSE) — no WebSockets |
| Auth | Supabase Auth (magic link + Google OAuth) + custom API key system |
| Edge | Cloudflare (DNS, WAF, DDoS) |
| Fonts | IBM Plex Mono + IBM Plex Sans |
| AI | Anthropic Claude (Sonnet 4 for AI Fix) |

---

## License

MIT — see [LICENSE](LICENSE)

---

## Contact

**Roshan Ravani Singh** · roshan@openjck.cloud

<div align="center">

<br />

*Autonomous agents run 24/7. The average engineer sleeps 7 hours a night.*

*OpenJCK doesn't.*

</div>
