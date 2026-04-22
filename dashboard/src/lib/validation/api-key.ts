/**
 * API Key Validation Utilities
 * Validates Anthropic API keys and other provider keys
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Validate Anthropic API key format
 * Anthropic keys start with "sk-ant-" and have a specific format
 */
export function validateAnthropicKey(key: string): ValidationResult {
  // Check if key is provided
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "API key is required" };
  }

  const normalized = key.trim();

  // Check for whitespace
  if (/\s/.test(normalized)) {
    return { valid: false, error: "API key contains whitespace" };
  }

  // Check prefix
  if (!normalized.startsWith("sk-ant-")) {
    return { valid: false, error: "API key must start with 'sk-ant-'" };
  }

  // Check minimum length
  if (normalized.length < 20) {
    return { valid: false, error: "API key is too short" };
  }

  // Check maximum length (Anthropic keys are typically < 200 chars)
  if (normalized.length > 500) {
    return { valid: false, error: "API key is too long" };
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    return { valid: false, error: "API key contains invalid characters" };
  }

  return { valid: true, normalized };
}

/**
 * Validate OpenAI API key format
 */
export function validateOpenAIKey(key: string): ValidationResult {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "API key is required" };
  }

  const normalized = key.trim();

  if (/\s/.test(normalized)) {
    return { valid: false, error: "API key contains whitespace" };
  }

  if (!normalized.startsWith("sk-")) {
    return { valid: false, error: "API key must start with 'sk-'" };
  }

  if (normalized.length < 20) {
    return { valid: false, error: "API key is too short" };
  }

  return { valid: true, normalized };
}

/**
 * Validate generic API key
 * More lenient validation for other providers
 */
export function validateGenericApiKey(key: string): ValidationResult {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "API key is required" };
  }

  const normalized = key.trim();

  if (normalized.length < 8) {
    return { valid: false, error: "API key is too short" };
  }

  if (normalized.length > 1000) {
    return { valid: false, error: "API key is too long" };
  }

  return { valid: true, normalized };
}

/**
 * Get a safe prefix of an API key for display
 * Returns first n characters followed by "..."
 */
export function getKeyPrefix(key: string, length: number = 10): string {
  if (!key || key.length <= length + 3) {
    return "...";
  }
  return `${key.slice(0, length)}...`;
}

/**
 * Mask an API key for display in UI
 * Shows only first and last few characters
 */
export function maskApiKey(key: string, visibleStart: number = 7, visibleEnd: number = 4): string {
  if (!key || key.length <= visibleStart + visibleEnd + 3) {
    return "***";
  }
  return `${key.slice(0, visibleStart)}...${key.slice(-visibleEnd)}`;
}

/**
 * Detect key provider from key format
 */
export function detectKeyProvider(key: string): "anthropic" | "openai" | "unknown" {
  if (key.startsWith("sk-ant-")) {
    return "anthropic";
  }
  if (key.startsWith("sk-") && !key.startsWith("sk-ant-")) {
    return "openai";
  }
  return "unknown";
}
