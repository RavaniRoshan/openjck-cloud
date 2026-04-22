# OpenJCK Python SDK — Agent Context

**Purpose**: Observability and reliability runtime for autonomous AI agents.

> The SDK wraps the Anthropic/OpenAI client — every API call is tracked automatically and sent to OpenJCK Cloud.

---

## Stack

| Category | Choice |
|----------|--------|
| Python | 3.9+ |
| Threading | `threading.Thread` (not asyncio) |
| HTTP | `urllib` (zero external HTTP deps) |
| Hashing | `hashlib` (fingerprints) |
| LLM Clients | `anthropic`, `openai` (optional, user-provided) |

---

## Architecture

```
openjck/
├── __init__.py         # Public API exports
├── claw.py             # ClawSession — core instrumentation
├── guard.py            # GuardConfig — runtime protection
├── replay.py           # ReplaySession — debug without rerunning
├── protocol.py         # ProtocolEmitter — v1 spec
├── alerts.py           # SlackAlert, EmailAlert
├── loop_detector.py    # Tool loop detection
├── config.py           # SDK configuration
└── llm/                # Multi-provider support
    ├── __init__.py
    ├── base.py         # LLMResponse, LLMProvider ABC
    ├── anthropic.py    # AnthropicProvider
    └── openai_compat.py # OpenAICompatibleProvider (Groq, etc.)
```

---

## Core Classes

### ClawSession

```python
from openjck import ClawSession, GuardConfig
import anthropic

# Cloud mode (posts events to OpenJCK)
session = ClawSession(
    client=anthropic.Anthropic(),
    api_key="openjck_prod_xxx",  # Cloud mode when present
    project="my-project",
    environment="prod",
    guard=GuardConfig(max_cost_usd=1.00, max_steps=100),
    record=True,  # Step recordings for Replay
)

# Use like normal Anthropic client
response = session.client.messages.create(
    model="claude-sonnet-4",
    max_tokens=4096,
    messages=[...],
)

# Always close session
session.close()
```

**Tracked per call**:
- Input/output tokens
- Cost (USD)
- Tool calls
- Stop reason
- Duration
- Loop detection

### GuardConfig

Two-strike system: warning → termination.

```python
from openjck import GuardConfig, GuardTriggered
from openjck.alerts import SlackAlert

guard = GuardConfig(
    max_cost_usd=1.00,
    max_steps=100,
    max_tool_calls=50,
    max_duration_seconds=300,
    loop_detection=True,
    check_every_n_steps=1,
    on_guard_trigger=lambda e: print(f"Guard: {e.detail}"),
    alerts=[SlackAlert(webhook_url="...")],
)

session = ClawSession(client=anthropic.Anthropic(), guard=guard)

try:
    # Run agent
    for step in range(1000):
        response = session.client.messages.create(...)
except GuardTriggered as e:
    print(f"Guard stopped session: {e.event.detail}")
```

### ReplaySession

Debug without rerunning.

```python
from openjck import ReplaySession

# Load recorded session
replay = ReplaySession.load("session-uuid")

# Run replay (deterministic)
result = replay.run()
print(f"Steps: {result.total_steps}, Diverged: {len(result.diverged_steps)}")

# Run with overrides
result = replay.run(overrides={
    "read_file": lambda input: {"content": "mocked content"}
})

# Export/import
replay.export_trace("session.agtrace")
imported = ReplaySession.from_file("session.agtrace")
```

### ProtocolEmitter

Send events directly (works with any LLM provider).

```python
from openjck.protocol import ProtocolEmitter

emitter = ProtocolEmitter("https://api.openjck.cloud")

emitter.session_start(
    org_id="org-xxx",
    session_id="sess-xxx",
    claw_name="researcher",
)

emitter.session_step(
    org_id="org-xxx",
    session_id="sess-xxx",
    step=1,
    model="claude-sonnet-4",
    input_tokens=1000,
    output_tokens=500,
)

emitter.session_end(
    org_id="org-xxx",
    session_id="sess-xxx",
    status="completed",
)
```

---

## Multi-Provider Support

**ClawSession works with any LLM provider via provider abstraction.**

```python
from openjck import ClawSession
from openjck.llm import AnthropicProvider, OpenAICompatibleProvider

# Anthropic
anthropic_provider = AnthropicProvider(api_key="sk-ant-...")
session = ClawSession(llm_provider=anthropic_provider)

# Groq (OpenAI-compatible)
groq_provider = OpenAICompatibleProvider(
    api_key="gsk-...",
    base_url="https://api.groq.com/openai/v1"
)
session = ClawSession(llm_provider=groq_provider)

# Any OpenAI-compatible (Together, DeepSeek, etc.)
together_provider = OpenAICompatibleProvider(
    api_key="...",
    base_url="https://api.together.xyz/v1"
)
session = ClawSession(llm_provider=together_provider)
```

---

## Design Principles

### Threading (not asyncio)

```python
# SDK uses threading.Thread for HTTP delivery
# Works without active event loop
# Never crashes user code

from queue import Queue
from threading import Thread

# Internal: BackgroundSender uses queue + thread
self._queue = Queue()
self._thread = Thread(target=self._send_loop, daemon=True)
```

### Zero Dependencies (Beyond LLM SDKs)

```python
# HTTP: urllib (stdlib)
# JSON: json (stdlib)
# Hashing: hashlib (stdlib)
# Threading: threading (stdlib)

# Optional deps:
# - anthropic (user-provided)
# - openai (user-provided)
```

### Fallback to Disk

```python
# When server unreachable, events written to:
# .openjck-fallback.jsonl

# Auto-retry on next successful connection
# Max file size: 100MB
# Auto-cleanup: 30 days
```

---

## Pricing Calculation

```python
from openjck import get_pricing_registry

pricing = get_pricing_registry()

# Calculate cost
cost = pricing.calculate_cost(
    provider="anthropic",
    model="claude-sonnet-4",
    input_tokens=1000,
    output_tokens=500,
)
# Sonnet: $3/M input, $15/M output
# 1000 input * 3/1M + 500 output * 15/1M = $0.003 + $0.0075 = $0.0105
```

---

## Step Recording

```python
# Recordings saved to:
# .openjck/sessions/{session_id}/step_{N:04d}.json

session = ClawSession(
    client=anthropic.Anthropic(),
    record=True,  # Enable recording
    local_storage_dir=".openjck",  # Optional, default: .openjck
)

# Each step creates a JSON file with full packet:
# - Request/response
# - Tool calls
# - Usage stats
# - Guard events
```

---

## Public API Exports

```python
# __init__.py
__all__ = [
    "ClawSession",
    "GuardConfig",
    "GuardTriggered",
    "ReplaySession",
    "ReplayResult",
    "ProtocolEmitter",
    "SlackAlert",
    "EmailAlert",
]
```

---

## Commands

```bash
# Install
pip install openjck

# Editable install (development)
pip install -e .

# Run tests
pytest tests/ -v

# Run specific test
pytest tests/test_claw.py -v
```

---

## Key Files

| File | Purpose |
|------|---------|
| `claw.py` | ClawSession — main instrumentation class |
| `guard.py` | GuardConfig, GuardTriggered exception |
| `replay.py` | ReplaySession, ReplayResult |
| `protocol.py` | ProtocolEmitter for v1 spec |
| `llm/base.py` | LLMResponse, LLMProvider ABC |
| `llm/anthropic.py` | AnthropicProvider |
| `llm/openai_compat.py` | OpenAICompatibleProvider |
| `loop_detector.py` | Tool loop detection logic |
| `alerts.py` | SlackAlert, EmailAlert classes |

---

## Testing

```python
# tests/conftest.py provides fixtures:

@pytest.fixture
def mock_anthropic():
    """Mock Anthropic client for testing."""
    class FakeMessage:
        usage = type('Usage', (), {
            'input_tokens': 1000,
            'output_tokens': 500,
        })()
        stop_reason = 'end_turn'
        content = []

    class FakeMessages:
        def create(self, **kwargs):
            return FakeMessage()

    class FakeAnthropic:
        messages = FakeMessages()

    return FakeAnthropic()
```

---

## Protocol v1 Event Types

```python
# Session lifecycle
"session.start"
"session.step"
"session.flag"      # loop_detected, guard_triggered, etc.
"session.end"
"session.terminate" # manual termination

# Guard events
"guard.warning"     # Strike 1
"guard.terminated"  # Strike 2

# All events include:
# - schema_version: "1.0"
# - session_id, org_id
# - timestamp (ISO8601)
# - usage stats
# - metadata
```

---

## Configuration

```python
# Environment variables (optional)
OPENJCK_API_KEY=openjck_prod_xxx
OPENJCK_ENDPOINT=https://api.openjck.cloud
OPENJCK_LLM_PROVIDER=anthropic
OPENJCK_ANTHROPIC_API_KEY=sk-ant-...
OPENJCK_OPENAI_API_KEY=sk-...
OPENJCK_PRICING_JSON={"model": {"input_per_million": 3.0, ...}}
```

---

## Design Constraints

1. **No asyncio** — Uses `threading.Thread` for compatibility
2. **Zero HTTP deps** — Uses `urllib` from stdlib
3. **Non-blocking** — Events queued, sent in background
4. **Fail-safe** — Server down → fallback to disk
5. **Transparent** — Wraps client, no API changes
6. **Opt-out recording** — `record=False` to disable
