import json
import queue
import threading
import time
import uuid
import warnings
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional, Dict, List
from urllib.request import Request, urlopen
from urllib.error import URLError

import anthropic
from .alerts import Alert, SessionEndEvent
from .guard import GuardConfig, GuardTriggered, GuardEvent
from .loop_detector import LoopDetector, LoopDetectionResult


def deep_copy_messages(messages: List[Dict]) -> List[Dict]:
    """Deep copy messages array, handling Anthropic SDK types."""
    result = []
    for msg in messages:
        copied = dict(msg)
        # Handle content blocks that might be dicts or SDK types
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
    """Serialize Anthropic response for step packet."""
    if hasattr(response, 'model_dump'):
        return response.model_dump()
    # Fallback for older SDK versions
    return {
        'id': getattr(response, 'id', None),
        'type': getattr(response, 'type', 'message'),
        'role': getattr(response, 'role', 'assistant'),
        'model': getattr(response, 'model', None),
        'content': [
            dict(block) if hasattr(block, '__dict__') else block
            for block in getattr(response, 'content', [])
        ],
        'stop_reason': getattr(response, 'stop_reason', None),
        'stop_sequence': getattr(response, 'stop_sequence', None),
        'usage': {
            'input_tokens': getattr(response.usage, 'input_tokens', 0),
            'output_tokens': getattr(response.usage, 'output_tokens', 0),
        } if hasattr(response, 'usage') else {'input_tokens': 0, 'output_tokens': 0},
    }


def extract_tool_results(messages: List[Dict]) -> Dict[str, Dict]:
    """Extract tool_result blocks from messages array.
    
    Tool outputs from the prior step appear as tool_result blocks in the
    current step's messages array. Returns a map of {tool_use_id: tool_output}.
    """
    tool_results = {}
    for msg in messages:
        if isinstance(msg, dict) and msg.get('role') == 'user':
            content = msg.get('content', [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get('type') == 'tool_result':
                        tool_use_id = block.get('tool_use_id')
                        if tool_use_id:
                            tool_results[tool_use_id] = {
                                'content': block.get('content', ''),
                                'is_error': block.get('is_error', False),
                            }
    return tool_results

# Hardcoded pricing map from master truth
PRICING_MAP = {
    "claude-opus-4": {"input_per_million": 15.00, "output_per_million": 75.00},
    "claude-sonnet-4": {"input_per_million": 3.00, "output_per_million": 15.00},
    "claude-haiku-4-5": {"input_per_million": 0.80, "output_per_million": 4.00},
}

SENTINEL = object()


class BackgroundSender:
    """Background thread that sends events to OpenJCK cloud or writes to fallback."""
    
    def __init__(self, endpoint: str, api_key: Optional[str], timeout: float, maxsize: int):
        self._endpoint = endpoint
        self._api_key = api_key
        self._timeout = timeout
        self._queue = queue.Queue(maxsize=maxsize)
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()
    
    def enqueue(self, path: str, payload: Dict[str, Any]) -> None:
        """Enqueue an event for sending. Non-blocking, logs warning if full."""
        try:
            self._queue.put_nowait((path, payload))
        except queue.Full:
            print(f"[openjck] Warning: event queue full, dropping event for {path}")
    
    def _worker(self) -> None:
        """Worker thread: pull from queue and POST to server, fallback to disk on failure."""
        while True:
            try:
                item = self._queue.get(timeout=0.25)
                if item is SENTINEL:
                    break
                
                path, payload = item
                url = f"{self._endpoint}{path}"
                
                try:
                    data = json.dumps(payload).encode("utf-8")
                    req = Request(
                        url,
                        data=data,
                        headers={
                            "Content-Type": "application/json",
                            "User-Agent": "openjck-python-sdk/0.3.0"
                        },
                        method="POST"
                    )
                    if self._api_key:
                        req.add_header("Authorization", f"Bearer {self._api_key}")
                    
                    with urlopen(req, timeout=int(self._timeout)) as resp:
                        if resp.status >= 400:
                            raise URLError(f"HTTP {resp.status}")
                except Exception as e:
                    # Write to fallback file
                    fallback_path = Path(".openjck-fallback.jsonl")
                    fallback_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(fallback_path, "a") as f:
                        f.write(json.dumps({
                            "timestamp": datetime.utcnow().isoformat(),
                            "endpoint": path,
                            "payload": payload,
                            "error": str(e)
                        }) + "\n")
            except queue.Empty:
                continue
            except Exception as e:
                # Unexpected worker error - log and continue
                print(f"[openjck] BackgroundSender error: {e}")
    
    def flush_and_stop(self) -> None:
        """Enqueue sentinel to stop worker and wait for thread to finish."""
        self._queue.put(SENTINEL)
        self._thread.join(timeout=5.0)


class ClawProxy:
    """Transparent wrapper around anthropic.Anthropic that intercepts messages.create."""
    
    def __init__(self, session: 'ClawSession', client: anthropic.Anthropic):
        self._session = session
        self._client = client
    
    def __getattr__(self, name: str) -> Any:
        """Delegate all attributes to the underlying client."""
        return getattr(self._client, name)
    
    @property
    def messages(self):
        """Return a proxy for the messages namespace."""
        return _MessagesProxy(self._session, self._client.messages)


class _MessagesProxy:
    """Proxy for messages.create method with deferred write for tool output capture."""
    
    def __init__(self, session: 'ClawSession', messages_client: Any):
        self._session = session
        self._client = messages_client
    
    def create(self, **kwargs) -> anthropic.types.Message:
        """Intercept messages.create, track usage, capture inputs/response, and defer step writing."""
        step_start_time = time.time()
        
        # 1. BEFORE API CALL: Capture full messages array (deep copy for serialization)
        input_messages = deep_copy_messages(kwargs.get('messages', []))
        
        # 2. EXTRACT TOOL RESULTS from current messages array
        #    These are outputs from the PRIOR step's tool calls
        tool_results_map = extract_tool_results(kwargs.get('messages', []))
        
        # 3. PATCH PRIOR STEP with tool outputs and WRITE to disk
        if self._session._pending_step_packet is not None:
            prior_packet = self._session._pending_step_packet
            
            # Match tool_use_id in prior step's tools with tool_results
            for tool_entry in prior_packet.get('tools', []):
                tool_use_id = tool_entry.get('tool_use_id')
                if tool_use_id and tool_use_id in tool_results_map:
                    tool_entry['tool_output'] = tool_results_map[tool_use_id]
            
            # Write prior step (now complete with tool outputs) to disk
            if self._session.record:
                self._session._write_step_to_disk(prior_packet)
        
        # 4. CALL THE ACTUAL API
        response = self._client.create(**kwargs)
        
        # 5. EXTRACT USAGE and MODEL
        input_tokens = getattr(response.usage, 'input_tokens', 0)
        output_tokens = getattr(response.usage, 'output_tokens', 0)
        model = kwargs.get('model', 'claude-sonnet-4')
        
        # 6. CALCULATE COST
        pricing = PRICING_MAP.get(model, PRICING_MAP["claude-sonnet-4"])
        step_cost = (
            input_tokens / 1_000_000 * pricing["input_per_million"] +
            output_tokens / 1_000_000 * pricing["output_per_million"]
        )
        
        # 7. UPDATE SESSION COUNTERS
        self._session._input_tokens += input_tokens
        self._session._output_tokens += output_tokens
        self._session._total_cost_usd += step_cost
        self._session._step_count += 1
        
        # 8. EXTRACT TOOL USES from response
        tool_uses = [b for b in response.content if getattr(b, 'type', None) == 'tool_use']
        self._session._tool_call_count += len(tool_uses)
        
        # 9. CHECK GUARDS
        guard_events = []
        if self._session.guard:
            guard_events = self._session._check_guards(step_cost)
        
        # 10. LOOP DETECTION
        loop_detected = False
        loop_result = None
        if self._session.guard and self._session.guard.loop_detection:
            loop_result = self._session._loop_detector.check(tool_uses)
            loop_detected = loop_result.detected
            if loop_detected and not self._session.loop_detected:
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
        
        # 11. BUILD STEP EVENT with full capture
        duration_ms = (time.time() - step_start_time) * 1000
        step_number = self._session._step_count
        event_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + "Z"
        
        # Prepare tool info with tool_use_id for matching with tool_results
        tools_info = []
        for tool_use in tool_uses:
            tool_input = getattr(tool_use, 'input', {})
            fingerprint = self._session._loop_detector.hash_input(tool_input)
            # Capture tool_use_id for later matching with tool_result
            tool_use_id = getattr(tool_use, 'id', None)
            tool_entry = {
                "tool_name": getattr(tool_use, 'name', 'unknown'),
                "tool_input": tool_input,
                "fingerprint": fingerprint,
                "tool_use_id": tool_use_id,
                "tool_output": None  # Will be patched when next step starts
            }
            tools_info.append(tool_entry)
        
        # Build session totals
        session_total_input = self._session._input_tokens
        session_total_output = self._session._output_tokens
        session_total_cost = self._session._total_cost_usd
        
        # Serialize response for step packet
        response_data = serialize_response(response)
        
        step_event = {
            "schema_version": "1.0",
            "sdk": {
                "name": "openjck",
                "version": "0.3.0",
                "language": "python",
                "mode": self._session.mode
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
                "model": model,
                "messages_count": len(kwargs.get('messages', [])),
                "max_tokens": kwargs.get('max_tokens')
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
                "loop_detected": loop_detected
            },
            "error": None,
            "recording": {
                "record": self._session.record,
                "trace_path": None
            },
            "input_messages": input_messages,
            "response": response_data
        }
        
        # 12. SET TRACE PATH if recording
        if self._session.record:
            filename = f"step_{step_number:04d}.json"  # Zero-padded to 4 digits
            path = self._session._storage_path / filename
            step_event["recording"]["trace_path"] = str(path)
        
        # 13. STORE AS PENDING (deferred write - will be written when next step starts)
        self._session._pending_step_packet = step_event
        
        # 14. POST EVENT TO SENDER (always sent immediately)
        self._session._sender.enqueue("/api/v1/events", step_event)
        
        return response


class ClawSession:
    """
    Main session class that wraps an Anthropic client and tracks all Claude API calls.
    
    Usage:
        session = ClawSession(client=anthropic.Anthropic(), api_key="...")
        response = session.client.messages.create(...)
    """
    
    def __init__(
        self,
        client: anthropic.Anthropic,
        api_key: Optional[str] = None,
        session_id: Optional[str] = None,
        project: Optional[str] = None,
        environment: str = "dev",
        guard: Optional[GuardConfig] = None,
        endpoint: Optional[str] = None,
        record: bool = True,
        local_storage_dir: str = ".openjck",
        pricing_map: Optional[dict] = None,
        request_timeout_seconds: float = 2.0,
        queue_maxsize: int = 1000,
        silent: bool = False
    ):
        self.client = ClawProxy(self, client)
        self.session_id = session_id or str(uuid.uuid4())
        self.mode = "cloud" if api_key else "local"
        self.project = project
        self.environment = environment
        self.guard = guard or GuardConfig()
        self.record = record
        self.local_storage_dir = local_storage_dir
        self.silent = silent
        self._started_at = datetime.utcnow()
        
        # Set endpoint
        if endpoint:
            self.endpoint = endpoint
        else:
            self.endpoint = "https://api.openjck.cloud" if self.mode == "cloud" else "http://localhost:7070"
        
        # Initialize counters
        self._step_count = 0
        self._input_tokens = 0
        self._output_tokens = 0
        self._total_cost_usd = 0.0
        self._tool_call_count = 0
        self._guard_strikes: Dict[str, int] = {}
        
        # Loop detection via standalone detector
        self._loop_detector = LoopDetector()
        self.loop_detected = False  # Public flag, read-only
        
        # Deferred write: pending step packet (written when next step starts or session closes)
        self._pending_step_packet: Optional[Dict[str, Any]] = None
        
        # Background sender
        self._sender = BackgroundSender(
            endpoint=self.endpoint,
            api_key=api_key,
            timeout=request_timeout_seconds,
            maxsize=queue_maxsize
        )
        
        # Recording directory setup
        if self.record:
            self._storage_path = Path(self.local_storage_dir) / "sessions" / self.session_id
            self._storage_path.mkdir(parents=True, exist_ok=True)
        
        # Post session start event
        self._post_session_start()
    
    def _post_session_start(self) -> None:
        """Post session.start event."""
        payload = {
            "schema_version": "1.0",
            "sdk": {
                "name": "openjck",
                "version": "0.3.0",
                "language": "python",
                "mode": self.mode
            },
            "session": {
                "session_id": self.session_id,
                "project": self.project,
                "environment": self.environment,
                "started_at": self._started_at.isoformat() + "Z"
            },
            "event": {
                "event_id": str(uuid.uuid4()),
                "event_type": "session.start",
                "timestamp": datetime.utcnow().isoformat() + "Z"
            },
            "guard": {
                "config": self.guard.__dict__ if self.guard else None
            }
        }
        self._sender.enqueue("/api/v1/events", payload)
    
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
            
            # Invoke callback if set
            if guard.on_guard_trigger:
                guard.on_guard_trigger(event)
            
            # Handle strike actions
            if strike == 1:
                warnings.warn(
                    f"OpenJCK Guard WARNING [{guard_type}]: {event.detail}. Strike 1/2.",
                    stacklevel=3
                )
                # Send cloud event for tracking
                self._sender.enqueue("/api/v1/events", {
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
    
    def close(self, status: str = "completed", error: Optional[str] = None) -> None:
        """Close the session, posting session.end event and stopping sender."""
        # 1. FLUSH PENDING STEP PACKET (final step, no next step to trigger write)
        if self.record and self._pending_step_packet is not None:
            self._write_step_to_disk(self._pending_step_packet)
            self._pending_step_packet = None
        
        # Fire session end alerts before posting event (guaranteed even if event fails)
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
        
        try:
            payload = {
                "schema_version": "1.0",
                "sdk": {
                    "name": "openjck",
                    "version": "0.3.0",
                    "language": "python",
                    "mode": self.mode
                },
                "session": {
                    "session_id": self.session_id,
                    "project": self.project,
                    "environment": self.environment,
                    "started_at": self._started_at.isoformat() + "Z",
                    "ended_at": datetime.utcnow().isoformat() + "Z"
                },
                "event": {
                    "event_id": str(uuid.uuid4()),
                    "event_type": "session.end",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                },
                "usage": {
                    "total_input_tokens": self._input_tokens,
                    "total_output_tokens": self._output_tokens,
                    "total_tool_calls": self._tool_call_count,
                    "total_cost_usd": round(self._total_cost_usd, 10),
                    "total_steps": self._step_count
                },
                "guard": {
                    "final_strikes": self._guard_strikes
                },
                "status": status,
                "failure_root_cause": error if status == "failed" else None
            }
            self._sender.enqueue("/api/v1/events", payload)
        finally:
            self._sender.flush_and_stop()
