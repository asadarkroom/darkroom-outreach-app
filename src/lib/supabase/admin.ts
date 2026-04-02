import { createClient } from '@supabase/supabase-js'

// Service-role client — only use in server-side code (API routes, cron jobs)
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
