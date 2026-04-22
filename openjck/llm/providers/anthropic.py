"""
Anthropic Claude provider implementation.
"""

from typing import Any, Dict, List, Optional
from ..base import LLMProvider, LLMResponse
import anthropic


class AnthropicProvider(LLMProvider):
    """Provider wrapper for Anthropic Claude API."""
    
    def __init__(self, api_key: str, base_url: Optional[str] = None, timeout: float = 60.0):
        # Allow custom base_url for Anthropic-compatible endpoints
        if base_url:
            self.client = anthropic.Anthropic(api_key=api_key, base_url=base_url, timeout=timeout)
        else:
            self.client = anthropic.Anthropic(api_key=api_key, timeout=timeout)
    
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> LLMResponse:
        # Convert OpenAI-style tools to Anthropic format if needed
        anthropic_tools = None
        if tools:
            anthropic_tools = []
            for tool in tools:
                if tool.get("type") == "function":
                    # Convert OpenAI function to Anthropic tool
                    func = tool["function"]
                    anthropic_tools.append({
                        "name": func["name"],
                        "description": func.get("description", ""),
                        "input_schema": func["parameters"]
                    })
                else:
                    # Assume already Anthropic format
                    anthropic_tools.append(tool)
        
        # Build kwargs for Anthropic
        anthropic_kwargs = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens or 1024,
        }
        if anthropic_tools:
            anthropic_kwargs["tools"] = anthropic_tools
        anthropic_kwargs.update(kwargs)
        
        # Remove OpenAI-style parameters
        anthropic_kwargs.pop("functions", None)
        anthropic_kwargs.pop("function_call", None)
        
        response = self.client.messages.create(**anthropic_kwargs)
        
        # Convert Anthropic response to unified format
        content: List[Dict[str, Any]] = []
        for block in response.content:
            if block.type == "text":
                content.append({"type": "text", "text": block.text})
            elif block.type == "tool_use":
                content.append({
                    "type": "tool_use",
                    "id": block.id,
                    "name": block.name,
                    "input": block.input
                })
        
        return LLMResponse(
            id=response.id,
            content=content,
            model=response.model,
            stop_reason=response.stop_reason or "unknown",
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens
            },
            raw=response
        )
    
    def validate_model(self, model: str) -> bool:
        # Anthropic models typically include "claude"
        return "claude" in model.lower() or model.startswith("claude-")
    
    @property
    def provider_name(self) -> str:
        return "anthropic"
