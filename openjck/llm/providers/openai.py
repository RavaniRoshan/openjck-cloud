"""
OpenAI-compatible provider implementation.

Works with:
- OpenAI (https://api.openai.com/v1)
- Groq (https://api.groq.com/openai/v1)
- Together.ai (https://api.together.xyz/v1)
- Any other OpenAI-compatible API endpoint
"""

import json
from typing import Any, Dict, List, Optional
from ..base import LLMProvider, LLMResponse
from openai import OpenAI


class OpenAICompatibleProvider(LLMProvider):
    """Provider for OpenAI API and any OpenAI-compatible endpoint."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", timeout: float = 60.0):
        self.client = OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)
        self.base_url = base_url
    
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str,
        max_tokens: Optional[int] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        **kwargs
    ) -> LLMResponse:
        # Build kwargs for OpenAI-compatible API
        openai_kwargs = {
            "model": model,
            "messages": messages,
        }
        if max_tokens:
            openai_kwargs["max_tokens"] = max_tokens
        if tools:
            openai_kwargs["tools"] = tools
        openai_kwargs.update(kwargs)
        
        response = self.client.chat.completions.create(**openai_kwargs)
        
        choice = response.choices[0]
        message = choice.message
        
        # Convert OpenAI response to unified format
        content: List[Dict[str, Any]] = []
        
        # Text content
        if message.content:
            content.append({"type": "text", "text": message.content})
        
        # Tool calls (function_call in OpenAI)
        if message.tool_calls:
            for tool_call in message.tool_calls:
                # Handle both function_call and tool_calls (new OpenAI format)
                if hasattr(tool_call, 'function'):
                    func = tool_call.function
                    # arguments is a JSON string - parse it
                    try:
                        import json
                        input_data = json.loads(func.arguments) if func.arguments else {}
                    except json.JSONDecodeError:
                        input_data = {"raw": func.arguments}
                    
                    content.append({
                        "type": "tool_use",
                        "id": tool_call.id,
                        "name": func.name,
                        "input": input_data
                    })
                elif hasattr(tool_call, 'type') and tool_call.type == "function":
                    # New format
                    try:
                        import json
                        input_data = json.loads(tool_call.function.arguments) if tool_call.function.arguments else {}
                    except json.JSONDecodeError:
                        input_data = {"raw": tool_call.function.arguments}
                    
                    content.append({
                        "type": "tool_use",
                        "id": tool_call.id,
                        "name": tool_call.function.name,
                        "input": input_data
                    })
        
        # Note: Some OpenAI-compatible APIs (Groq) don't return usage
        usage = {}
        if response.usage:
            usage = {
                "input_tokens": response.usage.prompt_tokens,
                "output_tokens": response.usage.completion_tokens
            }
        
        return LLMResponse(
            id=response.id,
            content=content,
            model=response.model,
            stop_reason=choice.finish_reason or "unknown",
            usage=usage,
            raw=response
        )
    
    def validate_model(self, model: str) -> bool:
        # Can't easily validate without listing models; assume valid
        return True
    
    @property
    def provider_name(self) -> str:
        # Infer from base_url
        if "groq.com" in self.base_url:
            return "groq"
        elif "together.ai" in self.base_url or "together.xyz" in self.base_url:
            return "together"
        elif "openai.com" in self.base_url:
            return "openai"
        elif "localhost" in self.base_url or "127.0.0.1" in self.base_url:
            return "local"
        else:
            return "custom"
