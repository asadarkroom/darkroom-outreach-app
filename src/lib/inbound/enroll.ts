/**
 * Inbound enrollment logic.
 *
 * Flow for a new HubSpot form submission:
 * 1. Research the company with Claude
 * 2. Find or note the HubSpot contact ID
 * 3. Create an inbound_enrollment record
 * 4. Schedule inbound_emails for each step
 * 5. Process day-0 email immediately (send or draft based on high-value status)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { assessCompany } from '@/lib/research/assess'
import { findContactByEmail } from '@/lib/hubspot/client'
import { processInboundEmail } from './process-emails'

export interface HubSpotFormPayload {
  contact_name: string
  contact_email: string
  contact_phone?: string
  company_name?: string
  services_interested?: string
  media_budget?: string
  inquiry_type?: string
  referrer?: string
  page_url?: string
}

export async function enrollInboundContact(payload: HubSpotFormPayload): Promise<{
  enrollmentId: string
  isHighValue: boolean
  skipped?: boolean
  reason?: string
}> {
  const supabase = createAdminClient()

  // 1. Get the active inbound sequence
  const { data: sequence, error: seqErr } = await supabase
    .from('inbound_sequences')
    .select('id, sender_user_id, system_prompt')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (seqErr || !sequence) {
    throw new Error('No active inbound sequence found. Please create one at /inbound/sequences.')
  }

  // 2. Get sequence steps
  const { data: steps, error: stepsErr } = await supabase
    .from('inbound_sequence_steps')
    .select('id, step_number, day_offset, step_type')
    .eq('sequence_id', sequence.id)
    .eq('step_type', 'email') // only schedule email steps
    .order('step_number', { ascending: true })

  if (stepsErr || !steps || steps.length === 0) {
    throw new Error('Inbound sequence has no email steps configured.')
  }

  // 3. Research the company
  const research = await assessCompany({
    companyName: payload.company_name || 'Unknown Company',
    mediaBudget: payload.media_budget,
  })

  // 4. Find HubSpot contact ID
  const hubspotContactId = payload.contact_email
    ? await findContactByEmail(payload.contact_email).catch(() => null)
    : null

  const enrolledAt = new Date()

  // 5. Create enrollment record
  const { data: enrollment, error: enrollErr } = await supabase
    .from('inbound_enrollments')
    .insert({
      sequence_id: sequence.id,
      contact_name: payload.contact_name,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone || null,
      company_name: payload.company_name || null,
      services_interested: payload.services_interested || null,
      media_budget: payload.media_budget || null,
      inquiry_type: payload.inquiry_type || null,
      referrer: payload.referrer || null,
      page_url: payload.page_url || null,
      status: research.is_good_fit ? (research.is_high_value ? 'draft_review' : 'active') : 'active',
      is_high_value: research.is_high_value,
      high_value_reason: research.is_high_value ? research.fit_reason : null,
      research_summary: research.summary,
      hubspot_contact_id: hubspotContactId,
      enrolled_at: enrolledAt.toISOString(),
    })
    .select('id')
    .single()

  if (enrollErr || !enrollment) {
    throw new Error(`Failed to create enrollment: ${enrollErr?.message}`)
  }

  const enrollmentId = enrollment.id

  // 6. Schedule inbound_emails for each step
  const today = enrolledAt.toISOString().split('T')[0]

  const emailRows = steps.map((step) => {
    const sendDate = new Date(enrolledAt)
    sendDate.setDate(sendDate.getDate() + step.day_offset)
    return {
      enrollment_id: enrollmentId,
      step_id: step.id,
      send_date: sendDate.toISOString().split('T')[0],
      status: 'pending',
    }
  })

  await supabase.from('inbound_emails').insert(emailRows)

  // 7. Process day-0 email immediately
  const day0Email = emailRows.find((e) => {
    const step = steps.find((s) => s.id === e.step_id)
    return step?.day_offset === 0
  })

  if (day0Email && sequence.sender_user_id) {
    // Get the newly created email row ID
    const { data: day0Row } = await supabase
      .from('inbound_emails')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('send_date', today)
      .single()

    if (day0Row) {
      await processInboundEmail(day0Row.id).catch((err) => {
        console.error('Day-0 inbound email processing error:', err)
      })
    }
  }

  return {
    enrollmentId,
    isHighValue: research.is_high_value,
  }
}
