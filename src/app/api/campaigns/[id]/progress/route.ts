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
    .select('id')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get all scheduled emails with step info and error messages
  const { data: emails, error: emailsError } = await supabase
    .from('scheduled_emails')
    .select(`
      id, status, send_date, error_message, contact_id,
      sequence_steps(step_number, day_offset)
    `)
    .eq('campaign_id', id)
    .order('send_date', { ascending: true })

  if (emailsError) return NextResponse.json({ error: emailsError.message }, { status: 500 })

  // Get enrolled contacts
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, company_name, status, enrolled_at')
    .eq('campaign_id', id)
    .not('enrolled_at', 'is', null)
    .order('enrolled_at', { ascending: true })

  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 })

  // Aggregate step progress
  const stepMap: Record<string, {
    step_number: number
    day_offset: number
    send_date: string
    total: number
    drafted: number
    pending: number
    error: number
    errors: string[]
  }> = {}

  for (const email of (emails || []) as unknown as Array<{
    id: string; status: string; send_date: string; error_message: string | null; contact_id: string
    sequence_steps: { step_number: number; day_offset: number }
  }>) {
    const key = `${email.sequence_steps.step_number}-${email.send_date}`
    if (!stepMap[key]) {
      stepMap[key] = {
        step_number: email.sequence_steps.step_number,
        day_offset: email.sequence_steps.day_offset,
        send_date: email.send_date,
        total: 0,
        drafted: 0,
        pending: 0,
        error: 0,
        errors: [],
      }
    }
    stepMap[key].total++
    if (email.status === 'drafted') stepMap[key].drafted++
    else if (email.status === 'pending') stepMap[key].pending++
    else if (email.status === 'error') {
      stepMap[key].error++
      if (email.error_message) stepMap[key].errors.push(email.error_message)
    }
  }

  const stepProgress = Object.values(stepMap).sort((a, b) =>
    a.send_date.localeCompare(b.send_date) || a.step_number - b.step_number
  )

  const today = new Date().toISOString().split('T')[0]
  const nextSteps = stepProgress.filter(s => s.send_date > today && s.pending > 0)

  return NextResponse.json({
    stepProgress,
    enrolledContacts: contacts || [],
    nextSteps,
  })
}
