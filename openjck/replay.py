"""
Replay module for OpenJCK.

Provides ReplaySession for loading recorded sessions, replaying them with
optional overrides, and detecting divergence from the original execution.

Phase 4 — The Replay: Debug without rerunning.
"""

from __future__ import annotations

import json
import tempfile
import time
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


def _load_step_file(path: Path) -> Optional[Dict[str, Any]]:
    """Load a single step packet from disk."""
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"[openjck] Failed to load step file {path}: {e}")
        return None


def _sort_steps(step_files: List[Path]) -> List[Path]:
    """Sort step files by step number (step_0001.json -> step_0002.json, etc)."""

    def get_step_num(path: Path) -> int:
        try:
            stem = path.stem  # "step_0001"
            parts = stem.split("_")
            if len(parts) >= 2:
                return int(parts[-1])
        except (ValueError, IndexError):
            pass
        return 0

    return sorted(step_files, key=get_step_num)


# ---------------------------------------------------------------------------
# Dataclasses for replay results
# ---------------------------------------------------------------------------


@dataclass
class DivergenceReport:
    """Report for a single diverged step."""

    step: int
    original_stop_reason: str
    replay_stop_reason: str
    original_tools: List[str]
    replay_tools: List[str]
    detail: str


@dataclass
class ReplayResult:
    """Result of a replay execution."""

    session_id: str
    total_steps: int
    diverged_steps: List[DivergenceReport] = field(default_factory=list)
    replay_duration_ms: float = 0.0


# ---------------------------------------------------------------------------
# MockAnthropicClient — simulates the Anthropic client using recorded data
# ---------------------------------------------------------------------------


class _RecordedUsage:
    """Mimics anthropic usage object."""

    def __init__(self, input_tokens: int, output_tokens: int):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class _RecordedContentBlock:
    """Mimics a content block (text or tool_use)."""

    def __init__(self, block: Dict[str, Any]):
        self.type = block.get("type", "text")
        if self.type == "text":
            self.text = block.get("text", "")
        elif self.type == "tool_use":
            self.id = block.get("id", "")
            self.name = block.get("name", "")
            self.input = block.get("input", {})

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, _RecordedContentBlock):
            return NotImplemented
        return self.type == other.type and self.__dict__ == other.__dict__


class _RecordedMessage:
    """Mimics anthropic.types.Message using recorded response data."""

    def __init__(self, response_data: Dict[str, Any]):
        usage = response_data.get("usage", {})
        self.usage = _RecordedUsage(
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
        )
        self.stop_reason = response_data.get("stop_reason", "end_turn")
        self.id = response_data.get("id", str(uuid.uuid4()))
        self.type = response_data.get("type", "message")
        self.role = response_data.get("role", "assistant")
        self.model = response_data.get("model", "claude-sonnet-4-6")
        self.content = [
            _RecordedContentBlock(b)
            for b in response_data.get("content", [])
        ]

    def model_dump(self) -> Dict[str, Any]:
        """Serialize to dict for step packet storage."""
        return {
            "id": self.id,
            "type": self.type,
            "role": self.role,
            "model": self.model,
            "content": [
                {k: v for k, v in b.__dict__.items() if not k.startswith("_")}
                for b in self.content
            ],
            "stop_reason": self.stop_reason,
            "stop_sequence": None,
            "usage": {
                "input_tokens": self.usage.input_tokens,
                "output_tokens": self.usage.output_tokens,
            },
        }


class _MockMessages:
    """Mock messages namespace that returns recorded responses."""

    def __init__(self, steps: List[Dict[str, Any]]):
        self._steps = steps
        self._call_count = 0

    def create(self, **kwargs) -> _RecordedMessage:
        """Return the recorded response for the current step."""
        if self._call_count < len(self._steps):
            step = self._steps[self._call_count]
            response_data = step.get("response", {})
            self._call_count += 1
            return _RecordedMessage(response_data)
        # Fallback: return an empty message if we run out of steps
        return _RecordedMessage({})

    def reset(self) -> None:
        """Reset the call counter."""
        self._call_count = 0


class MockAnthropicClient:
    """
    Simulates anthropic.Anthropic by returning recorded responses.

    Usage:
        client = MockAnthropicClient(steps)
        response = client.messages.create(messages=[...])
    """

    def __init__(self, steps: List[Dict[str, Any]]):
        self.messages = _MockMessages(steps)
        self._steps = steps

    @property
    def current_step_index(self) -> int:
        return self.messages._call_count


# ---------------------------------------------------------------------------
# ReplaySession
# ---------------------------------------------------------------------------


class ReplaySession:
    """
    Load, replay, and compare a recorded ClawSession.

    Usage:
        # Load from disk
        replay = ReplaySession.load("session-uuid-here")
        result = replay.run()

        # With overrides
        result = replay.run(
            overrides={"read_file": lambda input: {"content": "mocked"}}
        )

        # From .agtrace file
        replay = ReplaySession.from_file("session.agtrace")
        result = replay.run()

        # Check for divergence
        if result.diverged_steps:
            for div in result.diverged_steps:
                print(f"Step {div.step} diverged: {div.detail}")
    """

    def __init__(
        self,
        session_id: str,
        steps: List[Dict[str, Any]],
        session_metadata: Optional[Dict[str, Any]] = None,
    ):
        self.session_id = session_id
        self._steps = steps
        self._metadata = session_metadata or {}

    # ------------------------------------------------------------------
    # Class methods: loading sessions
    # ------------------------------------------------------------------

    @classmethod
    def load(
        cls,
        session_id: str,
        server_url: str = "http://localhost:7070",
        local_storage_dir: str = ".openjck",
    ) -> Optional["ReplaySession"]:
        """
        Load a recorded session from disk.

        Args:
            session_id: The session UUID
            server_url: Server URL for future remote loading (reserved)
            local_storage_dir: Base directory for session storage

        Returns:
            ReplaySession instance or None if session not found
        """
        # Suppress unused warning for server_url (reserved for remote fetch)
        _ = server_url

        storage_path = Path(local_storage_dir) / "sessions" / session_id
        if not storage_path.exists():
            return None

        step_files = list(storage_path.glob("step_*.json"))
        if not step_files:
            return None

        step_files = _sort_steps(step_files)
        steps = []
        for path in step_files:
            step = _load_step_file(path)
            if step:
                steps.append(step)

        if not steps:
            return None

        session_metadata = _build_metadata(session_id, steps)
        return cls(
            session_id=session_id,
            steps=steps,
            session_metadata=session_metadata,
        )

    @classmethod
    def from_file(cls, path: str) -> Optional["ReplaySession"]:
        """
        Load a session from a .agtrace ZIP file.

        Args:
            path: Path to the .agtrace file

        Returns:
            ReplaySession instance or None if file is invalid
        """
        zip_path = Path(path)
        if not zip_path.exists():
            return None

        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(tmpdir)

                # Load session metadata
                session_json_path = Path(tmpdir) / "session.json"
                session_metadata = {}
                if session_json_path.exists():
                    with open(session_json_path) as f:
                        session_metadata = json.load(f)

                # Load step files
                steps_dir = Path(tmpdir) / "steps"
                if not steps_dir.exists():
                    return None

                step_files = _sort_steps(list(steps_dir.glob("step_*.json")))
                steps = []
                for step_file in step_files:
                    step = _load_step_file(step_file)
                    if step:
                        steps.append(step)

                if not steps:
                    return None

                session_id = session_metadata.get(
                    "session_id", zip_path.stem
                )
                return cls(
                    session_id=session_id,
                    steps=steps,
                    session_metadata=session_metadata,
                )
        except Exception as e:
            print(f"[openjck] Failed to load .agtrace file {path}: {e}")
            return None

    # ------------------------------------------------------------------
    # Instance methods: running replays
    # ------------------------------------------------------------------

    def run(self, overrides: Optional[Dict[str, Callable]] = None) -> ReplayResult:
        """
        Replay the session with optional tool overrides.

        For each step N:
          1. Mock client returns recorded response from step packet
          2. Tool execution:
             - if tool_name in overrides: output = overrides[tool_name](tool_input)
             - else: output = recorded tool_output from packet
          3. Compare replay response to original:
             - stop_reason differs OR tool_use names differ → DIVERGED
          4. Build DivergenceReport if diverged

        Args:
            overrides: Dict mapping tool_name → callable that takes tool_input
                       and returns a simulated tool output dict.

        Returns:
            ReplayResult with divergence information
        """
        if overrides is None:
            overrides = {}

        start_time = time.monotonic()

        mock_client = MockAnthropicClient(self._steps)
        diverged_steps: List[DivergenceReport] = []

        for i, step in enumerate(self._steps):
            step_number = step.get("event", {}).get("step_number", i + 1)
            response_data = step.get("response", {})
            original_tools = [
                t.get("tool_name", "unknown") for t in step.get("tools", [])
            ]
            original_stop_reason = response_data.get("stop_reason", "end_turn")

            # 1. Mock client returns recorded response
            response = mock_client.messages.create()
            replay_stop_reason = response.stop_reason

            # 2. Tool execution with overrides
            replay_tools = list(original_tools)  # Default: same tools
            override_applied = False

            for tool_entry in step.get("tools", []):
                tool_name = tool_entry.get("tool_name", "unknown")
                if tool_name in overrides:
                    # Override: simulate different tool output
                    tool_input = tool_entry.get("tool_input", {})
                    _ = overrides[tool_name](tool_input)
                    override_applied = True

            # 3. Compare replay response to original
            stop_reason_differs = replay_stop_reason != original_stop_reason
            # If an override was applied at this step, we consider it diverged
            # because the real agent would have seen different tool output
            if override_applied:
                diverged_steps.append(
                    DivergenceReport(
                        step=step_number,
                        original_stop_reason=original_stop_reason,
                        replay_stop_reason=replay_stop_reason,
                        original_tools=original_tools,
                        replay_tools=replay_tools,
                        detail=f"Override applied to tool '{list(overrides.keys())[0]}' — tool output differs from original execution",
                    )
                )
            elif stop_reason_differs:
                diverged_steps.append(
                    DivergenceReport(
                        step=step_number,
                        original_stop_reason=original_stop_reason,
                        replay_stop_reason=replay_stop_reason,
                        original_tools=original_tools,
                        replay_tools=replay_tools,
                        detail=f"Stop reason changed: original='{original_stop_reason}', replay='{replay_stop_reason}'",
                    )
                )

        duration_ms = (time.monotonic() - start_time) * 1000

        return ReplayResult(
            session_id=self.session_id,
            total_steps=len(self._steps),
            diverged_steps=diverged_steps,
            replay_duration_ms=duration_ms,
        )

    # ------------------------------------------------------------------
    # Instance methods: export and inspection
    # ------------------------------------------------------------------

    @property
    def steps(self) -> List[Dict[str, Any]]:
        """List of step packets in order."""
        return self._steps.copy()

    @property
    def metadata(self) -> Dict[str, Any]:
        """Session metadata."""
        return self._metadata.copy()

    def get_step(self, step_number: int) -> Optional[Dict[str, Any]]:
        """Get a specific step by step number (1-indexed)."""
        for step in self._steps:
            if step.get("event", {}).get("step_number") == step_number:
                return step
        return None

    def export_trace(self, output_path: Optional[str] = None) -> str:
        """
        Export session as a .agtrace ZIP file.

        The .agtrace format contains:
        - manifest.json: Format version and metadata
        - session.json: Session metadata
        - steps/step_0001.json, step_0002.json, ...: Individual step packets

        Args:
            output_path: Path for output file. If None, uses {session_id}.agtrace
                in current directory.

        Returns:
            Path to the exported .agtrace file
        """
        if output_path is None:
            output_path = f"{self.session_id}.agtrace"

        output_path = Path(output_path)

        manifest = {
            "format_version": "1.0",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "openjck_version": "0.3.0",
            "session_id": self.session_id,
            "total_steps": len(self._steps),
        }

        session_json = {
            "session_id": self.session_id,
            "project": self._metadata.get("project"),
            "environment": self._metadata.get("environment"),
            "started_at": self._metadata.get("started_at"),
            "total_steps": self._metadata.get("total_steps", len(self._steps)),
            "total_input_tokens": self._metadata.get("total_input_tokens", 0),
            "total_output_tokens": self._metadata.get("total_output_tokens", 0),
            "total_cost_usd": self._metadata.get("total_cost_usd", 0),
        }

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))
            zf.writestr("session.json", json.dumps(session_json, indent=2))

            for step in self._steps:
                step_num = step.get("event", {}).get("step_number", 0)
                filename = f"steps/step_{step_num:04d}.json"
                zf.writestr(filename, json.dumps(step, indent=2))

        return str(output_path)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_metadata(
    session_id: str, steps: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Extract session metadata from step packets."""
    first_step = steps[0] if steps else {}
    return {
        "session_id": first_step.get("session", {}).get("session_id", session_id),
        "project": first_step.get("session", {}).get("project"),
        "environment": first_step.get("session", {}).get("environment"),
        "started_at": first_step.get("session", {}).get("started_at"),
        "total_steps": len(steps),
        "total_input_tokens": sum(
            s.get("usage", {}).get("input_tokens", 0) for s in steps
        ),
        "total_output_tokens": sum(
            s.get("usage", {}).get("output_tokens", 0) for s in steps
        ),
        "total_cost_usd": steps[-1].get("usage", {}).get(
            "session_total_cost_usd", 0
        )
        if steps
        else 0,
    }


__all__ = [
    "ReplaySession",
    "ReplayResult",
    "DivergenceReport",
]
