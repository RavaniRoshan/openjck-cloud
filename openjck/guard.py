"""
Guard system for OpenJCK.

Provides:
- GuardEvent: data class for guard trigger events
- GuardConfig: configuration for guard rules
- GuardTriggered: exception raised when a guard activates
"""

from dataclasses import dataclass, field
from typing import Callable, List, Optional


@dataclass
class GuardEvent:
    """Event emitted when a guard rule trips."""
    session_id: str
    guard_type: str  # "cost" | "steps" | "tool_calls" | "duration" | "loop"
    detail: str
    current_value: float
    threshold: float
    strike: int  # 1 | 2
    action_taken: str  # "warned" | "terminated"


@dataclass
class GuardConfig:
    """Configuration for guard rules."""
    max_cost_usd: Optional[float] = None
    max_steps: Optional[int] = None
    max_tool_calls: Optional[int] = None
    max_duration_seconds: Optional[int] = None
    loop_detection: bool = True
    loop_window: int = 10
    loop_threshold: int = 3
    check_every_n_steps: int = 3  # Phase 2: stub for future periodic checks
    on_guard_trigger: Optional[Callable[[GuardEvent], None]] = None
    alerts: List = field(default_factory=list)  # Placeholder for Phase 4 alert system


class GuardTriggered(Exception):
    """Raised when a guard rule is triggered after two strikes."""
    
    def __init__(self, event: GuardEvent):
        self.event = event
        super().__init__(
            f"OpenJCK Guard [{event.guard_type}]: {event.detail}. "
            f"Session: {event.session_id}. Strike: {event.strike}."
        )
