import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { searchParams } = req.nextUrl

  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const format = searchParams.get('format') // 'csv' for export

  const supabase = createAdminClient()

  // Verify ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get total step count for this campaign
  const { count: totalSteps } = await supabase
    .from('sequence_steps')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', id)

  // Build contacts query with filters
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('enrolled_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }
  if (dateFrom) query = query.gte('enrolled_at', dateFrom)
  if (dateTo) query = query.lte('enrolled_at', dateTo)

  const { data: contacts, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich each contact with next send date and current step
  const enriched = await Promise.all(
    (contacts || []).map(async (contact) => {
      const { data: nextEmail } = await supabase
        .from('scheduled_emails')
        .select('send_date, step_id, sequence_steps(step_number)')
        .eq('contact_id', contact.id)
        .eq('status', 'pending')
        .order('send_date')
        .limit(1)
        .single()

      const { data: lastDrafted } = await supabase
        .from('scheduled_emails')
        .select('step_id, sequence_steps(step_number)')
        .eq('contact_id', contact.id)
        .eq('status', 'drafted')
        .order('send_date', { ascending: false })
        .limit(1)
        .single()

      const stepsData = lastDrafted?.sequence_steps as { step_number: number } | { step_number: number }[] | null | undefined
      const currentStepObj = Array.isArray(stepsData) ? stepsData[0] : stepsData
      const currentStep = (currentStepObj as { step_number: number } | null | undefined)?.step_number || 0
      const nextSendDate = nextEmail?.send_date || null

      return {
        ...contact,
        current_step: currentStep,
        total_steps: totalSteps || 0,
        next_send_date: nextSendDate,
      }
    })
  )

  if (format === 'csv') {
    const headers = [
      'Name', 'Company', 'Email', 'Current Step', 'Next Send Date',
      'Status', 'Reply Detected', 'Enrolled At',
    ]
    const rows = enriched.map(c => [
      `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      c.company_name || '',
      c.email,
      `${c.current_step} of ${c.total_steps}`,
      c.next_send_date || '',
      c.status,
      c.reply_detected_at ? new Date(c.reply_detected_at).toLocaleDateString() : '',
      c.enrolled_at ? new Date(c.enrolled_at).toLocaleDateString() : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts-${campaign.name}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json(enriched)
}
