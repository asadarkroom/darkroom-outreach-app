import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    // Expose Supabase vars to the browser client under NEXT_PUBLIC_ prefix
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
  },
}

export default nextConfig
