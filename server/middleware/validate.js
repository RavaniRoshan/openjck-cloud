/**
 * Input Validation Middleware
 * Validates event payloads and API inputs
 */

/**
 * Validate event payload
 * Checks for required fields, sanitizes inputs, prevents injection
 */
export function validateEventPayload(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      error: 'Request body must be a JSON object',
      code: 'INVALID_BODY'
    });
  }

  // Validate protocol version
  if (body.protocol_version && body.protocol_version !== '1.0') {
    return res.status(400).json({
      error: `Unsupported protocol version: ${body.protocol_version}`,
      code: 'UNSUPPORTED_PROTOCOL',
      supported: ['1.0']
    });
  }

  // Validate timestamp is reasonable (within 5 minutes of now)
  const eventTime = new Date(body.timestamp || Date.now());
  const now = new Date();
  const diffMinutes = Math.abs(now.getTime() - eventTime.getTime()) / 60000;

  if (diffMinutes > 5) {
    return res.status(400).json({
      error: 'Event timestamp is too old or too far in the future',
      code: 'INVALID_TIMESTAMP',
      maxAgeMinutes: 5
    });
  }

  // Validate session_id format (prevent path traversal)
  if (!body.session_id || typeof body.session_id !== 'string') {
    return res.status(400).json({
      error: 'session_id is required',
      code: 'MISSING_SESSION_ID'
    });
  }

  // Prevent path traversal in session_id
  if (body.session_id.includes('..') || body.session_id.includes('/') || body.session_id.includes('\\')) {
    return res.status(400).json({
      error: 'Invalid session_id format',
      code: 'INVALID_SESSION_ID'
    });
  }

  if (body.session_id.length > 128) {
    return res.status(400).json({
      error: 'session_id is too long (max 128 characters)',
      code: 'SESSION_ID_TOO_LONG'
    });
  }

  // Validate claw_name
  if (body.claw_name && body.claw_name.length > 100) {
    // Truncate instead of rejecting
    body.claw_name = body.claw_name.slice(0, 100);
  }

  // Validate cost fields
  if (body.total_cost_usd !== undefined) {
    if (typeof body.total_cost_usd !== 'number' || body.total_cost_usd < 0) {
      return res.status(400).json({
        error: 'total_cost_usd must be a non-negative number',
        code: 'INVALID_COST'
      });
    }
  }

  if (body.total_input_tokens !== undefined) {
    if (typeof body.total_input_tokens !== 'number' || body.total_input_tokens < 0 || !Number.isInteger(body.total_input_tokens)) {
      return res.status(400).json({
        error: 'total_input_tokens must be a non-negative integer',
        code: 'INVALID_TOKENS'
      });
    }
  }

  if (body.total_output_tokens !== undefined) {
    if (typeof body.total_output_tokens !== 'number' || body.total_output_tokens < 0 || !Number.isInteger(body.total_output_tokens)) {
      return res.status(400).json({
        error: 'total_output_tokens must be a non-negative integer',
        code: 'INVALID_TOKENS'
      });
    }
  }

  // Sanitize text fields
  if (body.project) {
    body.project = body.project.trim().slice(0, 100);
  }

  next();
}

/**
 * Validate batch event payload
 * Checks batch size limits and validates each event
 */
export function validateBatchPayload(req, res, next) {
  const { events } = req.body;

  if (!Array.isArray(events)) {
    return res.status(400).json({
      error: 'events must be an array',
      code: 'INVALID_BATCH_FORMAT'
    });
  }

  // Batch size limit
  if (events.length > 100) {
    return res.status(400).json({
      error: 'Batch size exceeds maximum of 100 events',
      code: 'BATCH_TOO_LARGE',
      maxSize: 100,
      received: events.length
    });
  }

  if (events.length === 0) {
    return res.status(400).json({
      error: 'Batch cannot be empty',
      code: 'EMPTY_BATCH'
    });
  }

  // Check for duplicate session_ids in batch
  const sessionIds = events.map(e => e.session_id).filter(Boolean);
  const uniqueSessionIds = new Set(sessionIds);

  if (sessionIds.length !== uniqueSessionIds.size) {
    return res.status(400).json({
      error: 'Duplicate session_ids in batch',
      code: 'DUPLICATE_SESSION_IDS'
    });
  }

  next();
}

/**
 * Validate query parameters
 */
export function validateQueryParams(allowedParams = []) {
  return (req, res, next) => {
    const unknownParams = Object.keys(req.query).filter(key => !allowedParams.includes(key));

    if (unknownParams.length > 0) {
      return res.status(400).json({
        error: `Unknown query parameters: ${unknownParams.join(', ')}`,
        code: 'INVALID_QUERY_PARAMS',
        allowed: allowedParams
      });
    }

    next();
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') return '';

  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
}

/**
 * Validate UUID format
 */
export function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Middleware to validate UUID parameter
 */
export function validateUUIDParam(paramName) {
  return (req, res, next) => {
    const value = req.params[paramName];

    if (!value) {
      return res.status(400).json({
        error: `${paramName} is required`,
        code: 'MISSING_PARAM'
      });
    }

    if (!isValidUUID(value)) {
      return res.status(400).json({
        error: `Invalid ${paramName} format`,
        code: 'INVALID_UUID'
      });
    }

    next();
  };
}
