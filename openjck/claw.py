"""
OpenJCK ClawSession — Provider-agnostic LLM instrumentation.

This module provides the main ClawSession class which can work with
ANY LLM provider through the LLMProvider interface.

Backward compatibility:
- Old code using `ClawSession(client=anthropic.Anthropic(...))` still works
- New code can use `ClawSession(provider="groq", api_key="...")` or `ClawSession(llm_provider=my_provider)`
"""

import json
import queue
import threading
import time
import uuid
import warnings
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional, Dict, List

from urllib.request import Request, urlopen
from urllib.error import URLError

import anthropic  # Still needed for type compatibility and backward compatibility
from .alerts import Alert, SessionEndEvent
from .guard import GuardConfig, GuardTriggered, GuardEvent
from .loop_detector import LoopDetector, LoopDetectionResult
from .llm import LLMProvider, get_provider, get_pricing_registry
from .llm.providers import AnthropicProvider


# ---------------------------------------------------------------------------
# Helper functions (unchanged)
# ---------------------------------------------------------------------------

def deep_copy_messages(messages: List[Dict]) -> List[Dict]:
    """Deep copy messages array, handling various SDK types."""
    result = []
    for msg in messages:
        copied = dict(msg)
        if 'content' in copied:
            content = copied['content']
            if isinstance(content, list):
                copied['content'] = [
                    dict(block) if hasattr(block, '__dict__') or hasattr(block, 'model_dump')
                    else block
                    for block in content
                ]
            elif hasattr(content, 'model_dump'):
                copied['content'] = content.model_dump()
            elif hasattr(content, '__dict__'):
                copied['content'] = dict(content.__dict__)
        result.append(copied)
    return result


def serialize_response(response) -> Dict:
    """Serialize response from any provider to dict for step packet."""
    # If it's our LLMResponse, convert using asdict or __dict__
    if hasattr(response, 'model_dump'):
        return response.model_dump()
    if hasattr(response, '__dict__'):
        data = response.__dict__.copy()
        # Remove private fields
        data = {k: v for k, v in data.items() if not k.startswith('_')}
        return data
    # Fallback: try to extract common fields
    return {
        'id': getattr(response, 'id', None),
        'type': getattr(response, 'type', 'message'),
        'role': getattr(response, 'role', 'assistant'),
        'model': getattr(response, 'model', None),
        'content': getattr(response, 'content', []),
        'stop_reason': getattr(response, 'stop_reason', None),
        'stop_sequence': getattr(response, 'stop_sequence', None),
        'usage': getattr(response, 'usage', None),
    }


def extract_tool_results(messages: List[Dict]) -> Dict[str, Any]:
    """Extract tool results from messages array (for patching prior step)."""
    tool_results = {}
    for msg in messages:
        if msg.get('role') == 'user':
            content = msg.get('content', [])
            if isinstance(content, list):
                for block in content:
                    if block.get('type') == 'tool_result':
                        tool_use_id = block.get('tool_use_id')
                        if tool_use_id:
                            tool_results[tool_use_id] = block.get('content')
    return tool_results


# ---------------------------------------------------------------------------
# Background Sender (unchanged)
# ---------------------------------------------------------------------------

SENTINEL = object()

class BackgroundSender:
    """Background thread to send events to OpenJCK server with retry."""
    
    def __init__(self, org_id: str, session_id: str, endpoint: str = "/api/v1/events"):
        self._org_id = org_id
        self._session_id = session_id
        self._endpoint = endpoint
        self._queue = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
    
    def enqueue(self, event: Dict[str, Any]) -> None:
        """Enqueue an event for async sending."""
        self._queue.put(event)
    
    def _worker(self) -> None:
        """Background worker: send events with exponential backoff."""
        while True:
            try:
                event = self._queue.get(timeout=1)
                if event is SENTINEL:
                    break
                self._send_with_retry(event)
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[openjck] BackgroundSender error: {e}")
    
    def _send_with_retry(self, event: Dict[str, Any], max_attempts: int = 5) -> None:
        """Send event with exponential backoff retry."""
        from .config import load_config
        config = load_config()
        endpoint = config.endpoint or "https://api.openjck.cloud"
        url = endpoint + self._endpoint
        
        attempt = 0
        while attempt < max_attempts:
            try:
                payload = json.dumps(event).encode('utf-8')
                headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'OpenJCK-Python/0.3.0'
                }
                # Add auth if available
                if config.api_key:
                    headers['Authorization'] = f'Bearer {config.api_key}'
                
                req = Request(url, data=payload, headers=headers, method='POST')
                with urlopen(req, timeout=5) as resp:
                    if resp.status >= 400:
                        raise URLError(f"HTTP {resp.status}")
                return  # Success
            except Exception as e:
                attempt += 1
                if attempt >= max_attempts:
                    # Write to fallback file
                    fallback_path = Path(".openjck-fallback.jsonl")
                    fallback_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(fallback_path, "a") as f:
                        f.write(json.dumps({
                            "timestamp": datetime.utcnow().isoformat(),
                            "endpoint": self._endpoint,
                            "payload": event,
                            "error": str(e)
                        }) + "\n")
                    break
                delay = min(2 ** attempt, 30)
                time.sleep(delay)
    
    def flush_and_stop(self) -> None:
        """Enqueue sentinel to stop worker and wait for thread to finish."""
        self._queue.put(SENTINEL)
        self._thread.join(timeout=5.0)


# ---------------------------------------------------------------------------
# ClawProxy — Transparent wrapper (now uses LLMProvider)
# ---------------------------------------------------------------------------

class ClawProxy:
    """Transparent wrapper that intercepts messages.create and adds instrumentation."""
    
    def __init__(self, session: 'ClawSession'):
        self._session = session
        # No separate client; the session has llm_provider
    
    def __getattr__(self, name: str) -> Any:
        """Delegate all attributes to messages namespace (for messages.create)."""
        if name == "messages":
            return self._MessagesProxy(self._session)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
    
    # def messages  # handled via __getattr__ returning _MessagesProxy
    
    class _MessagesProxy:
        """Proxy for messages.create method with deferred write for tool output capture."""
        
        def __init__(self, session: 'ClawSession'):
            self._session = session
        
        def create(self, **kwargs):
            """Intercept messages.create, track usage, capture inputs/response, and defer step writing."""
            step_start_time = time.time()
            
            # 1. BEFORE API CALL: Capture full messages array
            input_messages = deep_copy_messages(kwargs.get('messages', []))
            
            # 2. EXTRACT TOOL RESULTS from current messages array
            tool_results_map = extract_tool_results(kwargs.get('messages', []))
            
            # 3. PATCH PRIOR STEP with tool outputs and WRITE to disk
            if self._session._pending_step_packet is not None:
                prior_packet = self._session._pending_step_packet
                
                for tool_entry in prior_packet.get('tools', []):
                    tool_use_id = tool_entry.get('tool_use_id')
                    if tool_use_id and tool_use_id in tool_results_map:
                        tool_entry['tool_output'] = tool_results_map[tool_use_id]
                
                if self._session.record:
                    self._session._write_step_to_disk(prior_packet)
            
            # 4. CALL THE ACTUAL API via provider abstraction
            model = kwargs.get('model', self._session.default_model)
            max_tokens = kwargs.get('max_tokens')
            tools = kwargs.get('tools')

            # Extract other kwargs that are safe to pass to provider
            # (e.g., temperature, top_p, etc.)
            provider_kwargs = {k: v for k, v in kwargs.items()
                             if k not in ('model', 'messages', 'max_tokens', 'tools')}

            try:
                response = self._session.llm_provider.chat_completion(
                    messages=kwargs.get('messages', []),
                    model=model,
                    max_tokens=max_tokens,
                    tools=tools,
                    **provider_kwargs
                )
            except Exception as e:
                # Send failure telemetry
                self._session._sender.enqueue("/api/v1/events", {
                    "event": "session.flag",
                    "flag_type": "provider_error",
                    "session_id": self._session.session_id,
                    "detail": f"{type(e).__name__}: {str(e)}"
                })
                # Terminate session with GuardTriggered (intentional crash)
                guard_event = GuardEvent(
                    session_id=self._session.session_id,
                    guard_type="provider_error",
                    detail=f"LLM provider failed: {type(e).__name__}: {str(e)}",
                    current_value=0,
                    threshold=0,
                    strike=1,
                    action_taken="terminated"
                )
                raise GuardTriggered(guard_event) from e
            
            # 5. EXTRACT USAGE and MODEL from unified response
            input_tokens = response.usage.get('input_tokens', 0)
            output_tokens = response.usage.get('output_tokens', 0)
            # Use the model we sent (or from response if available)
            model_used = response.model or model
            
            # 6. CALCULATE COST using pricing registry
            pricing_registry = get_pricing_registry()
            provider_name = self._session.llm_provider.provider_name
            try:
                step_cost = pricing_registry.calculate_cost(
                    provider=provider_name,
                    model=model_used,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens
                )
            except Exception:
                # Fallback to a safe default if pricing lookup fails
                step_cost = 0.0
            
            # 7. UPDATE SESSION COUNTERS
            self._session._input_tokens += input_tokens
            self._session._output_tokens += output_tokens
            self._session._total_cost_usd += step_cost
            self._session._step_count += 1
            
            # 8. EXTRACT TOOL USES from unified response
            tool_uses = response.get_tool_uses()
            self._session._tool_call_count += len(tool_uses)
            
            # 9. CHECK GUARDS
            guard_events = []
            if self._session.guard:
                guard_events = self._session._check_guards(step_cost)
            
            # 10. LOOP DETECTION
            if self._session.guard and self._session.guard.loop_detection:
                loop_result = self._session._loop_detector.check(tool_uses)
                if loop_result.detected and not self._session.loop_detected:
                    self._session.loop_detected = True
                    self._session._sender.enqueue("/api/v1/events", {
                        "event": "session.flag",
                        "flag_type": "loop_detected",
                        "session_id": self._session.session_id,
                        "detail": loop_result.detail
                    })
                    if not self._session.silent:
                        warnings.warn(
                            f"OpenJCK: Loop detected in session {self._session.session_id} — "
                            f"{loop_result.fingerprint} appeared {loop_result.count}x in last 10 tool calls",
                            stacklevel=3
                        )
            
            # 11. BUILD STEP EVENT
            duration_ms = (time.time() - step_start_time) * 1000
            step_number = self._session._step_count
            event_id = str(uuid.uuid4())
            now = datetime.utcnow().isoformat() + "Z"
            
            # Prepare tool info with tool_use_id for matching with tool_results
            tools_info = []
            for tool_use in tool_uses:
                tool_input = tool_use.get('input', {})
                fingerprint = self._session._loop_detector.hash_input(tool_input)
                tool_use_id = tool_use.get('id')
                tools_info.append({
                    "tool_name": tool_use.get('name', 'unknown'),
                    "tool_input": tool_input,
                    "fingerprint": fingerprint,
                    "tool_use_id": tool_use_id,
                    "tool_output": None  # Will be patched when next step starts
                })
            
            # Totals
            session_total_input = self._session._input_tokens
            session_total_output = self._session._output_tokens
            session_total_cost = self._session._total_cost_usd
            
            # 12. Serialize response for step packet
            response_data = serialize_response(response)
            
            step_event = {
                "schema_version": "1.0",
                "sdk": {
                    "name": "openjck",
                    "version": "0.4.0",
                    "language": "python",
                    "mode": self._session.mode,
                    "provider": provider_name  # Track which LLM provider was used
                },
                "session": {
                    "session_id": self._session.session_id,
                    "project": self._session.project,
                    "environment": self._session.environment,
                    "started_at": self._session._started_at.isoformat() + "Z"
                },
                "event": {
                    "event_id": event_id,
                    "event_type": "step_end",
                    "timestamp": now,
                    "step_number": step_number
                },
                "request": {
                    "model": model_used,
                    "messages_count": len(input_messages),
                    "max_tokens": max_tokens
                },
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "tool_call_count": len(tool_uses),
                    "step_cost_usd": round(step_cost, 10),
                    "session_total_input_tokens": session_total_input,
                    "session_total_output_tokens": session_total_output,
                    "session_total_cost_usd": round(session_total_cost, 10)
                },
                "tools": tools_info,
                "guard": {
                    "triggered": bool(guard_events),
                    "events": [asdict(e) for e in guard_events],
                    "loop_detected": getattr(self._session, 'loop_detected', False)
                },
                "error": None,
                "recording": {
                    "record": self._session.record,
                    "trace_path": None,
                    "provider": provider_name
                },
                "input_messages": input_messages,
                "response": response_data
            }
            
            # 13. SET TRACE PATH if recording
            if self._session.record:
                filename = f"step_{step_number:04d}.json"
                path = self._session._storage_path / filename
                step_event["recording"]["trace_path"] = str(path)
            
            # 14. STORE AS PENDING (deferred write)
            self._session._pending_step_packet = step_event
            
            # 15. POST EVENT TO SENDER
            self._session._sender.enqueue(step_event)
            
            return response


# ---------------------------------------------------------------------------
# ClawSession — Main Session Class (Refactored)
# ---------------------------------------------------------------------------

class ClawSession:
    """
    Main session class that works with ANY LLM provider.
    
    Args:
        # Provider configuration (choose one):
        llm_provider: Pre-configured LLMProvider instance
        provider: Provider name ('anthropic', 'openai', 'groq', 'together', 'custom')
        client: (DEPRECATED) anthropic.Anthropic instance for backward compatibility
        
        api_key: API key for the chosen provider
        base_url: Custom base URL (for OpenAI-compatible endpoints)
        
        # Session config:
        session_id: Unique session ID (auto-generated if not provided)
        project: Project name
        environment: Environment label (default: 'dev')
        tags: List of string tags
        metadata: Arbitrary metadata dict
        guard: GuardConfig for safety rules
        record: Whether to record steps to disk (default: True)
        local_storage_dir: Base directory for recordings (default: '.openjck')
        endpoint: OpenJCK server endpoint for telemetry
        silent: Suppress warnings if True
        **kwargs: Additional provider-specific arguments
        
    Examples:
        # Anthropic (default)
        session = ClawSession(api_key="sk-ant-...")
        
        # Groq
        session = ClawSession(provider="groq", api_key="gsk_...")
        
        # OpenAI
        session = ClawSession(provider="openai", api_key="sk-...")
        
        # Custom OpenAI-compatible endpoint
        session = ClawSession(provider="custom", api_key="...", base_url="https://api.example.com/v1")
        
        # Pre-configured provider
        from openjck.llm import get_provider
        provider = get_provider(provider="groq", api_key="gsk_...")
        session = ClawSession(llm_provider=provider)
    """
    
    def __init__(
        self,
        *,
        # Provider selection (choose one)
        llm_provider: Optional[LLMProvider] = None,
        provider: Optional[str] = None,
        client: Optional[Any] = None,  # DEPRECATED: anthropic.Anthropic for backward compat
        
        # Credentials
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        
        # Session configuration
        session_id: Optional[str] = None,
        project: Optional[str] = None,
        environment: str = "dev",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        guard: Optional[GuardConfig] = None,
        record: bool = True,
        local_storage_dir: str = ".openjck",
        endpoint: Optional[str] = None,
        silent: bool = False,
        **kwargs
    ):
        # 1. Resolve LLM provider
        if llm_provider is not None:
            self.llm_provider = llm_provider
        elif client is not None:
            # Backward compatibility: wrap anthropic client in AnthropicProvider
            # We can't use the provided client directly because we need provider abstraction
            # Extract api_key from client if possible? Not easily. Assume user will also provide api_key or we have ANTHROPIC_API_KEY env
            if api_key is None:
                import os
                api_key = os.getenv("ANTHROPIC_API_KEY")
                if not api_key:
                    raise ValueError(
                        "When using client=anthropic.Anthropic(...), you must also provide "
                        "api_key parameter or set ANTHROPIC_API_KEY environment variable."
                    )
            self.llm_provider = AnthropicProvider(api_key=api_key, base_url=base_url)
        else:
            # Auto-create provider from environment / parameters
            try:
                self.llm_provider = get_provider(
                    provider=provider,
                    api_key=api_key,
                    base_url=base_url,
                    **kwargs
                )
            except Exception as e:
                raise ValueError(
                    f"Failed to create LLM provider. Provide either: "
                    f"(1) llm_provider=, (2) client= (with api_key), or "
                    f"(3) provider= + api_key=. Error: {e}"
                )
        
        self.provider_name = self.llm_provider.provider_name  # e.g., "anthropic", "groq"
        self.session_id = session_id or str(uuid.uuid4())
        self.project = project
        self.environment = environment
        self.guard = guard or GuardConfig()
        self.record = record
        self.local_storage_dir = local_storage_dir
        self.silent = silent
        self._started_at = datetime.utcnow()
        self.endpoint = endpoint
        
        # Set endpoint (where to send telemetry)
        if self.endpoint is None:
            # Check OPENJCK_API_URL env var, else use mode-based default
            import os
            self.endpoint = os.getenv("OPENJCK_API_URL") or os.getenv("OPENJCK_ENDPOINT")
            if not self.endpoint:
                self.endpoint = "https://api.openjck.cloud"  # default cloud
        
        self.mode = "cloud" if self.endpoint.startswith("http") else "local"
        
        # Initialize counters
        self._input_tokens = 0
        self._output_tokens = 0
        self._total_cost_usd = 0.0
        self._step_count = 0
        self._tool_call_count = 0
        self._guard_strikes: Dict[str, int] = {}  # Guard strike tracking
        
        # Loop detection
        self._loop_detector = LoopDetector()
        self.loop_detected = False
        
        # Deferred write
        self._pending_step_packet: Optional[Dict[str, Any]] = None
        
        # Recording storage setup
        if self.record:
            self._storage_path = Path(self.local_storage_dir) / "sessions" / self.session_id
            self._storage_path.mkdir(parents=True, exist_ok=True)
        else:
            self._storage_path = None
        
        # Background sender
        # Determine org_id from environment or config (needed for telemetry)
        org_id = os.getenv("OPENJCK_ORG_ID") or "unknown"
        self._sender = BackgroundSender(org_id, self.session_id, "/api/v1/events")
        
        # Set default model for this provider (can be overridden per call)
        self.default_model = self._get_default_model_for_provider()
        
        # Log session start
        self._sender.enqueue({
            "event": "session.start",
            "session_id": self.session_id,
            "org_id": org_id,
            "claw_name": project or "unknown",
            "environment": environment,
            "tags": tags or [],
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
    
    def _get_default_model_for_provider(self) -> str:
        """Return a sensible default model for the current provider."""
        provider = self.provider_name
        if provider == "anthropic":
            return "claude-sonnet-4"
        elif provider == "openai":
            return "gpt-4o"
        elif provider == "groq":
            return "llama-3.3-70b-versatile"
        elif provider == "together":
            return "meta-llama/Llama-3-70b-chat-hf"
        else:
            return "gpt-4o"  # generic fallback
    
    # Property for backward compatibility: session.client.messages.create()
    @property
    def client(self) -> ClawProxy:
        """Return a proxy object that intercepts messages.create."""
        if not hasattr(self, '_client_proxy'):
            self._client_proxy = ClawProxy(self)
        return self._client_proxy
    
    # Direct call support: session.create(messages=...)  (optional convenience)
    def create(self, **kwargs):
        """Direct call to LLM (bypasses .client.messages proxy)."""
        return self.client.messages.create(**kwargs)
    
    def _write_step_to_disk_impl(self, step_event: Dict[str, Any]) -> None:
        """Write step packet to disk as JSON."""
        step_num = step_event.get('event', {}).get('step_number', 0)
        filename = f"step_{step_num:04d}.json"
        path = self._storage_path / filename
        with open(path, 'w') as f:
            json.dump(step_event, f, indent=2)
    
    def close(self, status: str = "completed", error: Optional[str] = None) -> None:
        """Close the session, posting session.end event and stopping sender."""
        # 1. FLUSH PENDING STEP PACKET (final step, no next step to trigger write)
        if self.record and self._pending_step_packet is not None:
            # Call the actual method (not bound lambda)
            if hasattr(self, '_write_step_to_disk_method'):
                self._write_step_to_disk_method(self._pending_step_packet)
            self._pending_step_packet = None
        
        # 2. FIRE SESSION END ALERTS (before posting event, guaranteed even if event fails)
        if self.guard and self.guard.alerts:
            end_event = SessionEndEvent(
                session_id=self.session_id,
                timestamp=datetime.utcnow().isoformat() + "Z",
                claw_name=self.project or self.session_id[:8],
                status=status,
                total_cost_usd=round(self._total_cost_usd, 10),
                total_steps=self._step_count,
                failure_root_cause=error if status in ("failed", "terminated") else None
            )
            for alert in self.guard.alerts:
                threading.Thread(target=alert.send, args=(end_event,), daemon=True).start()
        
        # 3. POST SESSION.END EVENT
        self._sender.enqueue({
            "event": "session.end",
            "session_id": self.session_id,
            "org_id": "unknown",  # Should be stored in session; fix later
            "status": status,
            "summary": {
                "steps": self._step_count,
                "input_tokens": self._input_tokens,
                "output_tokens": self._output_tokens,
                "cost_usd": self._total_cost_usd,
            },
            "ended_at": datetime.utcnow().isoformat() + "Z",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        
        # 4. STOP BACKGROUND SENDER
        self._sender.flush_and_stop()
    
    def _check_guards(self, step_cost: float) -> List[GuardEvent]:
        """Check guard rules and trigger warnings/termination based on two-strike system."""
        guard = self.guard
        if not guard:
            return []
        
        # Only check every N steps
        if self._step_count % guard.check_every_n_steps != 0:
            return []
        
        # Build checks list
        checks = [
            ("cost", self._total_cost_usd, guard.max_cost_usd),
            ("steps", float(self._step_count), float(guard.max_steps) if guard.max_steps is not None else None),
            ("tool_calls", float(self._tool_call_count), float(guard.max_tool_calls) if guard.max_tool_calls is not None else None),
            ("duration", (datetime.utcnow() - self._started_at).total_seconds(), float(guard.max_duration_seconds) if guard.max_duration_seconds is not None else None),
        ]
        
        # Add loop detection if triggered
        if guard.loop_detection and self.loop_detected:
            checks.append(("loop", 1.0, 1.0))
        
        guard_events: List[GuardEvent] = []
        
        for guard_type, current, threshold in checks:
            # Skip if no threshold set
            if threshold is None:
                continue
            
            # Check if threshold exceeded
            if current < threshold:
                # Reset strike counter if back under threshold
                if guard_type in self._guard_strikes:
                    del self._guard_strikes[guard_type]
                continue
            
            # Threshold exceeded - increment strike
            self._guard_strikes[guard_type] = self._guard_strikes.get(guard_type, 0) + 1
            strike = self._guard_strikes[guard_type]
            
            # Create guard event
            event = GuardEvent(
                session_id=self.session_id,
                guard_type=guard_type,
                detail=f"{guard_type} {current:.4f} exceeded limit {threshold:.4f}",
                current_value=current,
                threshold=threshold,
                strike=strike,
                action_taken="warned" if strike == 1 else "terminated"
            )
            guard_events.append(event)
            
            # Fire alerts (Phase 4.2) - run in background thread
            for alert in guard.alerts:
                threading.Thread(target=alert.send, args=(event,), daemon=True).start()
            
            # Invoke callback if set (protect against user code errors)
            if guard.on_guard_trigger:
                try:
                    guard.on_guard_trigger(event)
                except Exception as cb_err:
                    # Log but don't crash user code
                    warnings.warn(
                        f"OpenJCK: guard.on_guard_trigger callback raised {type(cb_err).__name__}: {cb_err}",
                        stacklevel=3
                    )
            
            # Handle strike actions
            if strike == 1:
                warnings.warn(
                    f"OpenJCK Guard WARNING [{guard_type}]: {event.detail}. Strike 1/2.",
                    stacklevel=3
                )
                # Send cloud event for tracking
                self._sender.enqueue({
                    "event": "session.flag",
                    "flag_type": "guard_warning",
                    "session_id": self.session_id,
                    "guard_type": guard_type,
                    "strike": 1
                })
            elif strike >= 2:
                warnings.warn(
                    f"OpenJCK Guard TERMINATING [{guard_type}]: {event.detail}. Strike 2.",
                    stacklevel=3
                )
                # Close session with terminated status
                self.close(status="terminated", error=event.detail)
                # Raise exception to halt execution
                raise GuardTriggered(event)
        
        return guard_events
    
    def _write_step_to_disk(self, step_event: Dict[str, Any]) -> None:
        """Write step packet to disk in the session directory.
        
        Uses zero-padded filename: step_0001.json, step_0002.json, etc.
        """
        if self._storage_path is None:
            return
        step_num = step_event.get('event', {}).get('step_number', 0)
        filename = f"step_{step_num:04d}.json"
        path = self._storage_path / filename
        try:
            with open(path, 'w') as f:
                json.dump(step_event, f, indent=2)
        except Exception as e:
            print(f"[openjck] Failed to write step file {path}: {e}")
    
    def __enter__(self) -> 'ClawSession':
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if exc_val:
            self.close(status="failed", error=str(exc_val))
        else:
            self.close(status="completed")
        return False  # Never suppress exceptions
    
    # Expose some state as properties for dashboard integration
    @property
    def status(self) -> str:
        """Current session status (derived from internal state)."""
        if getattr(self, '_terminated', False):
            return 'terminated'
        return 'running'  # For simplicity; could track more precisely
    
    @property
    def total_cost_usd(self) -> float:
        return self._total_cost_usd
    
    @property
    def steps(self) -> int:
        return self._step_count
    
    @property
    def tool_calls(self) -> int:
        return self._tool_call_count
    
    @property
    def input_tokens(self) -> int:
        return self._input_tokens
    
    @property
    def output_tokens(self) -> int:
        return self._output_tokens


# Convenience: direct instantiation with environment
def create_session(**kwargs) -> ClawSession:
    """Create a ClawSession using environment configuration.
    
    This is a shortcut for `ClawSession()` that reads provider settings from env.
    """
    return ClawSession(**kwargs)


# Exports
__all__ = [
    'ClawSession',
    'create_session',
    'AnthropicProvider',  # for advanced users
    'LLMProvider',
    'get_provider',
    'get_pricing_registry',
]
