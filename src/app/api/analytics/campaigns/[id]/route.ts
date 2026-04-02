import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createAdminClient()

  // Verify ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [overviewResult, stepsResult, funnelResult] = await Promise.all([
    supabase
      .from('campaign_overview')
      .select('*')
      .eq('campaign_id', id)
      .single(),

    supabase
      .from('step_performance')
      .select('*')
      .eq('campaign_id', id)
      .order('step_number'),

    // Step funnel: % of contacts that received each step
    supabase.rpc('get_campaign_funnel', { p_campaign_id: id }).maybeSingle(),
  ])

  // Compute avg steps before reply server-side
  const { data: repliedContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('campaign_id', id)
    .eq('unenroll_reason', 'replied')

  let avgStepsBeforeReply = 0
  if (repliedContacts && repliedContacts.length > 0) {
    const stepsData = await Promise.all(
      repliedContacts.map(c =>
        supabase
          .from('scheduled_emails')
          .select('id')
          .eq('contact_id', c.id)
          .eq('status', 'drafted')
      )
    )
    const totalDrafted = stepsData.reduce((acc, r) => acc + (r.data?.length || 0), 0)
    avgStepsBeforeReply = totalDrafted / repliedContacts.length
  }

  // Error rate
  const totalScheduled = stepsResult.data?.reduce((a, s) => a + (s.total_scheduled || 0), 0) || 0
  const totalErrors = stepsResult.data?.reduce((a, s) => a + (s.error_count || 0), 0) || 0
  const errorRate = totalScheduled > 0 ? ((totalErrors / totalScheduled) * 100).toFixed(1) : 0

  return NextResponse.json({
    overview: overviewResult.data,
    steps: stepsResult.data || [],
    avg_steps_before_reply: parseFloat(avgStepsBeforeReply.toFixed(1)),
    error_rate: errorRate,
  })
}
