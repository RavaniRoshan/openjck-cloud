"""
Loop detection for OpenJCK.

Provides a standalone LoopDetector that tracks tool calls in a sliding window
and detects when the same tool with the same input appears multiple times.
"""

import collections
import hashlib
import json
from dataclasses import dataclass
from typing import Any, List, Tuple, Deque


@dataclass
class LoopDetectionResult:
    """Result of a loop detection check."""
    detected: bool
    fingerprint: str | None
    count: int
    detail: str = ""

    def __str__(self) -> str:
        if self.detected:
            return f"Loop detected: {self.fingerprint} appeared {self.count} times"
        return "No loop detected"


class LoopDetector:
    """
    Detects loops in tool usage by tracking a sliding window of fingerprints.
    
    A loop is defined as the same tool+input appearing >= threshold times within
    the last window_size tool calls.
    """
    
    def __init__(self, window_size: int = 10, threshold: int = 3):
        self._window: Deque[Tuple[str, str]] = collections.deque(maxlen=window_size)
        self._threshold = threshold
    
    def check(self, tool_uses: List[Any]) -> LoopDetectionResult:
        """
        Check if the current tool calls indicate a loop.
        
        Args:
            tool_uses: List of tool_use blocks from Claude response
            
        Returns:
            LoopDetectionResult with detection status and details
        """
        for tool_use in tool_uses:
            tool_name = getattr(tool_use, 'name', 'unknown')
            tool_input = getattr(tool_use, 'input', {})
            fingerprint = self.hash_input(tool_input)
            key = (tool_name, fingerprint)
            
            self._window.append(key)
        
        # Count occurrences in the current window
        if self._window:
            counts = collections.Counter(self._window)
            for (tool_name, fp), count in counts.items():
                if count >= self._threshold:
                    detail = f"Tool '{tool_name}' with input fingerprint '{fp}' appeared {count} times in last {len(self._window)} calls"
                    return LoopDetectionResult(
                        detected=True,
                        fingerprint=f"{tool_name}:{fp}",
                        count=count,
                        detail=detail
                    )
        
        return LoopDetectionResult(detected=False, fingerprint=None, count=len(self._window))
    
    def hash_input(self, tool_input: dict) -> str:
        """
        Create a stable 8-character MD5 hash of the tool input.
        
        The input is serialized as JSON with sorted keys to ensure
        identical inputs produce identical hashes regardless of key order.
        """
        try:
            canonical = json.dumps(tool_input, sort_keys=True, separators=(',', ':'))
            return hashlib.md5(canonical.encode()).hexdigest()[:8]
        except Exception:
            # Fallback for non-serializable inputs
            return hashlib.md5(str(tool_input).encode()).hexdigest()[:8]
    
    def clear(self) -> None:
        """Clear the sliding window (for testing or session reset)."""
        self._window.clear()
    
    @property
    def window_size(self) -> int:
        """Return the configured window size."""
        return self._window.maxlen or 10
    
    @property
    def threshold(self) -> int:
        """Return the detection threshold."""
        return self._threshold
