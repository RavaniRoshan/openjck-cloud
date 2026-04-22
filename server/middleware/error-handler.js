/**
 * Global Error Handler Middleware
 * Normalizes all error responses and handles unhandled rejections
 */

/**
 * Sanitize error message for production
 * Removes stack traces and sensitive information
 */
function sanitizeErrorMessage(err, isDev = false) {
  // In development, allow full error details
  if (isDev) {
    return err.message;
  }

  // In production, sanitize error messages
  const message = err.message || "Internal server error";

  // Don't expose database errors
  if (message.includes("password") ||
      message.includes("auth") ||
      message.includes("permission denied") ||
      message.includes("relation") ||
      message.includes("column")) {
    return "Internal server error";
  }

  return message;
}

/**
 * Main error handler middleware
 * Must be mounted LAST in the Express app
 */
export function errorHandler(err, req, res, next) {
  // Log the error internally with timestamp
  const timestamp = new Date().toISOString();
  const errorId = `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  console.error("[ERROR]", {
    timestamp,
    errorId,
    method: req.method,
    path: req.path,
    status: err.status || err.statusCode,
    code: err.code,
    message: err.message,
    stack: err.stack,
    user: req.user?.id,
    org: req.orgId,
  });

  // Determine if we're in development
  const isDev = process.env.NODE_ENV === "development";

  // Normalize the error response
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");
  const message = sanitizeErrorMessage(err, isDev);

  // Build response
  const response = {
    error: message,
    code,
    errorId,
  };

  // Add debug info in development only
  if (isDev) {
    response.debug = {
      stack: err.stack?.split("\n").slice(0, 5),
      originalMessage: err.message,
    };
  }

  // Don't send response if already sent
  if (res.headersSent) {
    console.error("[ERROR] Response already sent, cannot send error", { errorId });
    return;
  }

  res.status(status).json(response);
}

/**
 * Handle 404 - Not Found
 * Mounted before the main error handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    path: req.path,
  });
}

/**
 * Setup unhandled rejection handler
 * Call this in your server.js before starting the server
 */
export function setupUnhandledRejectionHandler() {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[UNHANDLED REJECTION]", {
      timestamp: new Date().toISOString(),
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });

    // Application should continue, but log for monitoring
    // Consider implementing graceful shutdown for critical errors
  });

  process.on("uncaughtException", (err) => {
    console.error("[UNCAUGHT EXCEPTION]", {
      timestamp: new Date().toISOString(),
      error: err.message,
      stack: err.stack,
    });

    // For uncaught exceptions, we should exit gracefully
    // Give time for logs to flush
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

/**
 * Async handler wrapper
 * Automatically catches errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
