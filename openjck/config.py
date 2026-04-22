"""
Configuration loader for OpenJCK.

Reads environment variables and provides configuration for the SDK.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class Config:
    """Global configuration for OpenJCK."""
    
    # OpenJCK server endpoint
    endpoint: Optional[str] = None
    
    # API key for OpenJCK Cloud (if using cloud mode)
    api_key: Optional[str] = None
    
    # Organization ID (for multi-org)
    org_id: Optional[str] = None
    
    # Default model for provider (if not set in ClawSession)
    default_model: Optional[str] = None


# Global config (lazy loaded)
_config: Optional[Config] = None


def load_config() -> Config:
    """Load configuration from environment variables."""
    global _config
    if _config is None:
        _config = Config(
            endpoint=os.getenv("OPENJCK_ENDPOINT") or os.getenv("OPENJCK_API_URL"),
            api_key=os.getenv("OPENJCK_API_KEY"),
            org_id=os.getenv("OPENJCK_ORG_ID"),
            default_model=os.getenv("OPENJCK_DEFAULT_MODEL"),
        )
    return _config


def reset_config() -> None:
    """Reset global config (mainly for testing)."""
    global _config
    _config = None
