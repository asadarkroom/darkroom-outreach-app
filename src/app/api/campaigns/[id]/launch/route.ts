import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDraftsForDate } from '@/lib/drafts/generate'
import { checkDealExists } from '@/lib/hubspot/client'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createAdminClient()

  // Verify campaign exists
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Only campaign creator or admin can launch
  const role = session.user.role as string
  if (role !== 'admin' && campaign.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Campaign is already launched' }, { status: 400 })
  }

  // Get sequence steps
  const { data: steps, error: stepsError } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('campaign_id', id)
    .order('step_number')

  if (stepsError || !steps?.length) {
    return NextResponse.json({ error: 'Campaign has no sequence steps' }, { status: 400 })
  }

  // Get unenrolled contacts for this campaign
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('campaign_id', id)
    .is('enrolled_at', null)

  if (contactsError) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }

  if (!contacts?.length) {
    return NextResponse.json({ error: 'No contacts to enroll' }, { status: 400 })
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const scheduledEmailRows = []
  const contactUpdates = []
  let skippedDeal = 0

  for (const contact of contacts) {
    if (!contact.email) {
      console.warn(`Skipping contact ${contact.id} — no email address`)
      continue
    }

    // Skip contacts whose company already has an active HubSpot deal
    if (contact.company_name) {
      const dealExists = await checkDealExists(contact.company_name).catch(() => false)
      if (dealExists) {
        console.warn(`Skipping contact ${contact.id} (${contact.company_name}) — existing HubSpot deal`)
        skippedDeal++
        continue
      }
    }

    contactUpdates.push({
      id: contact.id,
      enrolled_at: today.toISOString(),
      status: 'active',
    })

    for (const step of steps) {
      const sendDate = new Date(today)
      sendDate.setUTCDate(sendDate.getUTCDate() + step.day_offset)

      scheduledEmailRows.push({
        contact_id: contact.id,
        step_id: step.id,
        campaign_id: id,
        user_id: session.user.id,
        send_date: sendDate.toISOString().split('T')[0],
        status: 'pending',
      })
    }
  }

  // Bulk enroll contacts
  for (const update of contactUpdates) {
    await supabase.from('contacts').update({
      enrolled_at: update.enrolled_at,
      status: update.status,
    }).eq('id', update.id)
  }

  // Insert scheduled emails
  const { error: scheduleError } = await supabase
    .from('scheduled_emails')
    .insert(scheduledEmailRows)

  if (scheduleError) {
    return NextResponse.json({ error: 'Failed to schedule emails: ' + scheduleError.message }, { status: 500 })
  }

  // Mark campaign as active
  await supabase.from('campaigns').update({
    status: 'active',
    launched_at: today.toISOString(),
  }).eq('id', id)

  // Log analytics events for enrollments
  const enrollEvents = contactUpdates.map(c => ({
    user_id: session.user.id,
    campaign_id: id,
    contact_id: c.id,
    event_type: 'enrolled',
    metadata: { enrolled_at: c.enrolled_at },
  }))
  await supabase.from('analytics_events').insert(enrollEvents)

  // Immediately draft Day 0 emails
  const todayStr = today.toISOString().split('T')[0]
  let draftResults = { processed: 0, drafted: 0, skipped: 0, errors: 0 }
  try {
    draftResults = await generateDraftsForDate(todayStr, id)
  } catch (err) {
    console.error('Day 0 draft generation failed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({
    success: true,
    enrolled: contactUpdates.length,
    skipped_existing_deal: skippedDeal,
    scheduled: scheduledEmailRows.length,
    drafts: draftResults,
  })
}
