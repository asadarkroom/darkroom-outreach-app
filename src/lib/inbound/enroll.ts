/**
 * Inbound enrollment logic.
 *
 * Flow for a new HubSpot form submission:
 * 1. Get the active inbound sequence
 * 2. Find the HubSpot contact ID (for engagement logging)
 * 3. Create an inbound_enrollment record
 * 4. Run Claude qualification → tier, first response email, follow-up cadence
 * 5. For not_fit: mark enrollment as disqualified, done
 * 6. For good_fit / questionable: schedule follow-up sequence emails (day_offset > 0 only)
 *    The day-0 first response is stored on the enrollment and sent from the app by the user
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { findContactByEmail } from '@/lib/hubspot/client'
import { qualifyInboundLead } from './qualify'

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
  tier: string
  skipped?: boolean
  reason?: string
}> {
  const supabase = createAdminClient()

  // 1. Get the active inbound sequence (optional — only needed for follow-up emails)
  const { data: sequence } = await supabase
    .from('inbound_sequences')
    .select('id, sender_user_id, system_prompt')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // 2. Find HubSpot contact ID (for engagement logging)
  const hubspotContactId = payload.contact_email
    ? await findContactByEmail(payload.contact_email).catch(() => null)
    : null

  const enrolledAt = new Date()

  // 3. Create enrollment record
  const { data: enrollment, error: enrollErr } = await supabase
    .from('inbound_enrollments')
    .insert({
      sequence_id: sequence?.id || null,
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

  // 4. Run qualification in background (don't block webhook response)
  qualifyAndUpdate(enrollmentId, payload, sequence?.id || null).catch(err =>
    console.error('Qualification error for enrollment', enrollmentId, err)
  )

  // 5. Schedule follow-up sequence emails (day_offset > 0 only) if sequence exists
  if (sequence) {
    await scheduleFollowUps(enrollmentId, sequence.id, enrolledAt)
  }

  return { enrollmentId, tier: 'unassessed' }
}

async function qualifyAndUpdate(
  enrollmentId: string,
  payload: HubSpotFormPayload,
  sequenceId: string | null
) {
  const supabase = createAdminClient()

  const result = await qualifyInboundLead({
    contactName: payload.contact_name,
    companyName: payload.company_name || null,
    servicesInterested: payload.services_interested || null,
    mediaBudget: payload.media_budget || null,
    inquiryType: payload.inquiry_type || null,
    pageUrl: payload.page_url || null,
  })

  const updates: Record<string, unknown> = {
    lead_tier: result.tier,
    research_summary: result.research_summary,
    cadence_json: result.cadence,
  }

  if (result.first_response_subject) updates.first_response_subject = result.first_response_subject
  if (result.first_response_body) updates.first_response_body = result.first_response_body
  if (result.disqualify_reason) updates.disqualify_reason = result.disqualify_reason

  if (result.tier === 'not_fit') {
    updates.status = 'disqualified'
    // Cancel any pending follow-up emails for disqualified leads
    await supabase
      .from('inbound_emails')
      .update({ status: 'cancelled' })
      .eq('enrollment_id', enrollmentId)
      .eq('status', 'pending')
  }

  await supabase.from('inbound_enrollments').update(updates).eq('id', enrollmentId)
}

async function scheduleFollowUps(
  enrollmentId: string,
  sequenceId: string,
  enrolledAt: Date
) {
  const supabase = createAdminClient()

  // Only get steps with day_offset > 0 — day 0 is handled by the first response
  const { data: steps } = await supabase
    .from('inbound_sequence_steps')
    .select('id, step_number, day_offset, step_type')
    .eq('sequence_id', sequenceId)
    .eq('step_type', 'email')
    .gt('day_offset', 0)
    .order('step_number', { ascending: true })

  if (!steps || steps.length === 0) return

  const emailRows = steps.map((step: { id: string; step_number: number; day_offset: number; step_type: string }) => {
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
}
