import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()
  const userId = session.user.id

  const [globalResult, trendsResult, campaignOverviewResult] = await Promise.all([
    supabase
      .from('global_analytics')
      .select('*')
      .eq('user_id', userId)
      .single(),

    supabase
      .from('weekly_reply_trend')
      .select('week_start, reply_count')
      .eq('user_id', userId)
      .order('week_start'),

    supabase
      .from('campaign_overview')
      .select('*')
      .eq('user_id', userId)
      .order('reply_rate', { ascending: false }),
  ])

  const global = globalResult.data || {
    total_enrolled: 0,
    total_drafted: 0,
    overall_reply_rate: 0,
    active_campaigns: 0,
  }

  const topCampaign = campaignOverviewResult.data?.[0] || null

  return NextResponse.json({
    ...global,
    weekly_trend: trendsResult.data || [],
    top_campaign: topCampaign,
  })
}
