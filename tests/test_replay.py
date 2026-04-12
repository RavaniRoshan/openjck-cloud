"""
Tests for OpenJCK ReplaySession.

Verification checklist:
1. 5-step recorded session → ReplaySession.load() → run() → 0 diverged_steps
2. run(overrides={"read_file": lambda x: {"content": "mocked"}}) → divergence at that step
3. from_file("session.agtrace") → same result as load()
4. ReplayResult.diverged_steps[0] has correct step number and tools
"""

import json
import zipfile
from pathlib import Path

import pytest

from openjck import ClawSession, ReplaySession, ReplayResult, DivergenceReport
from tests.conftest import FakeAnthropic, FakeMessage, FakeToolUse


class TestReplaySessionLoad:
    """Test ReplaySession.load() functionality."""

    def test_load_five_step_session_no_divergence(self, tmp_path):
        """5-step recorded session → ReplaySession.load() → run() → 0 diverged_steps."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=12, output_tokens=6),
            FakeMessage(input_tokens=15, output_tokens=7),
            FakeMessage(input_tokens=18, output_tokens=8),
            FakeMessage(input_tokens=20, output_tokens=10),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )

        for i in range(5):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i + 1}"}],
                max_tokens=100,
            )
        session.close()

        # Load via ReplaySession
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay is not None
        assert len(replay.steps) == 5

        # Run replay — should have 0 diverged steps
        result = replay.run()
        assert isinstance(result, ReplayResult)
        assert result.session_id == session.session_id
        assert result.total_steps == 5
        assert len(result.diverged_steps) == 0
        assert result.replay_duration_ms >= 0

    def test_load_single_step_no_divergence(self, tmp_path):
        """Single step session → run() → 0 diverged_steps."""
        responses = [FakeMessage(input_tokens=10, output_tokens=5)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100,
        )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay is not None

        result = replay.run()
        assert result.total_steps == 1
        assert len(result.diverged_steps) == 0

    def test_load_nonexistent_session_returns_none(self, tmp_path):
        """Loading a session that doesn't exist returns None."""
        replay = ReplaySession.load("nonexistent-uuid", local_storage_dir=str(tmp_path))
        assert replay is None


class TestReplaySessionRunWithOverrides:
    """Test ReplaySession.run() with tool overrides."""

    def test_override_causes_divergence_at_tool_step(self, tmp_path):
        """run(overrides={"read_file": lambda x: {"content": "mocked"}}) → divergence at that step."""
        # Create a session with tool use
        tool_input = {"path": "/test/file.py"}
        responses = [
            FakeMessage(
                input_tokens=10,
                output_tokens=5,
                content=[FakeToolUse("read_file", tool_input)],
            ),
            FakeMessage(input_tokens=12, output_tokens=6),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )

        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "read the file"}],
            max_tokens=100,
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "continue"}],
            max_tokens=100,
        )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay is not None

        # Run with override on read_file
        call_log = []
        result = replay.run(
            overrides={"read_file": lambda x: call_log.append(x) or {"content": "mocked"}}
        )

        assert len(result.diverged_steps) == 1
        div = result.diverged_steps[0]
        assert isinstance(div, DivergenceReport)
        assert div.step == 1
        assert "read_file" in div.original_tools
        assert "Override applied" in div.detail

        # Override callback was called
        assert len(call_log) == 1
        assert call_log[0] == tool_input

    def test_override_on_unused_tool_no_divergence(self, tmp_path):
        """Override a tool that wasn't used → no divergence."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=12, output_tokens=6),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )

        for i in range(2):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i + 1}"}],
                max_tokens=100,
            )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        result = replay.run(overrides={"unused_tool": lambda x: {"content": "mocked"}})

        # No tool was used, so override never triggers → no divergence
        assert len(result.diverged_steps) == 0

    def test_multiple_overrides_divergence_at_each_used_step(self, tmp_path):
        """Multiple overrides → divergence at each step where overridden tool is used."""
        tool_input_1 = {"path": "/file1.py"}
        tool_input_2 = {"path": "/file2.py"}
        responses = [
            FakeMessage(
                input_tokens=10, output_tokens=5,
                content=[FakeToolUse("read_file", tool_input_1)],
            ),
            FakeMessage(
                input_tokens=12, output_tokens=6,
                content=[FakeToolUse("write_file", {"path": "/out.py"})],
            ),
            FakeMessage(
                input_tokens=15, output_tokens=7,
                content=[FakeToolUse("read_file", tool_input_2)],
            ),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )

        for i in range(3):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i + 1}"}],
                max_tokens=100,
            )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))

        # Override only read_file → should diverge at steps 1 and 3 (not 2)
        result = replay.run(
            overrides={"read_file": lambda x: {"content": "mocked"}}
        )

        assert len(result.diverged_steps) == 2
        assert result.diverged_steps[0].step == 1
        assert result.diverged_steps[1].step == 3

    def test_divergence_report_has_correct_tools(self, tmp_path):
        """ReplayResult.diverged_steps[0] has correct step number and tools."""
        tool_input = {"path": "/test/app.py"}
        responses = [
            FakeMessage(
                input_tokens=10, output_tokens=5,
                content=[
                    FakeToolUse("read_file", tool_input),
                    FakeToolUse("run_command", {"cmd": "ls"}),
                ],
            ),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "do stuff"}],
            max_tokens=100,
        )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        result = replay.run(overrides={"read_file": lambda x: {"content": "mocked"}})

        assert len(result.diverged_steps) == 1
        report = result.diverged_steps[0]
        assert report.step == 1
        assert "read_file" in report.original_tools
        assert "run_command" in report.original_tools
        assert report.original_tools == ["read_file", "run_command"]
        assert report.replay_tools == ["read_file", "run_command"]
        assert report.original_stop_reason == report.replay_stop_reason  # stop_reason same, divergence due to override


class TestReplaySessionFromFile:
    """Test ReplaySession.from_file() functionality."""

    def test_from_file_matches_load(self, tmp_path):
        """from_file("session.agtrace") → same result as load()."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=20, output_tokens=10),
            FakeMessage(input_tokens=30, output_tokens=15),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )

        for i in range(3):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i + 1}"}],
                max_tokens=100,
            )
        session.close()

        # Load from disk
        replay_disk = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay_disk is not None

        # Export to .agtrace
        agtrace_path = tmp_path / "export.agtrace"
        replay_disk.export_trace(str(agtrace_path))

        # Load from .agtrace
        replay_file = ReplaySession.from_file(str(agtrace_path))
        assert replay_file is not None

        # Both should have same session_id and step count
        assert replay_file.session_id == replay_disk.session_id
        assert len(replay_file.steps) == len(replay_disk.steps)

        # Step content should be identical
        for i, (step_file, step_disk) in enumerate(zip(replay_file.steps, replay_disk.steps)):
            assert step_file["event"]["step_number"] == step_disk["event"]["step_number"]
            assert step_file["usage"]["input_tokens"] == step_disk["usage"]["input_tokens"]
            assert step_file["usage"]["output_tokens"] == step_disk["usage"]["output_tokens"]

        # Running replay should produce same results
        result_file = replay_file.run()
        result_disk = replay_disk.run()
        assert result_file.total_steps == result_disk.total_steps
        assert len(result_file.diverged_steps) == len(result_disk.diverged_steps)

    def test_from_file_nonexistent_returns_none(self):
        """from_file with non-existent path returns None."""
        result = ReplaySession.from_file("/nonexistent/path.agtrace")
        assert result is None

    def test_from_file_invalid_zip_returns_none(self, tmp_path):
        """from_file with a non-ZIP file returns None."""
        bad_file = tmp_path / "not_a_zip.agtrace"
        bad_file.write_text("this is not a zip file")

        result = ReplaySession.from_file(str(bad_file))
        assert result is None

    def test_from_file_zip_without_steps_returns_none(self, tmp_path):
        """from_file with ZIP that has no steps/ directory returns None."""
        zip_path = tmp_path / "empty.agtrace"
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.writestr("session.json", json.dumps({"session_id": "test"}))

        result = ReplaySession.from_file(str(zip_path))
        assert result is None


class TestReplayResultDataclass:
    """Test ReplayResult and DivergenceReport dataclasses."""

    def test_replay_result_defaults(self):
        result = ReplayResult(session_id="test", total_steps=5)
        assert result.session_id == "test"
        assert result.total_steps == 5
        assert result.diverged_steps == []
        assert result.replay_duration_ms == 0.0

    def test_divergence_report_fields(self):
        report = DivergenceReport(
            step=3,
            original_stop_reason="end_turn",
            replay_stop_reason="tool_use",
            original_tools=["read_file", "write_file"],
            replay_tools=["read_file", "write_file"],
            detail="Stop reason changed",
        )
        assert report.step == 3
        assert report.original_stop_reason == "end_turn"
        assert report.replay_stop_reason == "tool_use"
        assert report.original_tools == ["read_file", "write_file"]
        assert report.replay_tools == ["read_file", "write_file"]
        assert report.detail == "Stop reason changed"


class TestReplaySessionEdgeCases:
    """Test edge cases and error handling."""

    def test_run_empty_steps(self):
        """ReplaySession with no steps → ReplayResult with 0 total_steps."""
        replay = ReplaySession(session_id="empty", steps=[])
        result = replay.run()
        assert result.total_steps == 0
        assert len(result.diverged_steps) == 0

    def test_run_empty_overrides_dict(self, tmp_path):
        """run(overrides={}) same as run() → 0 diverged_steps."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=12, output_tokens=6),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )
        for i in range(2):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i + 1}"}],
                max_tokens=100,
            )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))

        result_no_overrides = replay.run()
        result_empty_overrides = replay.run(overrides={})

        assert len(result_no_overrides.diverged_steps) == 0
        assert len(result_empty_overrides.diverged_steps) == 0

    def test_replay_duration_ms_is_positive(self, tmp_path):
        """replay_duration_ms should be >= 0."""
        responses = [FakeMessage(input_tokens=10, output_tokens=5)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"

        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage),
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100,
        )
        session.close()

        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        result = replay.run()
        assert result.replay_duration_ms >= 0
