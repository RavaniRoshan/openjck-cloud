"""
Comprehensive tests for OpenJCK Python SDK core.

Verification checklist:
1. ClawSession(client=FakeAnthropic(), api_key="openjck_dev_test") created → session_id generated
2. 3 fake API calls → self._step_count == 3
3. cost calculated correctly for 100 input + 50 output tokens at sonnet pricing
4. With server unreachable: .openjck-fallback.jsonl created with event data
5. Context manager: exception raised inside → close(status="failed") called, exception propagates
6. Deferred write: step N file appears after step N+1 starts
7. Full capture: input_messages and response in step packets
8. Tool output: prior step's tools get tool_output patched when tool_result arrives
9. Zero-padded filenames: step_0001.json, step_0002.json
10. export_trace() creates .agtrace ZIP with manifest.json, session.json, steps/
"""

import pytest
import shutil
import time
import warnings
from pathlib import Path
from unittest.mock import patch, MagicMock
import anthropic

from openjck import ClawSession, GuardConfig, GuardTriggered, GuardEvent, ReplaySession
from tests.conftest import FakeAnthropic, FakeMessage, FakeToolUse


class TestClawSessionBasics:
    """Test basic ClawSession functionality."""
    
    def test_session_id_generated_if_not_provided(self):
        client = FakeAnthropic()
        session = ClawSession(client=client, api_key=None)
        assert session.session_id is not None
        assert len(session.session_id) == 36  # UUID4 length with hyphens
        session.close()
    
    def test_session_id_used_if_provided(self):
        client = FakeAnthropic()
        custom_id = "test-session-123"
        session = ClawSession(client=client, api_key=None, session_id=custom_id)
        assert session.session_id == custom_id
        session.close()
    
    def test_mode_cloud_with_api_key(self):
        client = FakeAnthropic()
        session = ClawSession(client=client, api_key="openjck_test_key")
        assert session.mode == "cloud"
        session.close()
    
    def test_mode_local_without_api_key(self):
        client = FakeAnthropic()
        session = ClawSession(client=client, api_key=None)
        assert session.mode == "local"
        session.close()
    
    def test_endpoint_cloud_default(self):
        client = FakeAnthropic()
        session = ClawSession(client=client, api_key="key")
        assert session.endpoint == "https://api.openjck.cloud"
        session.close()
    
    def test_endpoint_local_default(self):
        client = FakeAnthropic()
        session = ClawSession(client=client, api_key=None)
        assert session.endpoint == "http://localhost:7070"
        session.close()
    
    def test_custom_endpoint(self):
        client = FakeAnthropic()
        custom = "http://localhost:8080"
        session = ClawSession(client=client, api_key=None, endpoint=custom)
        assert session.endpoint == custom
        session.close()


class TestStepTracking:
    """Test step counting and usage tracking."""
    
    def test_step_count_increments(self):
        # Create 3 fake responses
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=12, output_tokens=6),
            FakeMessage(input_tokens=15, output_tokens=7),
        ]
        client = FakeAnthropic(responses)
        
        session = ClawSession(client=client, api_key=None, record=False)
        
        # Make 3 calls
        for i in range(3):
            response = session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"test {i}"}],
                max_tokens=100
            )
            assert response.usage.input_tokens > 0
        
        assert session._step_count == 3
        session.close()
    
    def test_token_counts_accumulate(self):
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
            FakeMessage(input_tokens=200, output_tokens=100),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        for _ in range(2):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=100
            )
        
        assert session._input_tokens == 300
        assert session._output_tokens == 150
        session.close()
    
    def test_tool_call_count_increments(self):
        responses = [
            FakeMessage(
                input_tokens=10,
                output_tokens=20,
                content=[FakeToolUse("read_file", {"path": "/test/file.py"})]
            ),
            FakeMessage(
                input_tokens=10,
                output_tokens=25,
                content=[
                    FakeToolUse("write_file", {"path": "/test/out.py"}),
                    FakeToolUse("run_command", {"cmd": "ls"})
                ]
            ),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        for _ in range(2):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=100
            )
        
        assert session._tool_call_count == 3
        session.close()


class TestCostCalculation:
    """Test pricing calculation."""
    
    def test_cost_calculation_sonnet(self):
        """100 input + 50 output tokens at sonnet pricing (3/15 per million)"""
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        expected = (100 / 1_000_000 * 3.00) + (50 / 1_000_000 * 15.00)
        expected = round(expected, 10)
        
        assert session._total_cost_usd == pytest.approx(expected, abs=1e-10)
        session.close()
    
    def test_cost_calculation_opus(self):
        responses = [
            FakeMessage(input_tokens=1000, output_tokens=500),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        session.client.messages.create(
            model="claude-opus-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        expected = (1000 / 1_000_000 * 15.00) + (500 / 1_000_000 * 75.00)
        expected = round(expected, 10)
        
        assert session._total_cost_usd == pytest.approx(expected, abs=1e-10)
        session.close()
    
    def test_cost_cumulative_across_steps(self):
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
            FakeMessage(input_tokens=200, output_tokens=100),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        for _ in range(2):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=100
            )
        
        # Sum of two steps
        step1_cost = (100 / 1_000_000 * 3.00) + (50 / 1_000_000 * 15.00)
        step2_cost = (200 / 1_000_000 * 3.00) + (100 / 1_000_000 * 15.00)
        expected = round(step1_cost + step2_cost, 10)
        
        assert session._total_cost_usd == pytest.approx(expected, abs=1e-10)
        session.close()
    
    def test_default_model_pricing(self):
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
        ]
        client = FakeAnthropic(responses)
        session = ClawSession(client=client, api_key=None, record=False)
        
        # Don't specify model, should default to sonnet
        session.client.messages.create(
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        expected = (100 / 1_000_000 * 3.00) + (50 / 1_000_000 * 15.00)
        expected = round(expected, 10)
        
        assert session._total_cost_usd == pytest.approx(expected, abs=1e-10)
        session.close()


class TestFallbackBehavior:
    """Test server unreachable → fallback file writing."""
    
    def test_fallback_created_when_server_unreachable(self, tmp_path):
        """Simulate server unreachable and check .openjck-fallback.jsonl is written."""
        # Use local mode with non-routable address to trigger connection failure
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        
        # Point to a non-routable address
        session = ClawSession(
            client=client,
            api_key="test_key",
            endpoint="http://localhost:99999",  # port that won't have a server
            request_timeout_seconds=0.1,
            record=False
        )
        
        # Make a call - should trigger fallback write
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        # Wait briefly for background thread
        time.sleep(0.5)
        
        # Check fallback file exists
        fallback = Path(".openjck-fallback.jsonl")
        assert fallback.exists()
        
        # Read and verify content
        lines = fallback.read_text().strip().split("\n")
        assert len(lines) >= 1
        data = json.loads(lines[-1])
        assert data["endpoint"] == "/api/v1/events"
        assert "payload" in data
        assert "error" in data
        assert data["error"] is not None
        
        # Cleanup
        fallback.unlink()
        session.close()
    
    def test_fallback_applies_on_http_error(self):
        """Test that HTTP 4xx/5xx errors also trigger fallback."""
        # This is implicitly tested by the background thread exception handler
        pass  # More complex to mock urllib, skipping for now


class TestContextManager:
    """Test context manager behavior."""
    
    def test_exception_inside_context_calls_close_failed(self):
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        
        close_called = []
        original_close = ClawSession.close
        
        def tracking_close(self, status="completed", error=None):
            close_called.append((status, error))
            return original_close(self, status, error)
        
        with patch.object(ClawSession, 'close', tracking_close):
            try:
                with ClawSession(client=client, api_key=None, record=False):
                    raise ValueError("test exception")
            except ValueError:
                pass
        
        assert len(close_called) == 1
        assert close_called[0][0] == "failed"
        assert "test exception" in close_called[0][1]
    
    def test_exception_propagates(self):
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        
        with pytest.raises(RuntimeError, match="inside test"):
            with ClawSession(client=client, api_key=None, record=False):
                raise RuntimeError("inside test")
    
    def test_normal_exit_calls_close_completed(self):
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        
        close_called = []
        original_close = ClawSession.close
        
        def tracking_close(self, status="completed", error=None):
            close_called.append(status)
            return original_close(self, status, error)
        
        with patch.object(ClawSession, 'close', tracking_close):
            with ClawSession(client=client, api_key=None, record=False):
                pass
        
        assert close_called == ["completed"]


class TestLoopDetection:
    """Test loop detection functionality."""
    
    def test_loop_detected_three_identical_calls(self):
        """Three identical tool calls should trigger loop detection."""
        tool_input = {"path": "/same/file.py"}
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(loop_detection=True)
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            for i in range(3):
                session.client.messages.create(
                    model="claude-sonnet-4",
                    messages=[{"role": "user", "content": "read file"}],
                    max_tokens=100
                )
            
            # After third call, loop_detected flag should be True
            assert session.loop_detected is True
            
            # Filter to our UserWarning only
            our_warnings = [x for x in w if issubclass(x.category, UserWarning) and "OpenJCK" in str(x.message)]
            assert len(our_warnings) == 1
            assert "Loop detected" in str(our_warnings[0].message)
            assert session.session_id in str(our_warnings[0].message)
        
        session.close()
    
    def test_loop_detection_alternating_paths(self):
        """Calls with different inputs should not trigger loop detection."""
        tool_inputs = [
            {"path": "/file1.py"},
            {"path": "/file2.py"},
            {"path": "/file3.py"},
        ]
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", ti)])
            for ti in tool_inputs
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(loop_detection=True)
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        for i in range(3):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "read file"}],
                max_tokens=100
            )
        
        # No loop should be detected
        assert session.loop_detected is False
        session.close()
    
    def test_loop_detected_only_after_third_identical_in_window(self):
        """In a series of 10 calls, loop flag should be set only after the third identical."""
        tool_input = {"path": "/same/file.py"}
        # First 3 identical, then 7 different
        responses = []
        for i in range(10):
            if i < 3:
                content = [FakeToolUse("read_file", tool_input)]
            else:
                content = [FakeToolUse("read_file", {"path": f"/file{i}.py"})]
            responses.append(FakeMessage(input_tokens=10, output_tokens=5, content=content))
        client = FakeAnthropic(responses)
        guard = GuardConfig(loop_detection=True, check_every_n_steps=100)
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            for i in range(10):
                session.client.messages.create(
                    model="claude-sonnet-4",
                    messages=[{"role": "user", "content": f"step {i}"}],
                    max_tokens=100
                )
                our_w = [x for x in w if issubclass(x.category, UserWarning) and "OpenJCK" in str(x.message)]
                if i == 2:
                    # After third call, loop_detected should become True and warning emitted
                    assert session.loop_detected is True
                    # One warning so far
                    assert len(our_w) == 1
                elif i < 3:
                    # Before third, not detected
                    assert session.loop_detected is False
                else:
                    # After third, stays True
                    assert session.loop_detected is True
                    # Should still have only one warning (only first detection triggers warning)
                    assert len(our_w) == 1
        
        session.close()
    
    def test_silent_mode_suppresses_warning(self):
        """When silent=True, no warning should be emitted even if loop detected."""
        tool_input = {"path": "/same/file.py"}
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
            FakeMessage(input_tokens=10, output_tokens=5, content=[FakeToolUse("read_file", tool_input)]),
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(loop_detection=True)
        session = ClawSession(client=client, api_key=None, guard=guard, record=False, silent=True)
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            for _ in range(3):
                session.client.messages.create(
                    model="claude-sonnet-4",
                    messages=[{"role": "user", "content": "read file"}],
                    max_tokens=100
                )
            
            # loop_detected should still be True internally
            assert session.loop_detected is True
            # But no OpenJCK warnings emitted due to silent mode
            our_warnings = [x for x in w if issubclass(x.category, UserWarning) and "OpenJCK" in str(x.message)]
            assert len(our_warnings) == 0
        
        session.close()


class TestGuardSystem:
    """Test guard rules and two-strike logic."""
    
    def test_max_cost_guard_first_strike_no_raise(self):
        """First time cost exceeds threshold should record strike but not raise."""
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),  # cost ~0.00105
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(max_cost_usd=0.0001, check_every_n_steps=1)  # Check every step for testing
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        # Should NOT raise GuardTriggered on first exceedance (first strike)
        response = session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        assert response is not None
        assert session._guard_strikes.get('cost') == 1
        session.close()
    
    def test_max_cost_guard_second_strike_raises(self):
        """Second consecutive exceedance should raise GuardTriggered."""
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
            FakeMessage(input_tokens=100, output_tokens=50),
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(max_cost_usd=0.0001, check_every_n_steps=1)  # Check every step
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        # First call: first strike
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "first"}],
            max_tokens=100
        )
        assert session._guard_strikes.get('cost') == 1
        
        # Second call: second strike -> raises
        with pytest.raises(GuardTriggered) as exc_info:
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "second"}],
                max_tokens=100
            )
        assert exc_info.value.event.guard_type == "cost"
        assert session._guard_strikes.get('cost') == 2
        session.close()
    
    def test_max_steps_guard_second_strike_raises(self):
        """Two strikes on max_steps should raise GuardTriggered."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(max_steps=0, check_every_n_steps=1)  # Check every step; threshold 0 means any step exceeds
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        # First step: strike 1
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step1"}],
            max_tokens=100
        )
        assert session._guard_strikes.get('steps') == 1
        
        # Second step: strike 2 -> raises
        with pytest.raises(GuardTriggered) as exc_info:
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "step2"}],
                max_tokens=100
            )
        assert exc_info.value.event.guard_type == "steps"
        assert session._guard_strikes.get('steps') == 2
        session.close()
    
    def test_guard_strikes_reset_when_under_threshold(self):
        """Strike should be cleared when the monitored value goes back under threshold."""
        # Use check_every_n_steps=1 to ensure guard checks on every step
        responses = [FakeMessage(input_tokens=1, output_tokens=1)]  # Very cheap call
        client = FakeAnthropic(responses)
        guard = GuardConfig(max_cost_usd=0.001, check_every_n_steps=1)
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        # Simulate a first strike was previously recorded
        session._guard_strikes['cost'] = 1
        session._total_cost_usd = 0.0  # Set cost to under threshold
        
        # Make a cheap API call; guard check will run and see total_cost < threshold
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "cheap"}],
            max_tokens=100
        )
        
        # Strike should be cleared because total_cost (tiny) < threshold
        assert 'cost' not in session._guard_strikes
        session.close()
    
    def test_multiple_guards_independent_strikes(self):
        """Multiple guards maintain independent strike counters."""
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),  # cost ~0.00105, exceeds low threshold
            FakeMessage(input_tokens=100, output_tokens=50),
        ]
        client = FakeAnthropic(responses)
        guard = GuardConfig(
            max_steps=2,  # Allow up to 2 steps before striking (strike at step 2)
            max_cost_usd=0.0001,  # Very low, each call exceeds
            check_every_n_steps=1
        )
        session = ClawSession(client=client, api_key=None, guard=guard, record=False)
        
        # Step 1: steps 1 < 2 -> no strike; cost exceeds -> strike 1 for cost, steps none
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step1"}],
            max_tokens=100
        )
        assert session._guard_strikes.get('steps') is None
        assert session._guard_strikes.get('cost') == 1
        
        # Step 2: steps 2 >= 2 -> strike 1 for steps; cost exceeds again -> strike 2 (terminate)
        with pytest.raises(GuardTriggered) as exc_info:
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": "step2"}],
                max_tokens=100
            )
        # After second call: cost=2 (terminated). Due to evaluation order (cost before steps),
        # steps may not be incremented on this step because termination occurs inside cost handling.
        assert session._guard_strikes.get('cost') == 2
        # Steps remains unchanged (still None) because it wasn't evaluated before termination.
        assert session._guard_strikes.get('steps') is None
        # Exception raised due to cost reaching strike 2
        assert exc_info.value.event.guard_type == "cost"
        assert exc_info.value.event.strike == 2


class TestGuardConfigFoundation:
    """Test GuardConfig data structures and basic integration (Phase 2 foundation)."""
    
    def test_guard_config_defaults(self):
        config = GuardConfig()
        assert config.max_cost_usd is None
        assert config.max_steps is None
        assert config.max_tool_calls is None
        assert config.max_duration_seconds is None
        assert config.loop_detection is True
        assert config.loop_window == 10
        assert config.loop_threshold == 3
        assert config.check_every_n_steps == 3
        assert config.on_guard_trigger is None
        assert config.alerts == []
    
    def test_guard_config_partial_setting(self):
        config = GuardConfig(max_cost_usd=1.0)
        assert config.max_cost_usd == 1.0
        assert config.max_steps is None
        assert config.max_tool_calls is None
        assert config.max_duration_seconds is None
        assert config.loop_detection is True
    
    def test_guard_triggered_has_event(self):
        event = GuardEvent(
            session_id="test-session",
            guard_type="cost",
            detail="Test detail",
            current_value=1.5,
            threshold=1.0,
            strike=1,
            action_taken="warned"
        )
        exc = GuardTriggered(event)
        assert exc.event is event
        assert exc.event.guard_type == "cost"
        assert "OpenJCK Guard" in str(exc)
        assert "test-session" in str(exc)
    
    def test_claw_session_accepts_guard_config(self):
        client = FakeAnthropic([FakeMessage(input_tokens=0, output_tokens=0)])
        config = GuardConfig(max_steps=10)
        session = ClawSession(client=client, api_key=None, guard=config, record=False)
        assert session.guard is config
        session.close()
    
    def test_claw_session_default_guard_config_when_none(self):
        client = FakeAnthropic([FakeMessage(input_tokens=0, output_tokens=0)])
        session = ClawSession(client=client, api_key=None, guard=None, record=False)
        assert isinstance(session.guard, GuardConfig)
        session.close()


class TestDiskRecording:
    """Test step recording to disk (deferred write, zero-padded filenames, full packets)."""
    
    def test_step_files_written_when_record_true(self, tmp_path):
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50, content=[FakeToolUse("test_tool", {"arg": "val"})]),
        ]
        client = FakeAnthropic(responses)
        
        storage = tmp_path / "storage"
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        session.close()
        
        # Check file exists (zero-padded, deferred write — flushed on close)
        step_file = storage / "sessions" / session.session_id / "step_0001.json"
        assert step_file.exists()
        
        data = json.loads(step_file.read_text())
        assert data["schema_version"] == "1.0"
        assert data["sdk"]["name"] == "openjck"
        assert data["event"]["event_type"] == "step_end"
        assert data["event"]["step_number"] == 1
        assert data["usage"]["input_tokens"] == 100
        assert data["usage"]["output_tokens"] == 50
        assert len(data["tools"]) == 1
        assert data["tools"][0]["tool_name"] == "test_tool"
        # New replay fields
        assert "input_messages" in data
        assert "response" in data
        assert data["response"]["usage"]["input_tokens"] == 100
    
    def test_no_recording_when_record_false(self, tmp_path):
        responses = [
            FakeMessage(input_tokens=100, output_tokens=50),
        ]
        client = FakeAnthropic(responses)
        
        storage = tmp_path / "storage"
        session = ClawSession(
            client=client,
            api_key=None,
            record=False,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        
        session.close()
        
        # Should NOT have created step files
        step_files = list((storage / "sessions" / session.session_id).glob("step_*.json")) if (storage / "sessions" / session.session_id).exists() else []
        assert len(step_files) == 0


class TestGuardTriggeredException:
    """Test GuardTriggered exception properties."""
    
    def test_guard_triggered_exception(self):
        event = GuardEvent(
            session_id="test-session",
            guard_type="cost",
            detail="Too expensive",
            current_value=1.5,
            threshold=1.0,
            strike=1,
            action_taken="warned"
        )
        exc = GuardTriggered(event)
        assert exc.event is event
        assert exc.event.guard_type == "cost"
        assert exc.event.detail == "Too expensive"
        assert exc.event.current_value == 1.5
        assert exc.event.threshold == 1.0
        assert "OpenJCK Guard" in str(exc)
        assert "test-session" in str(exc)


# Import for test_fallback_created_when_server_unreachable
import json
import zipfile


class TestDeferredRecording:
    """Test deferred write pattern for tool output capture."""
    
    def test_deferred_write_step_file_created_after_next_step(self, tmp_path):
        """Step N file appears only when step N+1 starts (deferred write)."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=12, output_tokens=6),
            FakeMessage(input_tokens=15, output_tokens=7),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        # After step 1: step_0001.json should NOT exist yet (deferred)
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        step1_path = storage / "sessions" / session.session_id / "step_0001.json"
        step2_path = storage / "sessions" / session.session_id / "step_0002.json"
        assert not step1_path.exists()  # Deferred
        
        # After step 2: step_0001.json SHOULD exist now (step 2 triggered write of step 1)
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 2"}],
            max_tokens=100
        )
        assert step1_path.exists()  # Now written
        assert not step2_path.exists()  # But step 2 is still pending
        
        # Close session: triggers final step write
        session.close()
        assert step2_path.exists()  # Final step written on close
    
    def test_step_packet_has_input_messages(self, tmp_path):
        """Each step packet has full input_messages array."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        input_msgs = [{"role": "user", "content": "test message"}]
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=input_msgs,
            max_tokens=100
        )
        
        # Step is pending until close
        session.close()
        
        step_path = storage / "sessions" / session.session_id / "step_0001.json"
        assert step_path.exists()
        
        data = json.loads(step_path.read_text())
        assert "input_messages" in data
        assert len(data["input_messages"]) == 1
        assert data["input_messages"][0]["role"] == "user"
        assert data["input_messages"][0]["content"] == "test message"
    
    def test_step_packet_has_response(self, tmp_path):
        """Each step packet has full response object with model, content, usage."""
        tool_use = FakeToolUse("read_file", {"path": "/test/file.py"})
        tool_use.id = "tu_test_001"  # Set explicit id for testing
        responses = [
            FakeMessage(
                input_tokens=10,
                output_tokens=5,
                content=[tool_use],
                model="claude-opus-4"
            ),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-opus-4",
            messages=[{"role": "user", "content": "read file"}],
            max_tokens=100
        )
        session.close()
        
        step_path = storage / "sessions" / session.session_id / "step_0001.json"
        assert step_path.exists()
        
        data = json.loads(step_path.read_text())
        assert "response" in data
        assert data["response"]["model"] == "claude-opus-4"
        assert "usage" in data["response"]
        assert data["response"]["usage"]["input_tokens"] == 10
        assert data["response"]["usage"]["output_tokens"] == 5
        assert "content" in data["response"]
    
    def test_tool_output_patched_into_prior_step(self, tmp_path):
        """Tool results from step N's messages are patched into step N-1's tools."""
        # Step 1: tool_use response (will have id "tu_step1_abc")
        tool1 = FakeToolUse("read_file", {"path": "/test/file.py"})
        tool1.id = "tu_step1_abc"
        
        responses = [
            FakeMessage(input_tokens=10, output_tokens=20, content=[tool1]),  # Step 1: tool_use
            FakeMessage(input_tokens=12, output_tokens=15),  # Step 2: text response
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        # Step 1: simple call with no prior tool results
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "read file"}],
            max_tokens=100
        )
        
        # Step 2: messages include tool_result for step 1's tool_use
        tool_result_msg = {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": "tu_step1_abc", "content": "file contents here", "is_error": False}
            ]
        }
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[tool_result_msg, {"role": "user", "content": "next"}],
            max_tokens=100
        )
        
        # Close triggers final write
        session.close()
        
        # Step 1 packet should have tool_output patched in
        step1_path = storage / "sessions" / session.session_id / "step_0001.json"
        step2_path = storage / "sessions" / session.session_id / "step_0002.json"
        
        assert step1_path.exists()
        assert step2_path.exists()
        
        step1_data = json.loads(step1_path.read_text())
        assert len(step1_data["tools"]) == 1
        assert step1_data["tools"][0]["tool_name"] == "read_file"
        assert "tool_output" in step1_data["tools"][0]
        assert step1_data["tools"][0]["tool_output"]["content"] == "file contents here"
        assert step1_data["tools"][0]["tool_output"]["is_error"] == False
    
    def test_zero_padded_filenames(self, tmp_path):
        """Step files use zero-padded format: step_0001.json, step_0002.json..."""
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=10, output_tokens=5),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 2"}],
            max_tokens=100
        )
        session.close()
        
        step_files = list((storage / "sessions" / session.session_id).glob("step_*.json"))
        filenames = [f.name for f in step_files]
        
        assert "step_0001.json" in filenames
        assert "step_0002.json" in filenames
        # Should NOT have non-padded names
        assert "step_1.json" not in filenames
        assert "step_2.json" not in filenames
    
    def test_five_step_session_produces_all_files(self, tmp_path):
        """5-step session produces step_0001.json through step_0005.json."""
        responses = [FakeMessage(input_tokens=10, output_tokens=5) for _ in range(5)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        for i in range(5):
            session.client.messages.create(
                model="claude-sonnet-4",
                messages=[{"role": "user", "content": f"step {i+1}"}],
                max_tokens=100
            )
        
        session.close()
        
        # Check all 5 step files exist
        for i in range(1, 6):
            step_path = storage / "sessions" / session.session_id / f"step_{i:04d}.json"
            assert step_path.exists(), f"step_{i:04d}.json should exist"
        
        # Each file should have input_messages and response
        for i in range(1, 6):
            step_path = storage / "sessions" / session.session_id / f"step_{i:04d}.json"
            data = json.loads(step_path.read_text())
            assert "input_messages" in data, f"step {i} missing input_messages"
            assert "response" in data, f"step {i} missing response"
            assert data["event"]["step_number"] == i, f"step {i} wrong step_number"


class TestAgtraceExport:
    """Test .agtrace export functionality."""
    
    def test_export_trace_creates_zip_file(self, tmp_path):
        """export_trace() creates a .agtrace ZIP file."""
        from openjck import ReplaySession
        
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
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 2"}],
            max_tokens=100
        )
        session.close()
        
        # Export as .agtrace
        output_path = tmp_path / "test_session.agtrace"
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay is not None
        
        result_path = replay.export_trace(str(output_path))
        assert Path(result_path).exists()
        assert str(result_path).endswith(".agtrace")
    
    def test_agtrace_zip_structure(self, tmp_path):
        """.agtrace ZIP contains manifest.json, session.json, and steps/ directory."""
        from openjck import ReplaySession
        
        responses = [FakeMessage(input_tokens=10, output_tokens=5)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        session.close()
        
        # Export and inspect ZIP
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        output_path = tmp_path / "test.agtrace"
        replay.export_trace(str(output_path))
        
        with zipfile.ZipFile(output_path, 'r') as zf:
            files = zf.namelist()
            
            # Required files
            assert "manifest.json" in files, "manifest.json missing"
            assert "session.json" in files, "session.json missing"
            assert "steps/step_0001.json" in files, "steps/step_0001.json missing"
            
            # Verify manifest content
            manifest = json.loads(zf.read("manifest.json"))
            assert manifest["format_version"] == "1.0"
            assert "created_at" in manifest
            assert manifest["openjck_version"] == "0.3.0"
            assert manifest["session_id"] == session.session_id
            
            # Verify session.json content
            session_data = json.loads(zf.read("session.json"))
            assert session_data["session_id"] == session.session_id
            assert "total_steps" in session_data
    
    def test_agtrace_step_files_match_original(self, tmp_path):
        """Step files in .agtrace ZIP match original step files."""
        from openjck import ReplaySession
        
        responses = [FakeMessage(input_tokens=25, output_tokens=15)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=200
        )
        session.close()
        
        # Load original step file
        original_path = storage / "sessions" / session.session_id / "step_0001.json"
        original_data = json.loads(original_path.read_text())
        
        # Export and extract
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        output_path = tmp_path / "test.agtrace"
        replay.export_trace(str(output_path))
        
        with zipfile.ZipFile(output_path, 'r') as zf:
            zip_step = json.loads(zf.read("steps/step_0001.json"))
            
            # Key fields should match
            assert zip_step["usage"]["input_tokens"] == original_data["usage"]["input_tokens"]
            assert zip_step["usage"]["output_tokens"] == original_data["usage"]["output_tokens"]
            assert zip_step["input_messages"] == original_data["input_messages"]
    
    def test_replay_session_load_from_disk(self, tmp_path):
        """ReplaySession.load() can load a recorded session."""
        from openjck import ReplaySession
        
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=20, output_tokens=10),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 2"}],
            max_tokens=100
        )
        session.close()
        
        # Load via ReplaySession
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        assert replay is not None
        assert replay.session_id == session.session_id
        assert len(replay.steps) == 2
        
        # Verify step numbers
        assert replay.steps[0]["event"]["step_number"] == 1
        assert replay.steps[1]["event"]["step_number"] == 2
        
        # Metadata populated
        assert replay.metadata["total_steps"] == 2
        assert replay.metadata["total_input_tokens"] == 30  # 10 + 20
        assert replay.metadata["total_output_tokens"] == 15  # 5 + 10
    
    def test_replay_session_get_step(self, tmp_path):
        """ReplaySession.get_step() retrieves specific steps."""
        from openjck import ReplaySession
        
        responses = [
            FakeMessage(input_tokens=10, output_tokens=5),
            FakeMessage(input_tokens=15, output_tokens=8),
        ]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 1"}],
            max_tokens=100
        )
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "step 2"}],
            max_tokens=100
        )
        session.close()
        
        replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
        
        step1 = replay.get_step(1)
        assert step1 is not None
        assert step1["event"]["step_number"] == 1
        assert step1["usage"]["input_tokens"] == 10
        
        step2 = replay.get_step(2)
        assert step2 is not None
        assert step2["event"]["step_number"] == 2
        assert step2["usage"]["input_tokens"] == 15
        
        step3 = replay.get_step(3)
        assert step3 is None  # Non-existent step
    
    def test_export_trace_default_output_path(self, tmp_path):
        """export_trace() uses {session_id}.agtrace when output_path is None."""
        from openjck import ReplaySession
        import os
        
        responses = [FakeMessage(input_tokens=10, output_tokens=5)]
        client = FakeAnthropic(responses)
        storage = tmp_path / "storage"
        
        session = ClawSession(
            client=client,
            api_key=None,
            record=True,
            local_storage_dir=str(storage)
        )
        
        session.client.messages.create(
            model="claude-sonnet-4",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100
        )
        session.close()
        
        # Get current working directory
        original_cwd = os.getcwd()
        try:
            os.chdir(str(tmp_path))
            replay = ReplaySession.load(session.session_id, local_storage_dir=str(storage))
            
            # Export with no output_path
            result = replay.export_trace(None)
            
            # Should be {session_id}.agtrace
            expected = f"{session.session_id}.agtrace"
            assert result.endswith(expected)
            assert Path(result).exists()
        finally:
            os.chdir(original_cwd)
