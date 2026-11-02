import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env.js";

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const env = getEnv();
    _supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _supabaseAdmin;
}

/**
 * Server-side Supabase client using the service-role key.
 * NEVER expose this to the frontend. Used for admin operations, RLS-bypass
 * server-side tasks, and generating signed URLs for private storage.
 *
 * Lazily initialized on first access so environment variables can be set
 * before the client is constructed (important for testing).
 */
export const supabaseAdmin: SupabaseClient = new Proxy(
  {} as SupabaseClient,
  {
    get(_target, prop: string) {
      return (getSupabaseAdmin() as any)[prop];
    },
  },
);

/**
 * Create a Supabase client scoped to an end user's JWT.
 * The API verifies the user's Supabase Auth JWT on each request via
 * supabase.auth.getUser(). The frontend (browser) holds the anon key and
 * manages sessions; the API never sees passwords or service-role secrets.
 */
export function supabaseUser(accessToken: string) {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
