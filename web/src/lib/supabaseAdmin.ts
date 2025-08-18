import { createClient } from '@supabase/supabase-js';

// Read and validate env vars lazily to avoid failing at import time during build
function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) environment variable');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  return { url, serviceRoleKey };
}

export function getSupabaseAdmin() {
  const { url, serviceRoleKey } = getEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function assertAdminAuth(request: Request) {
  const headerToken = request.headers.get('x-admin-token') || request.headers.get('X-Admin-Token');
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    throw new Error('ADMIN_API_TOKEN is not configured on the server');
  }
  if (!headerToken || headerToken !== expected) {
    const err = new Error('Unauthorized: missing or invalid admin token');
    // @ts-ignore add status for Next.js to use
    (err as any).status = 401;
    throw err;
  }
}
