import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGmailProfile } from '@/lib/gmail/drafts'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('gmail_tokens')
    .select('connected_at, token_expiry')
    .eq('user_id', session.user.id)
    .single()

  if (!data) {
    return NextResponse.json({ connected: false })
  }

  // Try to get the actual Gmail address to confirm token works
  const profile = await getGmailProfile(session.user.id)

  return NextResponse.json({
    connected: !!profile,
    email: profile?.email,
    connected_at: data.connected_at,
  })
}
