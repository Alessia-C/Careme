import { createClient } from '@supabase/supabase-js';

// The server has no storage and must not keep or refresh sessions between
// requests: every request builds its own client.
const serverAuthOptions = {
  persistSession: false,
  autoRefreshToken: false,
};

const RATE_LIMIT_CODES = [
  'over_email_send_rate_limit',
  'over_request_rate_limit',
];

// Supabase limits are project-wide, not a server fault: callers answer 429
// instead of a 500 that would also pollute Sentry.
export function isRateLimitError(error: { code?: string } | null): boolean {
  return error?.code !== undefined && RATE_LIMIT_CODES.includes(error.code);
}

function readSupabaseEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return { supabaseUrl, supabaseAnonKey };
}

// For anonymous actions (signup, login): no user, so RLS sees auth.uid() null.
export function createAnonClient() {
  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: serverAuthOptions,
  });
}

// Acts as the caller: Postgres receives the JWT, so RLS always applies.
// Never cache the result at module level: serverless instances are reused
// across requests and another user's token could leak.
export function createUserClient(accessToken: string) {
  const { supabaseUrl, supabaseAnonKey } = readSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: serverAuthOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
