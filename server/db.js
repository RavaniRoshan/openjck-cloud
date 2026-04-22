import { createClient } from '@supabase/supabase-js';

// Client creation timestamp for TTL
let clientCreatedAt = Date.now();
const CLIENT_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Create Supabase admin client
 * Recreated periodically to prevent connection staleness
 */
function createAdminClient() {
  clientCreatedAt = Date.now();
  return createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    {
      db: { schema: 'public' },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Export the admin client
export let supabaseAdmin = createAdminClient();

/**
 * Check if client needs recreation (TTL expired)
 * Call this before critical operations
 */
export function checkClientHealth() {
  const age = Date.now() - clientCreatedAt;
  if (age > CLIENT_TTL) {
    console.log('[DB] Recreating Supabase client after TTL');
    supabaseAdmin = createAdminClient();
  }
}

/**
 * Database query wrapper with timeout and retry
 * @param {Function} queryFn - Query function
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms (default: 10000)
 * @param {number} options.retries - Number of retries (default: 2)
 */
export async function dbQuery(queryFn, options = {}) {
  const timeout = options.timeout || 10000;
  const retries = options.retries || 2;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Check client health before query
      checkClientHealth();

      // Wrap query in timeout
      const queryPromise = queryFn(supabaseAdmin);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), timeout)
      );

      const result = await Promise.race([queryPromise, timeoutPromise]);

      // Check for Supabase errors
      if (result.error) {
        throw result.error;
      }

      return result;
    } catch (err) {
      lastError = err;

      // Don't retry on client errors
      if (err.code === 'PGRST116' || err.code === '22P02') {
        throw err;
      }

      // Recreate client on connection errors
      if (err.message?.includes('connection') || err.message?.includes('timeout')) {
        console.warn(`[DB] Connection error on attempt ${attempt + 1}, recreating client`);
        supabaseAdmin = createAdminClient();
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError;
}

/**
 * Check database health
 * Returns health status and latency
 */
export async function checkDbHealth() {
  const start = Date.now();
  try {
    const { data, error } = await supabaseAdmin
      .from('claw_sessions')
      .select('id')
      .limit(1);

    if (error) throw error;

    return {
      healthy: true,
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      healthy: false,
      error: err.message,
      latency: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Create user-scoped client
 */
export function createUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRt1pA8MD_RlK3OeDgKz7gVq4qF0qF0qF0qF0qF0qF0',
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
