import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const userId = session.user.id
  const today = new Date().toISOString().split('T')[0]

  const [todayQueueResult, campaignsResult, gmailStatusResult, errorResult] = await Promise.all([
    supabase
      .from('scheduled_emails')
      .select('status')
      .eq('user_id', userId)
      .eq('send_date', today),

    supabase
      .from('campaign_overview')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('gmail_tokens')
      .select('connected_at')
      .eq('user_id', userId)
      .single(),

    supabase
      .from('scheduled_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'error'),
  ])

  const todayQueue = todayQueueResult.data || []
  const queueSummary = {
    total: todayQueue.length,
    pending: todayQueue.filter(e => e.status === 'pending').length,
    drafted: todayQueue.filter(e => e.status === 'drafted').length,
    error: todayQueue.filter(e => e.status === 'error').length,
  }

  return NextResponse.json({
    today_queue: queueSummary,
    campaigns: campaignsResult.data || [],
    gmail_connected: !!gmailStatusResult.data,
    error_count: errorResult.count || 0,
  })
}
