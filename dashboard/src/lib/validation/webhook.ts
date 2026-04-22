/**
 * Webhook URL Validation Utilities
 * Validates webhook URLs for alerts and integrations
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
  warnings?: string[];
}

/**
 * Validate webhook URL
 * Checks protocol, format, and common issues
 */
export function validateWebhookUrl(url: string): ValidationResult {
  const warnings: string[] = [];

  if (!url || url.trim().length === 0) {
    return { valid: false, error: "Webhook URL is required" };
  }

  const normalized = url.trim();

  // Check for valid URL format
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Check protocol
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { valid: false, error: "URL must use HTTP or HTTPS protocol" };
  }

  // Warn about HTTP (non-secure)
  if (parsed.protocol === "http:") {
    warnings.push("Using HTTP instead of HTTPS is not recommended");
  }

  // Check for localhost/private IPs
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    warnings.push("Localhost URLs will not work in production");
  }

  // Check for private IP ranges
  if (isPrivateIp(hostname)) {
    warnings.push("Private IP addresses will not work in production");
  }

  // Check for common webhook path patterns
  if (!parsed.pathname || parsed.pathname === "/") {
    warnings.push("Webhook URL has no path component");
  }

  // Check URL length
  if (normalized.length > 2048) {
    return { valid: false, error: "URL is too long (max 2048 characters)" };
  }

  // Check for credentials in URL (security risk)
  if (parsed.username || parsed.password) {
    warnings.push("URL contains credentials which is a security risk");
  }

  return {
    valid: true,
    normalized,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Check if hostname is a private IP
 */
function isPrivateIp(hostname: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
    /^0\./,
  ];

  for (const range of privateRanges) {
    if (range.test(hostname)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate Slack webhook URL
 * Basic format validation for Slack webhooks
 */
export function validateSlackWebhook(url: string): ValidationResult {
  const baseValidation = validateWebhookUrl(url);

  if (!baseValidation.valid) {
    return baseValidation;
  }

  const normalized = baseValidation.normalized!;
  const warnings = [...(baseValidation.warnings || [])];

  // Check for Slack webhook format
  if (!normalized.includes("hooks.slack.com")) {
    warnings.push("URL does not appear to be a valid Slack webhook");
  }

  return {
    valid: true,
    normalized,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate Discord webhook URL
 * Basic format validation for Discord webhooks
 */
export function validateDiscordWebhook(url: string): ValidationResult {
  const baseValidation = validateWebhookUrl(url);

  if (!baseValidation.valid) {
    return baseValidation;
  }

  const normalized = baseValidation.normalized!;
  const warnings = [...(baseValidation.warnings || [])];

  // Check for Discord webhook format
  const discordWebhookPattern = /discord\.com\/api\/webhooks\/\d+\/[\w-]+/;
  if (!discordWebhookPattern.test(normalized)) {
    warnings.push("URL does not match Discord webhook format");
  }

  return {
    valid: true,
    normalized,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Normalize webhook URL
 * Removes trailing slashes and whitespace
 */
export function normalizeWebhookUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Check if webhook URL is from a known service
 */
export function getWebhookService(url: string): "slack" | "discord" | "teams" | "custom" | null {
  const lower = url.toLowerCase();

  if (lower.includes("hooks.slack.com")) {
    return "slack";
  }
  if (lower.includes("discord.com/api/webhooks")) {
    return "discord";
  }
  if (lower.includes("office.com/webhook") || lower.includes("outlook.office.com")) {
    return "teams";
  }
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return "custom";
  }

  return null;
}
