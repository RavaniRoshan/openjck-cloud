import { AxiosError } from "axios";
import { toast } from "sonner";

/**
 * API Error Classes
 * Standardized error types for different API failure modes
 */

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  retryAfter?: number;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; body?: unknown; retryAfter?: number }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.body = options?.body;
    this.retryAfter = options?.retryAfter;
  }
}

export class NetworkError extends Error {
  constructor(message = "Network error") {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Parse Axios error into standardized ApiError
 */
export function parseApiError(error: unknown): ApiError | NetworkError | TimeoutError | Error {
  // Already our error types
  if (error instanceof ApiError || error instanceof NetworkError || error instanceof TimeoutError) {
    return error;
  }

  // Axios errors
  if (error instanceof AxiosError) {
    // Network errors (no response)
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return new TimeoutError("Request timed out. Please try again.");
      }
      if (error.code === "ERR_NETWORK" || error.code === "ECONNREFUSED") {
        return new NetworkError("Unable to connect to server. Check your internet connection.");
      }
      return new NetworkError(error.message || "Network error occurred");
    }

    const status = error.response.status;
    const data = error.response.data as { error?: string; code?: string; message?: string };
    const message = data?.error || data?.message || error.message;
    const code = data?.code;
    const retryAfter = parseInt(error.response.headers["retry-after"] || "0", 10) || undefined;

    return new ApiError(message, status, { code, body: data, retryAfter });
  }

  // Generic errors
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * Handle API errors with appropriate toast notifications
 * Returns true if error was handled, false otherwise
 */
export function handleApiError(error: unknown, options?: { context?: string }): boolean {
  const parsed = parseApiError(error);
  const context = options?.context ? `${options.context}: ` : "";

  // Network errors
  if (parsed instanceof NetworkError) {
    toast.error("Connection lost", {
      description: parsed.message,
      duration: 5000,
    });
    return true;
  }

  // Timeout errors
  if (parsed instanceof TimeoutError) {
    toast.error("Request timed out", {
      description: parsed.message,
      duration: 5000,
    });
    return true;
  }

  // API errors with status codes
  if (parsed instanceof ApiError) {
    switch (parsed.status) {
      case 400:
        toast.error("Invalid request", {
          description: `${context}${parsed.message}`,
        });
        break;

      case 401:
        if (parsed.code === "TOKEN_EXPIRED") {
          toast.error("Session expired", {
            description: "Your session has expired. Please sign in again.",
            action: {
              label: "Sign In",
              onClick: () => window.location.href = "/login",
            },
            duration: 10000,
          });
        } else if (parsed.code === "KEY_REVOKED") {
          toast.error("API key revoked", {
            description: "Your API key has been revoked. Check your API key settings.",
          });
        } else {
          toast.error("Authentication required", {
            description: parsed.message || "Please sign in to continue.",
            action: {
              label: "Sign In",
              onClick: () => window.location.href = "/login",
            },
          });
        }
        break;

      case 403:
        if (parsed.code === "NO_ORG") {
          toast.error("No organization", {
            description: "You are not a member of any organization. Contact support.",
          });
        } else {
          toast.error("Access denied", {
            description: parsed.message || "You do not have permission to perform this action.",
          });
        }
        break;

      case 404:
        toast.error("Not found", {
          description: parsed.message || "The requested resource was not found.",
        });
        break;

      case 409:
        toast.error("Conflict", {
          description: parsed.message || "The resource already exists or is in conflict.",
        });
        break;

      case 422:
        toast.error("Validation failed", {
          description: parsed.message || "Please check your input and try again.",
        });
        break;

      case 429:
        {
          const retryMsg = parsed.retryAfter
            ? `Retry after ${parsed.retryAfter} seconds.`
            : "Please try again later.";
          toast.error("Rate limited", {
            description: `Too many requests. ${retryMsg}`,
            duration: parsed.retryAfter ? parsed.retryAfter * 1000 : 5000,
          });
        }
        break;

      case 500:
      case 502:
      case 503:
        toast.error("Server error", {
          description: "Something went wrong on our end. Please try again.",
          action: {
            label: "Retry",
            onClick: () => window.location.reload(),
          },
        });
        break;

      default:
        toast.error("Error", {
          description: parsed.message || "An unexpected error occurred.",
        });
    }
    return true;
  }

  // Unknown error
  toast.error("Error", {
    description: parsed.message || "An unexpected error occurred.",
  });
  return true;
}

/**
 * Get user-friendly error message without showing toast
 */
export function getErrorMessage(error: unknown): string {
  const parsed = parseApiError(error);

  if (parsed instanceof NetworkError) {
    return "Unable to connect to server. Check your internet connection.";
  }

  if (parsed instanceof TimeoutError) {
    return "Request timed out. Please try again.";
  }

  if (parsed instanceof ApiError) {
    return parsed.message || "An error occurred";
  }

  return parsed.message || "An unexpected error occurred";
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = parseApiError(error);

  if (parsed instanceof NetworkError || parsed instanceof TimeoutError) {
    return true;
  }

  if (parsed instanceof ApiError) {
    // Retry on server errors or rate limits
    return parsed.status >= 500 || parsed.status === 429;
  }

  return false;
}

/**
 * Extract error code from error
 */
export function getErrorCode(error: unknown): string | undefined {
  const parsed = parseApiError(error);

  if (parsed instanceof ApiError) {
    return parsed.code;
  }

  return undefined;
}

/**
 * Extract status code from error
 */
export function getErrorStatus(error: unknown): number | undefined {
  const parsed = parseApiError(error);

  if (parsed instanceof ApiError) {
    return parsed.status;
  }

  return undefined;
}
