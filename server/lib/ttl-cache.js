/**
 * TTL Cache Implementation
 * Used for brute force protection and rate limiting
 * Entries expire after a specified TTL
 */

export class TtlCache {
  /**
   * @param {Object} options
   * @param {number} options.ttl - Time to live in milliseconds (default: 60000)
   * @param {number} options.maxSize - Maximum number of entries (default: 10000)
   * @param {Function} options.onExpire - Callback when entry expires (optional)
   */
  constructor(options = {}) {
    this.ttl = options.ttl || 60000; // 1 minute default
    this.maxSize = options.maxSize || 10000;
    this.onExpire = options.onExpire || null;
    this.cache = new Map();
    this.timers = new Map();

    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a value in the cache with TTL
   */
  set(key, value, customTtl) {
    // Clear existing timer if any
    this._clearTimer(key);

    // Check max size and evict oldest if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }

    const ttl = customTtl || this.ttl;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, { value, expiresAt });

    // Set expiration timer
    const timer = setTimeout(() => {
      const entry = this.cache.get(key);
      if (entry && Date.now() >= entry.expiresAt) {
        this.delete(key);
        if (this.onExpire) {
          this.onExpire(key, entry.value);
        }
      }
    }, ttl);

    this.timers.set(key, timer);

    return this;
  }

  /**
   * Check if a key exists in the cache (and hasn't expired)
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key) {
    this._clearTimer(key);
    return this.cache.delete(key);
  }

  /**
   * Increment a counter value
   * Creates entry if doesn't exist
   */
  increment(key, amount = 1, customTtl) {
    const current = this.get(key) || 0;
    const next = current + amount;
    this.set(key, next, customTtl);
    return next;
  }

  /**
   * Decrement a counter value
   * Deletes if value reaches 0 or below
   */
  decrement(key, amount = 1, customTtl) {
    const current = this.get(key) || 0;
    const next = current - amount;

    if (next <= 0) {
      this.delete(key);
      return 0;
    }

    this.set(key, next, customTtl);
    return next;
  }

  /**
   * Get all keys in the cache
   */
  keys() {
    this.cleanup();
    return Array.from(this.cache.keys());
  }

  /**
   * Get the size of the cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Clear all entries
   */
  clear() {
    for (const key of this.cache.keys()) {
      this._clearTimer(key);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
        if (this.onExpire) {
          this.onExpire(key, entry.value);
        }
      }
    }
  }

  /**
   * Clear the timer for a key
   */
  _clearTimer(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Destroy the cache and stop cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

/**
 * Create a rate limiter using TTL cache
 * @param {Object} options
 * @param {number} options.maxRequests - Maximum requests per window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.blockDurationMs - How long to block after exceeding limit
 */
export function createRateLimiter(options) {
  const { maxRequests = 100, windowMs = 60000, blockDurationMs = 60000 } = options;

  const cache = new TtlCache({ ttl: windowMs });
  const blockCache = new TtlCache({ ttl: blockDurationMs });

  return {
    /**
     * Check if request is allowed
     * Returns { allowed, remaining, resetTime, blocked }
     */
    check(key) {
      // Check if blocked
      if (blockCache.has(key)) {
        return {
          allowed: false,
          blocked: true,
          remaining: 0,
          resetTime: blockCache.get(key),
        };
      }

      const count = cache.get(key) || 0;
      const remaining = Math.max(0, maxRequests - count);

      if (count >= maxRequests) {
        // Block the key
        blockCache.set(key, Date.now() + blockDurationMs, blockDurationMs);
        return {
          allowed: false,
          blocked: true,
          remaining: 0,
          resetTime: Date.now() + blockDurationMs,
        };
      }

      return {
        allowed: true,
        blocked: false,
        remaining: remaining - 1,
        resetTime: Date.now() + windowMs,
      };
    },

    /**
     * Record a request
     */
    record(key) {
      cache.increment(key, 1, windowMs);
    },

    /**
     * Reset the counter for a key
     */
    reset(key) {
      cache.delete(key);
      blockCache.delete(key);
    },

    /**
     * Get current count for a key
     */
    getCount(key) {
      return cache.get(key) || 0;
    },

    /**
     * Clean up resources
     */
    destroy() {
      cache.destroy();
      blockCache.destroy();
    },
  };
}
