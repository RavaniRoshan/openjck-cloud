"""
Tests for OpenJCK ProtocolEmitter.
"""

import json
import unittest.mock as mock
from openjck import ProtocolEmitter


class TestProtocolEmitter:
    """Test ProtocolEmitter class."""

    def test_emit_adds_at_version_and_timestamp(self):
        """emit() auto-adds at_version and timestamp if missing."""
        emitter = ProtocolEmitter("http://fake")
        event = {"event": "test", "session_id": "s1", "org_id": "o1"}
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_urlopen.return_value.__enter__ = mock.MagicMock(return_value=mock.MagicMock(status=200))
            mock_urlopen.return_value.__exit__ = mock.MagicMock(return_value=False)
            
            result = emitter.emit(event)
            
            assert result is True
            # Check that at_version and timestamp were added
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["at_version"] == "1.0"
            assert "timestamp" in sent_data

    def test_emit_respects_provided_timestamp(self):
        """emit() does not override provided timestamp."""
        emitter = ProtocolEmitter("http://fake")
        event = {
            "event": "test",
            "session_id": "s1",
            "org_id": "o1",
            "timestamp": "2025-04-12T12:00:00Z"
        }
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.emit(event)
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["timestamp"] == "2025-04-12T12:00:00Z"

    def test_emit_returns_false_on_error(self):
        """emit() returns False on HTTP/URL errors."""
        emitter = ProtocolEmitter("http://fake")
        event = {"event": "test", "session_id": "s1", "org_id": "o1", "timestamp": "2025-04-12T12:00:00Z"}
        
        with mock.patch('urllib.request.urlopen', side_effect=Exception("network error")):
            result = emitter.emit(event)
            assert result is False

    def test_session_start_builds_correct_event(self):
        """session_start() includes all fields."""
        emitter = ProtocolEmitter("http://fake")
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.session_start(
                org_id="org-123",
                session_id="sess-456",
                claw_name="test-agent",
                project="my-project",
                environment="prod",
                tags=["tag1", "tag2"],
                metadata={"key": "value"},
                guard_config={"max_cost": 1.0}
            )
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["event"] == "session.start"
            assert sent_data["session_id"] == "sess-456"
            assert sent_data["org_id"] == "org-123"
            assert sent_data["claw_name"] == "test-agent"
            assert sent_data["project"] == "my-project"
            assert sent_data["environment"] == "prod"
            assert sent_data["tags"] == ["tag1", "tag2"]
            assert sent_data["metadata"] == {"key": "value"}
            assert sent_data["guard_config"] == {"max_cost": 1.0}
            assert sent_data["at_version"] == "1.0"
            assert "timestamp" in sent_data

    def test_session_step_builds_correct_event(self):
        """session_step() includes usage and request."""
        emitter = ProtocolEmitter("http://fake")
        step_packet = {"schema_version": "1.0", "tools": []}
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.session_step(
                org_id="org-123",
                session_id="sess-456",
                step=0,
                model="claude-sonnet-4",
                input_tokens=100,
                output_tokens=50,
                tool_call_count=2,
                step_number=0,
                step_packet=step_packet
            )
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["event"] == "session.step"
            assert sent_data["step"] == 0
            assert sent_data["usage"]["input_tokens"] == 100
            assert sent_data["usage"]["output_tokens"] == 50
            assert sent_data["usage"]["tool_call_count"] == 2
            assert sent_data["request"]["model"] == "claude-sonnet-4"
            assert sent_data["step_packet"] == step_packet

    def test_session_flag_builds_correct_event(self):
        """session_flag() includes flag_type and detail."""
        emitter = ProtocolEmitter("http://fake")
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.session_flag(
                org_id="org-123",
                session_id="sess-456",
                flag_type="loop_detected",
                detail="Repeated tool use"
            )
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["event"] == "session.flag"
            assert sent_data["flag_type"] == "loop_detected"
            assert sent_data["detail"] == "Repeated tool use"

    def test_session_end_builds_correct_event(self):
        """session_end() includes status and optional summary."""
        emitter = ProtocolEmitter("http://fake")
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.session_end(
                org_id="org-123",
                session_id="sess-456",
                status="completed",
                total_steps=10,
                total_input_tokens=15000,
                total_output_tokens=4500,
                total_cost_usd=0.1234
            )
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["event"] == "session.end"
            assert sent_data["status"] == "completed"
            assert sent_data["summary"]["steps"] == 10
            assert sent_data["summary"]["cost_usd"] == 0.1234

    def test_session_end_without_summary(self):
        """session_end() works without summary fields."""
        emitter = ProtocolEmitter("http://fake")
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.session_end(
                org_id="org-123",
                session_id="sess-456",
                status="failed",
                failure_root_cause="LLM timeout"
            )
            
            sent_data = json.loads(mock_urlopen.call_args[0][0].data)
            assert sent_data["status"] == "failed"
            assert sent_data["failure_root_cause"] == "LLM timeout"
            assert "summary" not in sent_data

    def test_emit_uses_custom_receiver_url(self):
        """Emitter uses constructor-provided receiver_url."""
        custom_url = "http://custom:8080/api/protocol/events"
        emitter = ProtocolEmitter(custom_url)
        event = {"event": "test", "session_id": "s1", "org_id": "o1", "timestamp": "2025-04-12T12:00:00Z"}
        
        with mock.patch('urllib.request.urlopen') as mock_urlopen:
            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.__enter__ = mock.MagicMock(return_value=mock_resp)
            mock_resp.__exit__ = mock.MagicMock(return_value=False)
            mock_urlopen.return_value = mock_resp
            
            emitter.emit(event)
            
            called_url = mock_urlopen.call_args[0][0].full_url
            assert called_url == custom_url

    def test_emit_timeout_returns_false(self):
        """emit() returns False on timeout."""
        import socket
        emitter = ProtocolEmitter("http://fake")
        event = {"event": "test", "session_id": "s1", "org_id": "o1", "timestamp": "2025-04-12T12:00:00Z"}
        
        with mock.patch('urllib.request.urlopen', side_effect=socket.timeout("timeout")):
            result = emitter.emit(event)
            assert result is False
