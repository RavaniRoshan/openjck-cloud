"""
Pricing registry for multiple LLM providers.

Prices are per 1M tokens (input/output) in USD.
Automatically selects reasonable pricing based on provider and model.
"""

from typing import Dict, Any, Optional


class PricingRegistry:
    """Registry for pricing across providers and models."""
    
    # Built-in pricing: {"provider:model": {"input_per_million": X, "output_per_million": Y}}
    _BUILTIN = {
        # Anthropic Claude
        "anthropic:claude-opus-4": {"input_per_million": 15.00, "output_per_million": 75.00},
        "anthropic:claude-opus-4-20250514": {"input_per_million": 15.00, "output_per_million": 75.00},
        "anthropic:claude-sonnet-4": {"input_per_million": 3.00,  "output_per_million": 15.00},
        "anthropic:claude-sonnet-4-20250514": {"input_per_million": 3.00,  "output_per_million": 15.00},
        "anthropic:claude-haiku-4-5": {"input_per_million": 0.80, "output_per_million": 4.00},
        "anthropic:claude-haiku-4-5-20250331": {"input_per_million": 0.80, "output_per_million": 4.00},
        "anthropic:claude-3-opus-20240229": {"input_per_million": 15.00, "output_per_million": 75.00},
        "anthropic:claude-3-5-sonnet-20241022": {"input_per_million": 3.00, "output_per_million": 15.00},
        "anthropic:claude-3-5-haiku-20241022": {"input_per_million": 0.80, "output_per_million": 4.00},
        "anthropic:claude-3-5-sonnet-20240620": {"input_per_million": 3.00, "output_per_million": 15.00},
        "anthropic:claude-3-haiku-20240307": {"input_per_million": 0.25, "output_per_million": 1.25},
        
        # OpenAI GPT
        "openai:gpt-4o": {"input_per_million": 2.50, "output_per_million": 10.00},
        "openai:gpt-4o-20240806": {"input_per_million": 2.50, "output_per_million": 10.00},
        "openai:gpt-4o-mini": {"input_per_million": 0.15, "output_per_million": 0.60},
        "openai:gpt-4o-mini-20240718": {"input_per_million": 0.15, "output_per_million": 0.60},
        "openai:gpt-4-turbo": {"input_per_million": 10.00, "output_per_million": 30.00},
        "openai:gpt-4": {"input_per_million": 30.00, "output_per_million": 60.00},
        "openai:gpt-4-0613": {"input_per_million": 30.00, "output_per_million": 60.00},
        "openai:gpt-3.5-turbo": {"input_per_million": 0.50, "output_per_million": 1.50},
        "openai:gpt-3.5-turbo-0125": {"input_per_million": 0.50, "output_per_million": 1.50},
        
        # Groq (Llama, Mixtral, Gemma) - as of 2024
        "groq:llama-3.3-70b-versatile": {"input_per_million": 0.59, "output_per_million": 0.79},
        "groq:llama-3.1-70b-versatile": {"input_per_million": 0.59, "output_per_million": 0.79},
        "groq:llama-3.1-8b-instant": {"input_per_million": 0.08, "output_per_million": 0.24},
        "groq:llama-3.2-3b": {"input_per_million": 0.04, "output_per_million": 0.04},
        "groq:llama-3.2-1b": {"input_per_million": 0.04, "output_per_million": 0.04},
        "groq:mixtral-8x7b-32768": {"input_per_million": 0.24, "output_per_million": 0.24},
        "groq:gemma2-9b-it": {"input_per_million": 0.20, "output_per_million": 0.20},
        "groq:gemma2-2b-it": {"input_per_million": 0.04, "output_per_million": 0.04},
        "groq:llama-guard-3-8b": {"input_per_million": 0.10, "output_per_million": 0.10},
        
        # Together.ai
        "together:meta-llama/Llama-3-70b-chat-hf": {"input_per_million": 0.70, "output_per_million": 0.70},
        "together:meta-llama/Llama-3-8b-chat-hf": {"input_per_million": 0.20, "output_per_million": 0.20},
        
        # DeepSeek
        "openai:deepseek-chat": {"input_per_million": 0.27, "output_per_million": 1.10},  # DeepSeek via OpenAI-compatible
        "deepseek:deepseek-chat": {"input_per_million": 0.27, "output_per_million": 1.10},
        
        # Perplexity
        "openai:sonar": {"input_per_million": 1.00, "output_per_million": 1.00},
        "openai:sonar-pro": {"input_per_million": 3.00, "output_per_million": 3.00},
        
        # Default fallback (conservative estimate for unknown models)
        "default": {"input_per_million": 1.00, "output_per_million": 3.00},
    }
    
    def __init__(self, custom_pricing: Optional[Dict[str, Dict]] = None):
        """Initialize registry with optional custom pricing overrides.
        
        Args:
            custom_pricing: Dict mapping "provider:model" to pricing dicts.
                           Overrides built-in pricing.
        """
        self._pricing = self._BUILTIN.copy()
        if custom_pricing:
            self._pricing.update(custom_pricing)
    
    def get(self, provider: str, model: str) -> Dict[str, float]:
        """Get pricing for a provider/model combination.
        
        Lookup order:
        1. Exact match: "provider:model"
        2. Provider wildcard: "provider:*" (if exists)
        3. Default fallback
        
        Args:
            provider: Provider name (e.g., 'anthropic', 'openai', 'groq')
            model: Model identifier (e.g., 'gpt-4o', 'llama-3.3-70b-versatile')
            
        Returns:
            Dict with 'input_per_million' and 'output_per_million'
        """
        # Try exact match
        key = f"{provider}:{model}"
        if key in self._pricing:
            return self._pricing[key]
        
        # Try provider default (wildcard)
        provider_wildcard = f"{provider}:*"
        if provider_wildcard in self._pricing:
            return self._pricing[provider_wildcard]
        
        # Return default
        return self._pricing["default"]
    
    def calculate_cost(self, provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost in USD for given token counts.
        
        Args:
            provider: Provider name
            model: Model identifier
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Total cost in USD
        """
        pricing = self.get(provider, model)
        input_cost = (input_tokens / 1_000_000) * pricing["input_per_million"]
        output_cost = (output_tokens / 1_000_000) * pricing["output_per_million"]
        return input_cost + output_cost
    
    def register(self, provider: str, model: str, input_per_million: float, output_per_million: float) -> None:
        """Register custom pricing for a provider/model."""
        key = f"{provider}:{model}"
        self._pricing[key] = {
            "input_per_million": input_per_million,
            "output_per_million": output_per_million
        }


# Global registry instance (can be overridden via environment)
_default_registry: Optional[PricingRegistry] = None


def get_pricing_registry(custom_pricing: Optional[Dict[str, Dict]] = None) -> PricingRegistry:
    """Get the global pricing registry, optionally with custom overrides.
    
    If called multiple times with same custom_pricing, returns cached instance.
    Call with custom_pricing=None to get default registry.
    """
    global _default_registry
    if _default_registry is None or custom_pricing is not None:
        return PricingRegistry(custom_pricing)
    return _default_registry


def initialize_pricing_registry(custom_pricing: Optional[Dict[str, Dict]] = None) -> None:
    """Initialize the global pricing registry with optional custom pricing."""
    global _default_registry
    _default_registry = PricingRegistry(custom_pricing)
