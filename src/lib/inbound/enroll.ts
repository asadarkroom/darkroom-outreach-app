/**
 * Inbound enrollment logic.
 *
 * Inbound contacts have already reached out — no fit research needed.
 * Flow for a new HubSpot form submission:
 * 1. Get the active inbound sequence
 * 2. Find the HubSpot contact ID (for engagement logging)
 * 3. Create an inbound_enrollment record
 * 4. Schedule inbound_emails for each step
 * 5. Process day-0 email immediately (creates Gmail draft)
 */

import { createAdminClient } from '@/lib/supabase/admin'
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
    .eq('step_type', 'email')
    .order('step_number', { ascending: true })

  if (stepsErr || !steps || steps.length === 0) {
    throw new Error('Inbound sequence has no email steps configured.')
  }

  // 3. Find HubSpot contact ID (for engagement logging)
  const hubspotContactId = payload.contact_email
    ? await findContactByEmail(payload.contact_email).catch(() => null)
    : null

  const enrolledAt = new Date()

  // 4. Create enrollment record — all inbound contacts are enrolled, drafts always
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
      status: 'active',
      is_high_value: false,
      hubspot_contact_id: hubspotContactId,
      enrolled_at: enrolledAt.toISOString(),
    })
    .select('id')
    .single()

  if (enrollErr || !enrollment) {
    throw new Error(`Failed to create enrollment: ${enrollErr?.message}`)
  }

  const enrollmentId = enrollment.id

  // 5. Schedule inbound_emails for each step
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

  // 6. Process day-0 email immediately (creates Gmail draft)
  if (sequence.sender_user_id) {
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
    isHighValue: false,
  }
}
