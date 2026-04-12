import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  { db: { schema: 'public' } }
);

export function createUserClient(accessToken) {
  return createClient(
    process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRt1pA8MD_RlK3OeDgKz7gVq4qF0qF0qF0qF0qF0qF0',
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  );
}
