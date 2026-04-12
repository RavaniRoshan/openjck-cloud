"""
OpenJCK Protocol v1 - Standalone emitter for framework authors.

This module provides a zero-dependency emitter for the OpenJCK Protocol,
an open standard for agent observability events. It works without the
Anthropic SDK and can be integrated into any Python agent framework.
"""

import json
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, Optional, List


class ProtocolEmitter:
    """
    Emits OpenJCK Protocol v1 events to a receiver endpoint.
    
    Example:
        emitter = ProtocolEmitter("http://localhost:7070/api/protocol/events")
        emitter.session_start(
            org_id="org-123",
            session_id="sess-456",
            claw_name="researcher"
        )
    """
    
    AT_VERSION = "1.0"
    
    def __init__(self, receiver_url: Optional[str] = None):
        """
        Initialize the emitter.
        
        Args:
            receiver_url: URL of the protocol receiver endpoint.
                         Defaults to OPENJCK_PROTOCOL_URL env var or localhost:7070.
        """
        import os
        self.receiver_url = receiver_url or os.getenv(
            "OPENJCK_PROTOCOL_URL", 
            "http://localhost:7070/api/protocol/events"
        )
    
    def emit(self, event: Dict[str, Any]) -> bool:
        """
        Emit a raw protocol event.
        
        The event dict must include required fields: event, session_id, timestamp, org_id.
        This method automatically adds at_version="1.0" if not present.
        
        Args:
            event: Event dictionary following OpenJCK Protocol schema.
            
        Returns:
            True if the event was accepted (HTTP 200), False otherwise.
        """
        # Ensure at_version is set
        if "at_version" not in event:
            event["at_version"] = self.AT_VERSION
        
        # Ensure timestamp exists
        if "timestamp" not in event:
            event["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        try:
            data = json.dumps(event).encode('utf-8')
            req = urllib.request.Request(
                self.receiver_url,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            # Any error (network, timeout, etc.) results in False
            return False
    
    def session_start(
        self,
        org_id: str,
        session_id: str,
        claw_name: str = "unknown",
        project: Optional[str] = None,
        environment: str = "dev",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        guard_config: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """
        Emit a session.start event.
        
        Args:
            org_id: Organization UUID (required).
            session_id: Unique session identifier (required).
            claw_name: Human-readable agent name (default: "unknown").
            project: Optional project name.
            environment: Environment label (default: "dev").
            tags: List of string tags.
            metadata: Arbitrary JSON-serializable metadata dict.
            guard_config: Guard configuration dict.
            timestamp: ISO8601 timestamp (auto-generated if not provided).
            
        Returns:
            True if accepted, False otherwise.
        """
        event = {
            "event": "session.start",
            "session_id": session_id,
            "org_id": org_id,
            "claw_name": claw_name,
            "project": project,
            "environment": environment,
            "tags": tags or [],
            "metadata": metadata or {},
            "guard_config": guard_config,
        }
        if timestamp:
            event["timestamp"] = timestamp
        return self.emit(event)
    
    def session_step(
        self,
        org_id: str,
        session_id: str,
        step: int,
        model: str,
        input_tokens: int,
        output_tokens: int,
        tool_call_count: int = 0,
        step_number: Optional[int] = None,
        step_packet: Optional[Dict[str, Any]] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """
        Emit a session.step event.
        
        Args:
            org_id: Organization UUID (required).
            session_id: Session identifier (required).
            step: Step number (0-indexed or 1-indexed, consistent across session).
            model: Model identifier (e.g., "claude-sonnet-4").
            input_tokens: Input token count.
            output_tokens: Output token count.
            tool_call_count: Number of tool calls made in this step.
            step_number: Override for step number (defaults to `step`).
            step_packet: Full step packet dict (the complete JSON from ClawSession recording).
            timestamp: ISO8601 timestamp.
            
        Returns:
            True if accepted, False otherwise.
        """
        event = {
            "event": "session.step",
            "session_id": session_id,
            "org_id": org_id,
            "step": step,
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "tool_call_count": tool_call_count,
                "step_number": step_number if step_number is not None else step,
            },
            "request": {
                "model": model,
            },
        }
        if step_packet is not None:
            event["step_packet"] = step_packet
        if timestamp:
            event["timestamp"] = timestamp
        return self.emit(event)
    
    def session_flag(
        self,
        org_id: str,
        session_id: str,
        flag_type: str,
        detail: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """
        Emit a session.flag event.
        
        Args:
            org_id: Organization UUID (required).
            session_id: Session identifier (required).
            flag_type: Type of flag (e.g., "loop_detected", "cost_limit").
            detail: Human-readable detail message.
            timestamp: ISO8601 timestamp.
            
        Returns:
            True if accepted, False otherwise.
        """
        event = {
            "event": "session.flag",
            "session_id": session_id,
            "org_id": org_id,
            "flag_type": flag_type,
            "detail": detail,
        }
        if timestamp:
            event["timestamp"] = timestamp
        return self.emit(event)
    
    def session_end(
        self,
        org_id: str,
        session_id: str,
        status: str = "completed",
        total_steps: Optional[int] = None,
        total_input_tokens: Optional[int] = None,
        total_output_tokens: Optional[int] = None,
        total_cost_usd: Optional[float] = None,
        failure_root_cause: Optional[str] = None,
        ended_at: Optional[str] = None,
        timestamp: Optional[str] = None
    ) -> bool:
        """
        Emit a session.end event.
        
        Args:
            org_id: Organization UUID (required).
            session_id: Session identifier (required).
            status: Final status ("completed", "failed", "terminated").
            total_steps: Total steps executed.
            total_input_tokens: Cumulative input tokens.
            total_output_tokens: Cumulative output tokens.
            total_cost_usd: Total cost in USD.
            failure_root_cause: If status is failed/terminated, the root cause.
            ended_at: ISO8601 timestamp of session end (auto-generated if not provided).
            timestamp: ISO8601 timestamp for the event itself.
            
        Returns:
            True if accepted, False otherwise.
        """
        event = {
            "event": "session.end",
            "session_id": session_id,
            "org_id": org_id,
            "status": status,
            "failure_root_cause": failure_root_cause,
            "ended_at": ended_at,
        }
        # Include summary metrics if provided
        if total_steps is not None or total_input_tokens is not None or total_output_tokens is not None or total_cost_usd is not None:
            event["summary"] = {
                "steps": total_steps,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "cost_usd": total_cost_usd,
            }
        if timestamp:
            event["timestamp"] = timestamp
        return self.emit(event)
