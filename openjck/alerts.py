"""
Alert system for OpenJCK.

Provides:
- Base Alert class
- SessionEndEvent: event for session completion
- ConsoleAlert: terminal output with ANSI colors
- WebhookAlert: generic HTTP webhook with retry
- SlackAlert: Slack Block Kit messages
"""

import json
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional, Union
from urllib.request import Request, urlopen
from urllib.error import URLError

from .guard import GuardEvent


# Base event type for all alerts
@dataclass
class AlertEvent:
    """Base class for events sent to alerts."""
    session_id: str
    timestamp: str


@dataclass
class SessionEndEvent(AlertEvent):
    """Event emitted when a session ends."""
    claw_name: str  # Uses project field from ClawSession
    status: str  # "completed" | "failed" | "terminated"
    total_cost_usd: float
    total_steps: int
    failure_root_cause: Optional[str] = None


class Alert(ABC):
    """Base alert class. All alert implementations inherit from this."""
    
    @abstractmethod
    def send(self, event: Union[GuardEvent, SessionEndEvent]) -> None:
        """Send an alert notification."""
        pass


class ConsoleAlert(Alert):
    """Logs alerts to console with ANSI colors."""
    
    # ANSI color codes
    AMBER = "\033[38;5;214m"  # Amber/orange
    RED = "\033[31m"
    GREEN = "\033[32m"
    GREY = "\033[90m"
    RESET = "\033[0m"
    BOLD = "\033[1m"
    
    def send(self, event: Union[GuardEvent, SessionEndEvent]) -> None:
        """Format and print alert to console."""
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        
        if isinstance(event, GuardEvent):
            # Guard alert format
            color = self.AMBER
            if event.action_taken == "terminated":
                color = self.RED
            strike_text = f"{event.strike}/2"
            message = (
                f"{color}{self.BOLD}⚡ [{timestamp}] Guard {strike_text} ({event.action_taken}): "
                f"{event.guard_type} in {self._get_claw_name(event)} — {event.detail}"
                f"{self.RESET}"
            )
        elif isinstance(event, SessionEndEvent):
            # Session end format
            if event.status == "completed":
                color = self.GREEN
            elif event.status in ("failed", "terminated"):
                color = self.RED
            else:
                color = self.GREY
                
            message = (
                f"{color}{self.BOLD}✓  [{timestamp}] Session {event.claw_name} → {event.status} "
                f"| ${event.total_cost_usd:.4f} | {event.total_steps} steps{self.RESET}"
            )
            if event.failure_root_cause:
                message += f"\n  {self.RED}Root cause: {event.failure_root_cause}{self.RESET}"
        else:
            return
            
        print(message)
    
    def _get_claw_name(self, event: GuardEvent) -> str:
        """Extract claw_name from session_id or use session_id as fallback."""
        # For GuardEvent, we don't have claw_name directly
        # Use session_id prefix as best-effort name
        return event.session_id[:8] + "..."


class WebhookAlert(Alert):
    """Sends alerts to a generic webhook endpoint with retry logic."""
    
    def __init__(self, url: str, method: str = "POST", headers: Optional[Dict[str, str]] = None):
        self.url = url
        self.method = method.upper()
        self.headers = headers or {"Content-Type": "application/json"}
        self.timeout = 5
    
    def send(self, event: Union[GuardEvent, SessionEndEvent]) -> None:
        """Send event to webhook with one retry on failure."""
        payload = self._build_payload(event)
        
        # Try twice: first attempt + one retry after 5s
        for attempt in range(2):
            try:
                data = json.dumps(payload).encode("utf-8")
                req = Request(
                    self.url,
                    data=data,
                    headers=self.headers,
                    method=self.method
                )
                with urlopen(req, timeout=self.timeout) as resp:
                    if resp.status >= 400:
                        raise URLError(f"HTTP {resp.status}")
                return  # Success, exit
            except Exception as e:
                if attempt == 0:
                    # Wait 5s before retry
                    time.sleep(5)
                    continue
                else:
                    # Final failure - write to fallback file
                    self._write_to_fallback(payload, str(e))
    
    def _build_payload(self, event: Union[GuardEvent, SessionEndEvent]) -> Dict[str, Any]:
        """Build standardized webhook payload."""
        base = {
            "event": "guard_triggered" if isinstance(event, GuardEvent) else "session_ended",
            "session_id": event.session_id,
            "timestamp": event.timestamp if hasattr(event, 'timestamp') else datetime.utcnow().isoformat() + "Z",
        }
        
        if isinstance(event, GuardEvent):
            base.update({
                "guard_type": event.guard_type,
                "detail": event.detail,
                "current_value": event.current_value,
                "threshold": event.threshold,
                "strike": event.strike,
                "action": event.action_taken,
            })
        else:
            base.update({
                "claw_name": event.claw_name,
                "status": event.status,
                "total_cost_usd": event.total_cost_usd,
                "total_steps": event.total_steps,
            })
            if event.failure_root_cause:
                base["failure_root_cause"] = event.failure_root_cause
                
        return base
    
    def _write_to_fallback(self, payload: Dict[str, Any], error: str) -> None:
        """Write failed webhook to fallback file."""
        fallback_path = ".openjck-failed-alerts.jsonl"
        try:
            with open(fallback_path, "a") as f:
                f.write(json.dumps({
                    "timestamp": datetime.utcnow().isoformat(),
                    "url": self.url,
                    "payload": payload,
                    "error": error
                }) + "\n")
        except Exception:
            pass  # Silent failure if fallback write also fails


class SlackAlert(Alert):
    """Sends alerts to Slack using Block Kit format."""
    
    def __init__(self, webhook_url: str, channel: Optional[str] = None, mention: Optional[str] = None):
        self.webhook_url = webhook_url
        self.channel = channel
        self.mention = mention
    
    def send(self, event: Union[GuardEvent, SessionEndEvent]) -> None:
        """Send formatted Block Kit message to Slack."""
        if isinstance(event, GuardEvent):
            blocks = self._build_guard_blocks(event)
        elif isinstance(event, SessionEndEvent):
            blocks = self._build_session_end_blocks(event)
        else:
            return
            
        payload = {"blocks": blocks}
        if self.channel:
            payload["channel"] = self.channel
            
        # Send in background thread (non-blocking)
        threading.Thread(
            target=self._post_to_slack,
            args=(payload,),
            daemon=True
        ).start()
    
    def _build_guard_blocks(self, event: GuardEvent) -> list:
        """Build Block Kit for guard trigger."""
        # Determine color based on action
        color = "#f59e0b" if event.action_taken == "warned" else "#ef4444"  # amber or red
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "⚡ OpenJCK Guard Triggered"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Session:*\n`{event.session_id[:12]}...`"},
                    {"type": "mrkdwn", "text": f"*Guard Type:*\n{event.guard_type}"},
                    {"type": "mrkdwn", "text": f"*Detail:*\n{event.detail}"},
                    {"type": "mrkdwn", "text": f"*Value:*\n{event.current_value:.4f}"},
                    {"type": "mrkdwn", "text": f"*Threshold:*\n{event.threshold:.4f}"},
                    {"type": "mrkdwn", "text": f"*Strike:*\n{event.strike}/2"},
                    {"type": "mrkdwn", "text": f"*Action:*\n{event.action_taken}"},
                    {"type": "mrkdwn", "text": f"*Timestamp:*\n{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"}
                ]
            }
        ]
        
        # Add mention if configured and it's a termination
        if self.mention and event.action_taken == "terminated":
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{self.mention} Session terminated due to guard violation."
                }
            })
        
        return blocks
    
    def _build_session_end_blocks(self, event: SessionEndEvent) -> list:
        """Build Block Kit for session end."""
        # Determine color based on status
        if event.status == "completed":
            color = "#22c55e"  # green
            icon = "✓"
            header_text = "OpenJCK Session Completed"
        elif event.status in ("failed", "terminated"):
            color = "#ef4444"  # red
            icon = "✗"
            header_text = f"OpenJCK Session {event.status.title()}"
        else:
            color = "#6b7280"  # grey
            icon = "i"
            header_text = "OpenJCK Session Update"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{icon} {header_text}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Session:*\n`{event.claw_name}`"},
                    {"type": "mrkdwn", "text": f"*Status:*\n{event.status}"},
                    {"type": "mrkdwn", "text": f"*Cost:*\n${event.total_cost_usd:.4f}"},
                    {"type": "mrkdwn", "text": f"*Steps:*\n{event.total_steps}"},
                    {"type": "mrkdwn", "text": f"*Timestamp:*\n{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"}
                ]
            }
        ]
        
        # Add failure root cause if present
        if event.failure_root_cause:
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Root Cause:*\n```{event.failure_root_cause}```"
                }
            })
        
        return blocks
    
    def _post_to_slack(self, payload: Dict[str, Any]) -> None:
        """Post payload to Slack webhook."""
        try:
            data = json.dumps(payload).encode("utf-8")
            req = Request(
                self.webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urlopen(req, timeout=10) as resp:
                if resp.status >= 400:
                    raise URLError(f"HTTP {resp.status}")
        except Exception:
            # Silent failure - we don't want Slack outages to crash user code
            pass
