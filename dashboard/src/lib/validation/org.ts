/**
 * Organization Validation Utilities
 * Validates organization names, slugs, and settings
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Organization name constraints
 */
const ORG_NAME_MIN_LENGTH = 2;
const ORG_NAME_MAX_LENGTH = 100;

/**
 * Validate organization name
 * Checks length, trimming, and forbidden characters
 */
export function validateOrgName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Organization name is required" };
  }

  const normalized = name.trim();

  // Check minimum length
  if (normalized.length < ORG_NAME_MIN_LENGTH) {
    return {
      valid: false,
      error: `Organization name must be at least ${ORG_NAME_MIN_LENGTH} characters`,
    };
  }

  // Check maximum length
  if (normalized.length > ORG_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Organization name must be less than ${ORG_NAME_MAX_LENGTH} characters`,
    };
  }

  // Check for control characters
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { valid: false, error: "Organization name contains invalid characters" };
  }

  // Check for excessive whitespace
  if (/\s{2,}/.test(normalized)) {
    return { valid: false, error: "Organization name contains excessive whitespace" };
  }

  // Check for leading/trailing special characters
  if (/^[\s\-_]+|[\s\-_]+$/.test(normalized)) {
    return {
      valid: false,
      error: "Organization name cannot start or end with spaces, hyphens, or underscores",
    };
  }

  return { valid: true, normalized };
}

/**
 * Organization slug constraints
 */
const ORG_SLUG_MIN_LENGTH = 2;
const ORG_SLUG_MAX_LENGTH = 50;
const ORG_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Validate organization slug
 * Slugs are used in URLs and must be URL-safe
 */
export function validateOrgSlug(slug: string): ValidationResult {
  if (!slug || slug.trim().length === 0) {
    return { valid: false, error: "Organization slug is required" };
  }

  const normalized = slug.trim().toLowerCase();

  // Check minimum length
  if (normalized.length < ORG_SLUG_MIN_LENGTH) {
    return {
      valid: false,
      error: `Organization slug must be at least ${ORG_SLUG_MIN_LENGTH} characters`,
    };
  }

  // Check maximum length
  if (normalized.length > ORG_SLUG_MAX_LENGTH) {
    return {
      valid: false,
      error: `Organization slug must be less than ${ORG_SLUG_MAX_LENGTH} characters`,
    };
  }

  // Check pattern (lowercase alphanumeric with hyphens)
  if (!ORG_SLUG_PATTERN.test(normalized)) {
    return {
      valid: false,
      error: "Organization slug can only contain lowercase letters, numbers, and hyphens",
    };
  }

  // Check for consecutive hyphens
  if (/--/.test(normalized)) {
    return { valid: false, error: "Organization slug cannot contain consecutive hyphens" };
  }

  return { valid: true, normalized };
}

/**
 * Generate a slug from an organization name
 */
export function generateOrgSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, ORG_SLUG_MAX_LENGTH);
}

/**
 * Validate project name
 * Used for session/project grouping
 */
export function validateProjectName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: true }; // Optional field
  }

  const normalized = name.trim();

  if (normalized.length > 100) {
    return { valid: false, error: "Project name must be less than 100 characters" };
  }

  // Allow most characters but disallow control characters
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { valid: false, error: "Project name contains invalid characters" };
  }

  return { valid: true, normalized };
}

/**
 * Validate claw/agent name
 */
export function validateClawName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Agent name is required" };
  }

  const normalized = name.trim();

  if (normalized.length > 100) {
    return { valid: false, error: "Agent name must be less than 100 characters" };
  }

  // Allow most characters but disallow control characters
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { valid: false, error: "Agent name contains invalid characters" };
  }

  return { valid: true, normalized };
}

/**
 * Validate user display name
 */
export function validateDisplayName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: true }; // Optional
  }

  const normalized = name.trim();

  if (normalized.length > 50) {
    return { valid: false, error: "Display name must be less than 50 characters" };
  }

  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { valid: false, error: "Display name contains invalid characters" };
  }

  return { valid: true, normalized };
}

/**
 * Validate email format (basic check)
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { valid: false, error: "Email is required" };
  }

  const normalized = email.trim().toLowerCase();

  // Basic email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalized)) {
    return { valid: false, error: "Invalid email format" };
  }

  if (normalized.length > 254) {
    return { valid: false, error: "Email is too long" };
  }

  return { valid: true, normalized };
}
