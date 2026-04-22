"""
Abstract interfaces and data classes for LLM providers.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class LLMResponse:
    """Unified response format for all LLM providers."""
    
    id: str
    content: List[Dict[str, Any]]  # [{"type": "text", "text": "..."}, ...]
    model: str
    stop_reason: str  # "end_turn", "stop_sequence", "max_tokens", "tool_use", etc.
    usage: Dict[str, int]  # {"input_tokens": 100, "output_tokens": 50}
    raw: Any = field(repr=False)  # Original SDK response for advanced usage
    
    def get_text(self) -> str:
        """Extract all text content as a single string."""
        texts = []
        for block in self.content:
            if block.get("type") == "text":
                texts.append(block.get("text", ""))
        return "\n".join(texts)
    
    def get_tool_uses(self) -> List[Dict[str, Any]]:
        """Extract tool_use blocks."""
        return [block for block in self.content if block.get("type") == "tool_use"]


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> LLMResponse:
        """Send a chat completion request."""
        pass
    
    @abstractmethod
    def validate_model(self, model: str) -> bool:
        """Check if a model name is valid for this provider."""
        pass
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return provider identifier (e.g., 'anthropic', 'openai', 'groq')."""
        pass
