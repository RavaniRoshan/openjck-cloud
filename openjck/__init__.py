"""
OpenJCK Python SDK - Provider-agnostic AI instrumentation.

Supports Anthropic, OpenAI, Groq, and any OpenAI-compatible API.
"""

from .alerts import Alert, ConsoleAlert, WebhookAlert, SlackAlert, SessionEndEvent
from .claw import ClawSession, create_session
from .guard import GuardConfig, GuardTriggered, GuardEvent
from .loop_detector import LoopDetector, LoopDetectionResult
from .replay import ReplaySession, ReplayResult, DivergenceReport
from .protocol import ProtocolEmitter
from .llm import (
    LLMProvider,
    LLMResponse,
    AnthropicProvider,
    OpenAICompatibleProvider,
    get_provider,
    get_pricing_registry,
    PricingRegistry,
)

# Initialize default pricing registry on import (includes all built-in prices)
from .llm.pricing import _default_registry
# Already initialized in pricing.py module-level

__all__ = [
    # Main session
    "ClawSession",
    "create_session",
    
    # LLM abstraction
    "LLMProvider",
    "LLMResponse",
    "AnthropicProvider",
    "OpenAICompatibleProvider",
    "get_provider",
    "get_pricing_registry",
    "PricingRegistry",
    
    # Guard & loop detection
    "GuardConfig",
    "GuardTriggered",
    "GuardEvent",
    "LoopDetector",
    "LoopDetectionResult",
    
    # Alerts
    "Alert",
    "ConsoleAlert",
    "WebhookAlert",
    "SlackAlert",
    "SessionEndEvent",
    
    # Replay
    "ReplaySession",
    "ReplayResult",
    "DivergenceReport",
    
    # Protocol
    "ProtocolEmitter",
]

__version__ = "0.4.0"  # Bumped for multi-provider support

