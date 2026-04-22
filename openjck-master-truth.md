# OpenJCK Cloud — Master Truth Document
## Version 1.0 · April 2026
## The single source of truth. Every agent reads this before touching anything.

---

## HOW TO USE THIS DOCUMENT

This document is the foundation for all OpenJCK Cloud development. It contains:
1. What the product is and what it is not
2. Every locked architecture decision
3. The complete service boundary map
4. All data models
5. All locked stack decisions with rationale

If this document conflicts with any other document — this one wins. Update the other document, not this one.

---

## PART 1: PRODUCT IDENTITY

### What OpenJCK Cloud Is

OpenJCK Cloud is the **observability and reliability runtime for autonomous AI agent systems**.

It is NOT:
- A debugging toy
- A LangGraph wrapper
- An eval framework
- An execution platform (agents do NOT run inside OpenJCK)
- A competitor to AWS, GCP, or Azure

It IS:
- Infrastructure. Like Prometheus for Kubernetes. Like Cloudflare for the internet.
- The layer that sits between your agents and chaos.

### The Core Analogy — Memorize This

> **"The Cloudflare for AI agents."**

Cloudflare does not host your website. It sits in front of it — watching every connection, guarding every gate, alerting when something goes wrong. OpenJCK does exactly that for autonomous AI agent fleets.

Agents run on the customer's infrastructure (AWS, GCP, Azure, on-prem, anywhere). OpenJCK never touches their compute. The SDK posts events to OpenJCK's cloud. OpenJCK processes, stores, guards, and visualizes.

### The NVIDIA Context

NVIDIA at GTC 2026 declared the "agent inflection point." Always-on Claude-based agents ("claws") are the fastest-growing open-source movement in history — surpassing Linux and Kubernetes adoption velocity. Every serious AI team is moving to 24/7 agent fleets.

**The gap OpenJCK fills:**

| NVIDIA OpenShell answers | OpenJCK Cloud answers |
| --- | --- |
| What CAN the agent do? | What DID the agent actually do? |
| What is the agent allowed to access? | Why did the agent fail? |
| What are the agent's permissions? | How do we fix it? |
| | Who is watching the fleet? |

These are complementary products. OpenShell is the gate. OpenJCK is the eyes, the memory, and the immune system. **Never position them as competitors.**

### Positioning Statement (use verbatim everywhere)

> "OpenJCK is the observability and reliability runtime for autonomous AI agent systems. The Cloudflare for AI agents."

### The 10-Second Pitch

> "OpenShell controls what your agent can touch. OpenJCK tells you what it actually did, why it failed, and how to fix it."

---

## PART 2: PRODUCT — WHAT IT DOES

### Five Phases (Roadmap)

```
v0.3  Phase 1: The Pivot     — Claude-native SDK instrumentation   [IN PROGRESS]
v0.4  Phase 2: The Guard     — Runtime protection layer            [PLANNED]
v0.5  Phase 3: The Fleet     — Multi-agent monitoring              [PLANNED]
v0.6  Phase 4: The Replay    — Debug without rerunning             [PLANNED]
v0.7+ Phase 5: The Protocol  — Open standard + AI Fix              [PLANNED]
```

### Phase 1 — The Pivot (v0.3)

One line of Python. The SDK wraps the Anthropic client — every Claude API call is tracked automatically.

```python
from openjck import ClawSession
import anthropic

session = ClawSession(
    client=anthropic.Anthropic(),
    api_key="openjck_prod_xxx",   # cloud mode when present
    project="my-project",
)
# Use session.client exactly like anthropic.Anthropic()
response = session.client.messages.create(...)
```

What gets tracked per call: input tokens, output tokens, cost (USD), tool calls, stop reason, duration.
What gets flagged: loop detection (same tool + same input × 3 in a 10-step window).
What gets displayed: live Next.js dashboard with SSE updates.

### Phase 2 — The Guard (v0.4)

Active runtime protection. When a guard fires, OpenJCK acts — not just logs.

```python
from openjck.guard import GuardConfig
from openjck.alerts import SlackAlert

guard = GuardConfig(
    max_cost_usd=1.00,
    max_steps=100,
    alerts=[SlackAlert(webhook_url="https://hooks.slack.com/...")]
)
session = ClawSession(client=anthropic.Anthropic(), api_key="...", guard=guard)
```

Two-strike system:
- Strike 1: warning log + Slack alert. Execution continues.
- Strike 2: `GuardTriggered` exception raised. Session terminated.

Guards available: `max_cost_usd`, `max_steps`, `max_tool_calls`, `max_duration_seconds`, `loop_detection`.

### Phase 3 — The Fleet (v0.5)

Fleet dashboard: N agents simultaneously in one configurable grid view.

- Density controls: compact / comfortable / spacious
- Time windows: 1h / 6h / 24h / 7d
- Cross-claw correlation: visual arrows connecting parent→child agent sessions
- Fleet health bar: Healthy / Warning / Critical
- Real-time activity feed (all agents, all events, one stream)

### Phase 4 — The Replay (v0.6)

Debug without rerunning. Every session is recorded by default (`record=False` to opt out).

```python
from openjck import ReplaySession

replay = ReplaySession.load("session-uuid-here")
result = replay.run(overrides={"read_file": lambda input: {"content": "mocked"}})
# result.diverged_steps tells you exactly which step behaved differently
```

Step packets stored at: `.openjck/sessions/{session_id}/step_{N}.json`
Export format: `.agtrace` (ZIP — portable, shareable, importable)
Auto-cleanup: 30 days retention (configurable)

### Phase 5 — The Protocol (v0.7+)

OpenJCK Protocol v1: open, language-agnostic spec for agent observability events. Like OpenTelemetry for distributed tracing, but designed for autonomous agent behavior.

AI Fix: POST `/api/sessions/{id}/fix` → Claude analyzes the failed session → returns root cause, specific fix, confidence level, verification test. One-click in dashboard.

---

## PART 3: CORE DATA ENTITIES

### ClawSession

The primary data unit. One autonomous agent run.

```
session_id          UUID, primary key
org_id              UUID, references organizations
claw_name           TEXT — human label (e.g. "researcher", "code-writer")
project             TEXT — optional project grouping
environment         TEXT — "dev" | "staging" | "prod"
started_at          TIMESTAMPTZ
ended_at            TIMESTAMPTZ (nullable)
status              TEXT — "running" | "completed" | "failed" | "terminated"
total_input_tokens  INTEGER
total_output_tokens INTEGER
total_cost_usd      REAL (calculated, not stored by user)
tool_calls          INTEGER
steps               INTEGER
failure_root_cause  TEXT (nullable — earliest step that made failure inevitable)
loop_detected       BOOLEAN
tags                JSONB array
metadata            JSONB blob
guard_config        JSONB (nullable)
guard_strikes       JSONB (nullable)
guard_termination   JSONB (nullable — {guard_type, detail, triggered_at})
parent_session_id   UUID (nullable — for cross-claw correlation)
```

### Step Packet

One Claude API call within a session. The atomic unit of replay.

```json
{
  "schema_version": "1.0",
  "sdk": { "name": "openjck", "version": "0.3.0", "language": "python", "mode": "cloud" },
  "session": { "session_id": "uuid", "project": "x", "environment": "prod", "started_at": "ISO8601" },
  "event": {
    "event_id": "uuid",
    "event_type": "step_end",
    "timestamp": "ISO8601",
    "step_number": 12
  },
  "request": { "model": "claude-sonnet-4-6", "messages_count": 8, "max_tokens": 4096 },
  "usage": {
    "input_tokens": 1842,
    "output_tokens": 341,
    "tool_call_count": 1,
    "step_cost_usd": 0.000607,
    "session_total_input_tokens": 18420,
    "session_total_output_tokens": 3410,
    "session_total_cost_usd": 0.006071
  },
  "tools": [
    { "tool_name": "read_file", "tool_input": { "path": "src/app.py" }, "fingerprint": "read_file:733df1f4..." }
  ],
  "guard": { "triggered": false, "events": [] },
  "error": null,
  "recording": { "record": true, "trace_path": ".openjck/sessions/..." }
}
```

### GuardEvent

Emitted when a guard rule trips.

```
session_id      string
guard_type      "cost" | "steps" | "tool_calls" | "duration" | "loop"
detail          string — human-readable description
current_value   float — what the value is now
threshold       float — what the limit is
strike          1 | 2
action_taken    "warned" | "terminated"
```

### Pricing Map (server/config/pricing.js)

```javascript
export const PRICING_MAP = {
  "claude-opus-4":    { input_per_million: 15.00, output_per_million: 75.00 },
  "claude-sonnet-4":  { input_per_million: 3.00,  output_per_million: 15.00 },
  "claude-haiku-4-5": { input_per_million: 0.80,  output_per_million: 4.00  },
};
// Default: claude-sonnet-4 pricing if model not found
```

---

## PART 4: ARCHITECTURE

### The One Diagram That Matters

```
CUSTOMER INFRASTRUCTURE                    OPENJCK CLOUD
(AWS / GCP / Azure / On-prem)             (Our infrastructure)

┌────────────────────────┐                ┌──────────────────────────────┐
│                        │                │                              │
│  Agent Fleet           │   HTTPS POST   │  Cloudflare Edge             │
│                        │   (events)     │  (DNS, WAF, DDoS)            │
│  claw_1 ──────────────┼───────────────►│                              │
│  claw_2 ──────────────┼───────────────►│  api.openjck.cloud           │
│  claw_N ──────────────┼───────────────►│  (Railway Express)           │
│                        │                │  - Event ingestion           │
│  pip install openjck   │                │  - Session CRUD              │
│  ClawSession wraps     │                │  - Guard logic               │
│  anthropic.Anthropic() │                │  - SSE emission              │
│                        │                │  - AI Fix (Anthropic call)   │
└────────────────────────┘                │                              │
                                          │  Supabase                    │
                                          │  (PostgreSQL + Auth)         │
                                          │  - All persistent data       │
                                          │  - Row Level Security        │
                                          │  - Auth for dashboard users  │
                                          │                              │
                                          │  dashboard.openjck.cloud     │
                                          │  (Vercel — Next.js 15)       │
                                          │  - Team dashboard            │
                                          │  - Sessions, Fleet, Replay   │
                                          │  - Settings, Billing         │
                                          └──────────────────────────────┘
```

### Service Boundary Table

| Service | URL | Stack | Handles |
| --- | --- | --- | --- |
| Dashboard | `dashboard.openjck.cloud` | Next.js 15 on Vercel | All UI, auth flows, org management |
| API | `api.openjck.cloud` | Node.js Express on Railway | SDK ingestion, SSE, Guard, AI Fix |
| Database | `openjck-prod.supabase.co` | PostgreSQL on Supabase | All persistent data, Auth, Storage |
| Edge | Cloudflare | Free tier | DNS, WAF, DDoS, caching |

### Data Flow — End to End

```
1. SDK (Python, customer infra)
   └─► POST https://api.openjck.cloud/api/v1/events
       Header: Authorization: Bearer openjck_prod_xxx

2. Railway Express receives event
   ├─► Validate API key → resolve org_id
   ├─► Apply rate limit check (Supabase api_key_usage table)
   ├─► Validate payload schema
   ├─► Write to claw_sessions + step_packets (Supabase PostgreSQL)
   ├─► Check guard rules → emit guard event if triggered
   └─► Emit SSE event to all connected dashboard clients for this org_id

3. Dashboard (Next.js, Vercel)
   └─► EventSource('/api/sse?orgId=XXX')
       └─► TanStack Query cache updated via queryClient.setQueryData
           └─► React re-renders affected components only
```

---

## PART 5: STACK DECISIONS — ALL LOCKED

These decisions are permanent for v1. Do not re-evaluate without explicit approval.

### Infrastructure

| Decision | Choice | Rationale |
| --- | --- | --- |
| Database | Supabase (PostgreSQL) | Auth + DB + Storage in one. PgBouncer built-in. RLS native. |
| API hosting | Render | Simplest Node.js hosting. Auto-scaling. Free tier available. |
| Dashboard hosting | Vercel | Next.js native. Zero config. |
| DNS / edge | Cloudflare Free tier | DDoS + WAF at no cost. |
| Environments | dev (local) → staging → production | Three envs, two Supabase projects |
| Redis | NOT in v1 stack | Use Supabase for rate limiting. Redis is v2. |

### Dashboard

| Decision | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 15 App Router + TypeScript | Not Vite. Not standalone React. |
| UI scaffold | shadcn-admin (stripped to layout shell) | Keep sidebar + topbar structure only |
| UI components | shadcn/ui dark theme | Full custom color override |
| Server state | TanStack Query v5 | All server state. No raw useState for API data. |
| UI state | Zustand | Sidebar, drawers, fleet density, fleet window |
| Real-time | SSE only | EventSource → queryClient.setQueryData. No WebSockets. |
| Fonts | IBM Plex Mono (data) + IBM Plex Sans (UI) | Not Inter. Not system fonts. |
| Theme | Charcoal `#1a1a1a` + Amber `#f59e0b` | Non-negotiable. No purple. No gradients. |

### Backend

| Decision | Choice | Rationale |
| --- | --- | --- |
| Language | Node.js + Express | Same as local tool. Minimal delta. |
| ORM | Supabase client (no ORM) | Direct SQL via Supabase JS client. |
| Auth (SDK) | Custom hashed bearer tokens | bcrypt, cost 12, stored as hash, shown once |
| Auth (dashboard) | Supabase Auth | Magic link + Google OAuth. No passwords. |
| Rate limiting | Supabase PostgreSQL (api_key_usage table) | No Redis in v1. |
| SSE | Express + PostgreSQL NOTIFY | Supabase Realtime for NOTIFY. Express for fan-out. |
| Ports | Express on 7070, Next.js on 3000 | Matches local tool. |

### Python SDK

| Decision | Choice | Rationale |
| --- | --- | --- |
| Threading | `threading.Thread` (not asyncio) | Works without active event loop. Predictable. |
| HTTP delivery | `queue.Queue` + background thread | Non-blocking. Never crashes user code. |
| Fallback | Local `.openjck-fallback.jsonl` | Server unreachable → write to disk. |
| Cloud mode trigger | `api_key` present in constructor | No API key = local mode. Key present = cloud mode. |
| Step recording | `record=True` by default | Opt-out, not opt-in. Required for Replay. |
| Constructor | `ClawSession(client=anthropic.Anthropic(), api_key="...", ...)` | Client as first arg. wrap() not used. |
| Dependencies | Zero beyond anthropic SDK | `urllib` for HTTP. `hashlib` for fingerprints. `threading` for sender. |

### Design System

| Decision | Value |
| --- | --- |
| Background | `#1a1a1a` |
| Surface | `#242424` |
| Surface hover | `#2a2a2a` |
| Accent (amber) | `#f59e0b` |
| Success | `#22c55e` |
| Danger/Failed | `#ef4444` |
| Muted text | `#8a8a8a` |
| Border | `#333333` |
| Font: data/IDs/costs | IBM Plex Mono |
| Font: labels/prose | IBM Plex Sans |
| Sidebar width | 220px fixed |
| Topbar height | 48px fixed |
| Drawer width | 600px desktop / 100% mobile |
| Status: running | Amber pulse animation |
| Status: completed | Green static |
| Status: failed | Red static |
| Status: terminated | Grey static |

---

## PART 6: AUTH MODEL

### Two Systems, Zero Overlap

| System | Who | How | Surface |
| --- | --- | --- | --- |
| Web session auth | Dashboard users (humans) | Supabase Auth JWT | Next.js dashboard |
| API key auth | Python SDK (machines) | Custom hashed bearer | Railway ingestion API |

A compromised API key cannot access the dashboard. A compromised dashboard session cannot post SDK events. The boundary is absolute.

### API Key Format

```
openjck_[env]_[32-char base58 random]
Example: openjck_prod_xk7mP9qR2vN4wL8jT3hF6yB1cD5gA0sE
```

- Stored: bcrypt hash only. Plaintext shown once. Never logged.
- Scoped: organization-level in v1. No per-user keys.
- Prefixes: `prod`, `staging`, `dev` — prevents cross-environment accidents.

### Tenant Isolation

Every table has `org_id`. PostgreSQL RLS enforces isolation at the database level — not at the application level. Application-level `WHERE org_id = ?` is defense-in-depth, not the primary guard.

---

## PART 7: WHAT IS NOT BUILT IN V1

Explicit exclusions. Do not build these. Do not design for them. Do not add complexity for them.

| Feature | Status | When |
| --- | --- | --- |
| Redis for rate limiting | ❌ v1 | v2 when throughput > 2,000 req/s |
| WebSockets | ❌ never in v1 | SSE is sufficient |
| Per-user API keys | ❌ v1 | v2 with RBAC |
| Org-specific encryption keys | ❌ v1 | v2 enterprise |
| EU data residency | ❌ v1 | v2 |
| SDK ingestion in Next.js | ❌ always | Railway Express only |
| Feature flags system | ❌ v1 | Not needed yet |
| Multi-region Railway | ❌ v1 | When Railway US is bottleneck |
| Prometheus / Grafana / OpenTelemetry | ❌ always | We build what they are, for agents |
| Vercel for anything except dashboard | ❌ always | Vercel is UI-only |

---

## PART 8: DOCUMENT INVENTORY

The following documents exist and are authoritative. In case of conflict, the Master Truth Document (this file) wins, then the specific technical doc wins over any other source.

| Document | Status | What it covers |
| --- | --- | --- |
| `master-truth.md` (this file) | ✅ Canonical | Everything locked |
| `cloud-infrastructure-plan.md` | ✅ Clean | Services, DNS, environments, cost |
| `deployment-architecture.md` | ✅ Clean | CI/CD, migrations, runbooks, local dev |
| `security-and-auth-model.md` | ✅ Fixed v1.1 | Auth, RLS, rate limiting (Supabase), threat model |
| `frontend-architecture.md` | ✅ Fixed v1.1 | Next.js routes, state, components, SSE, service boundary |
| `python-sdk-architecture.md` | ✅ Clean | SDK class design, threading, packet schema |
| `design-system-document.md` | ✅ Clean | Tokens, components, animations, layout |
| `competitive-analysis.md` | ✅ Clean | Market positioning, competitor deep-dives, pricing rec |

**Cut documents:**
- `openjck-market-and-competitive-intelligence.md` — merged into competitive-analysis, deleted

---

## PART 9: KNOWN OPEN QUESTIONS

These are not decided. Do not bake assumptions about them into code.

| Question | Current default | Decision needed before |
| --- | --- | --- |
| Billing / pricing tiers (Free / Pro / Enterprise pricing) | Free tier, Pro $49/seat/mo (recommended, not confirmed) | Landing page launch |
| Payment processor | Not selected | Billing feature build |
| Step packet storage: PostgreSQL JSONB vs Supabase Storage files | PostgreSQL JSONB for v1 (simpler) | Backend build prompt 1 |
| AI Fix billing to customers (included in Pro or metered?) | Not decided | AI Fix build |
| Anthropic model version for AI Fix | claude-sonnet-4-6 | AI Fix build |
| `.agtrace` format: JSON-in-ZIP vs binary | JSON-in-ZIP | Replay build |
| SSE: proxy through Next.js or direct from Railway? | Proxy through Next.js for v1 | Backend build |

---

## PART 10: COMPETITIVE SNAPSHOT

| Competitor | Their moat | OpenJCK's edge |
| --- | --- | --- |
| LangSmith | LangChain/LangGraph deep integration | Claude-native, framework-agnostic, Guard layer |
| Arize Phoenix | ML eval pipelines, RAG debugging | Autonomous session focus, Replay, AI Fix |
| Langfuse | Open-source, self-hostable | Fleet dashboard, Guard system, Protocol standard |
| Helicone | API proxy, caching, edge rate limiting | Semantic loop detection (not API rate limiting), Replay |
| NVIDIA OpenShell | Access control sandbox | Complementary — OpenShell is the gate, OpenJCK is the immune system |

**What NO competitor has:**
1. Guard layer with active session termination
2. Mock Replay (debug without re-running)
3. Fleet multi-agent monitoring
4. AI-powered fix suggestions
5. An open Protocol standard for agent observability

---

*Document version: 1.0 — April 2026*
*Next update: after first Cursor build prompt executes and produces real schema*
*Owner: Roshan Ravani*
