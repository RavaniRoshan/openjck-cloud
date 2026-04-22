"""
Factory function for creating LLM providers with environment configuration.
"""

import os
from typing import Optional

from .base import LLMProvider
from .providers import AnthropicProvider, OpenAICompatibleProvider
from .pricing import initialize_pricing_registry, get_pricing_registry


def get_provider(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    auto_init_pricing: bool = True,
    **kwargs
) -> LLMProvider:
    """Factory to create an LLM provider based on configuration.
    
    Args:
        provider: Provider name ('anthropic', 'openai', 'groq', 'custom')
                  If None, uses OPENJCK_LLM_PROVIDER env var, defaults to 'anthropic'
        api_key: API key for the provider
                 If None, uses provider-specific env var
        base_url: Custom base URL (for OpenAI-compatible endpoints like Groq)
                 If None, uses OPENJCK_OPENAI_BASE_URL or provider default
        auto_init_pricing: If True, initialize global pricing registry from env
        **kwargs: Additional arguments passed to provider constructor
    
    Returns:
        LLMProvider instance
        
    Environment Variables:
        OPENJCK_LLM_PROVIDER - provider name
        OPENJCK_OPENAI_API_KEY - OpenAI-compatible API key
        OPENJCK_OPENAI_BASE_URL - OpenAI-compatible base URL
        OPENJCK_ANTHROPIC_API_KEY - Anthropic API key (also uses ANTHROPIC_API_KEY)
        OPENJCK_PRICING_JSON - JSON string with custom pricing overrides
        
    Examples:
        >>> # Use Anthropic (default)
        >>> provider = get_provider()
        >>> 
        >>> # Use Groq
        >>> provider = get_provider(
        ...     provider="groq",
        ...     api_key="gsk_...",
        ... )
        >>>
        >>> # Use OpenAI with custom base (another provider)
        >>> provider = get_provider(
        ...     provider="openai",
        ...     api_key="sk-...",
        ...     base_url="https://api.together.xyz/v1"
        ... )
    """
    import os
    import json
    
    # Initialize pricing from environment if requested
    if auto_init_pricing:
        pricing_json = os.getenv("OPENJCK_PRICING_JSON")
        if pricing_json:
            try:
                custom_pricing = json.loads(pricing_json)
                initialize_pricing_registry(custom_pricing)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid OPENJCK_PRICING_JSON: {e}")
        else:
            initialize_pricing_registry()
    
    # Determine provider
    prov = provider or os.getenv("OPENJCK_LLM_PROVIDER", "anthropic").lower()
    
    # Determine API key with fallbacks
    if api_key is None:
        if prov == "anthropic":
            # Support both OPENJCK_ANTHROPIC_API_KEY and legacy ANTHROPIC_API_KEY
            api_key = os.getenv("OPENJCK_ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        elif prov in ("openai", "groq", "together", "custom"):
            # Support both OPENJCK_OPENAI_API_KEY and legacy OPENAI_API_KEY
            api_key = os.getenv("OPENJCK_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
        else:
            raise ValueError(f"Unknown provider: {prov}")
    
    if not api_key:
        env_var = "OPENJCK_ANTHROPIC_API_KEY" if prov == "anthropic" else "OPENJCK_OPENAI_API_KEY"
        raise ValueError(
            f"API key required for provider '{prov}'. "
            f"Set {env_var} or pass api_key explicitly."
        )
    
    # Determine base_url (only for OpenAI-compatible providers)
    if prov in ("openai", "groq", "together", "custom"):
        base = base_url or os.getenv("OPENJCK_OPENAI_BASE_URL")
        if not base:
            # Sensible defaults based on provider
            if prov == "groq":
                base = "https://api.groq.com/openai/v1"
            elif prov == "together":
                base = "https://api.together.xyz/v1"
            elif prov == "openai":
                base = "https://api.openai.com/v1"
            else:
                raise ValueError(f"base_url required for custom provider")
        return OpenAICompatibleProvider(api_key=api_key, base_url=base, **kwargs)
    
    elif prov == "anthropic":
        # Anthropic doesn't typically use custom base_url
        base = base_url or os.getenv("OPENJCK_ANTHROPIC_BASE_URL")
        return AnthropicProvider(api_key=api_key, base_url=base, **kwargs)
    
    else:
        raise ValueError(
            f"Unsupported provider: {prov}. "
            f"Choose from: anthropic, openai, groq, together, custom"
        )
