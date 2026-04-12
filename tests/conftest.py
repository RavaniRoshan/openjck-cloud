"""
Fake Anthropic client for testing.
Mimics the structure of anthropic.Anthropic and its messages.create response.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
import uuid


@dataclass
class FakeUsage:
    input_tokens: int
    output_tokens: int


@dataclass
class FakeToolResult:
    """Mimics tool_result content block for testing tool output capture."""
    type: str = "tool_result"
    tool_use_id: str = ""
    content: Any = ""
    is_error: bool = False
    
    def __init__(self, tool_use_id: str = "", content: Any = "", is_error: bool = False):
        self.type = "tool_result"
        self.tool_use_id = tool_use_id
        self.content = content
        self.is_error = is_error


@dataclass
class FakeToolUse:
    """Mimics tool_use content block with id for matching with tool_result."""
    type: str = "tool_use"
    id: str = field(default_factory=lambda: f"tu_{uuid.uuid4().hex[:8]}")
    name: str = "test_tool"
    input: Dict[str, Any] = None
    
    def __init__(self, name: str = "test_tool", input: Optional[Dict[str, Any]] = None, tool_use_id: Optional[str] = None):
        self.type = "tool_use"
        self.id = tool_use_id or f"tu_{uuid.uuid4().hex[:8]}"
        self.name = name
        self.input = input or {}


@dataclass
class FakeMessage:
    """Mimics anthropic.types.Message with model_dump() for serialization."""
    content: List[Any]
    usage: FakeUsage
    stop_reason: str = "end_turn"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "message"
    role: str = "assistant"
    model: str = "claude-sonnet-4-6"
    
    def __init__(
        self,
        input_tokens: int = 0,
        output_tokens: int = 0,
        content: Optional[List[Any]] = None,
        stop_reason: str = "end_turn",
        model: str = "claude-sonnet-4-6"
    ):
        self.usage = FakeUsage(input_tokens=input_tokens, output_tokens=output_tokens)
        self.content = content or []
        self.stop_reason = stop_reason
        self.id = str(uuid.uuid4())
        self.type = "message"
        self.role = "assistant"
        self.model = model
    
    def model_dump(self) -> Dict[str, Any]:
        """Serialize to dict for step packet storage."""
        return {
            "id": self.id,
            "type": self.type,
            "role": self.role,
            "model": self.model,
            "content": [
                self._serialize_content_block(b) for b in self.content
            ],
            "stop_reason": self.stop_reason,
            "stop_sequence": None,
            "usage": {
                "input_tokens": self.usage.input_tokens,
                "output_tokens": self.usage.output_tokens,
            },
        }
    
    def _serialize_content_block(self, block: Any) -> Dict[str, Any]:
        """Serialize a content block to dict."""
        if isinstance(block, dict):
            return block
        if hasattr(block, '__dict__'):
            return {k: v for k, v in block.__dict__.items() if not k.startswith('_')}
        return {"type": "text", "text": str(block)}


class FakeMessages:
    """Mimics the messages namespace"""
    
    def __init__(self, responses: List[FakeMessage]):
        self._responses = responses
        self._call_count = 0
    
    def create(self, **kwargs) -> FakeMessage:
        if self._call_count < len(self._responses):
            response = self._responses[self._call_count]
            self._call_count += 1
            return response
        # Default response if we run out
        return FakeMessage(input_tokens=0, output_tokens=0)
    
    def reset(self) -> None:
        self._call_count = 0


class FakeAnthropic:
    """Fake anthropic.Anthropic client"""
    
    def __init__(self, responses: Optional[List[FakeMessage]] = None):
        self.messages = FakeMessages(responses)
