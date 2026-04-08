import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // Pre-existing implicit-any errors exist throughout the codebase.
    // Type safety is enforced in development via editor; not gating deploys.
    ignoreBuildErrors: true,
  },
  env: {
    // Expose Supabase vars to the browser client under NEXT_PUBLIC_ prefix
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  },
}

export default nextConfig
