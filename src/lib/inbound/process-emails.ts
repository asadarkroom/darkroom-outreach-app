/**
 * Process a single inbound_email row: render and create a Gmail draft.
 *
 * Inbound contacts reached out — a human always reviews and sends the draft.
 * No auto-send path. To log to HubSpot after sending, use logEmailEngagement()
 * from lib/hubspot/client in a future manual-send webhook if needed.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplateWithFields } from '@/lib/claude/personalize'
import { createGmailDraft, getGmailProfile } from '@/lib/gmail/drafts'

export interface InboundEmailProcessResult {
  emailId: string
  status: 'sent' | 'draft' | 'error'
  error?: string
}

export async function processInboundEmail(
  emailId: string
): Promise<InboundEmailProcessResult> {
  const supabase = createAdminClient()

  // Load email with related data
  const { data: email, error: emailErr } = await supabase
    .from('inbound_emails')
    .select(`
      id, enrollment_id, step_id, send_date, status,
      inbound_enrollments!inner (
        id, contact_name, contact_email, company_name,
        services_interested, media_budget,
        is_high_value, hubspot_contact_id, status,
        inbound_sequences!inner (
          id, sender_user_id, system_prompt, name
        )
      ),
      inbound_sequence_steps!inner (
        subject_template, body_template, step_number, step_type
      )
    `)
    .eq('id', emailId)
    .single()

  if (emailErr || !email) {
    return { emailId, status: 'error', error: 'Email record not found' }
  }

  const enrollment = email.inbound_enrollments as unknown as Record<string, unknown>
  const sequence = enrollment.inbound_sequences as unknown as Record<string, unknown>
  const step = email.inbound_sequence_steps as unknown as Record<string, unknown>

  // Only process pending or errored emails — skip sent/draft/cancelled
  if (email.status !== 'pending' && email.status !== 'error') {
    return { emailId, status: email.status as 'sent' | 'draft' | 'error' }
  }

  const enrollmentStatus = enrollment.status as string
  if (enrollmentStatus === 'unenrolled' || enrollmentStatus === 'replied') {
    await supabase.from('inbound_emails').update({ status: 'cancelled' }).eq('id', emailId)
    return { emailId, status: 'error', error: 'Enrollment unenrolled' }
  }

  const senderUserId = sequence.sender_user_id as string | null
  if (!senderUserId) {
    const errMsg = 'No sender user configured on inbound sequence'
    await supabase.from('inbound_emails').update({
      status: 'error', error_message: errMsg,
    }).eq('id', emailId)
    return { emailId, status: 'error', error: errMsg }
  }

  try {
    // Build merge fields
    const contactName = enrollment.contact_name as string
    const firstName = contactName?.split(' ')[0] || contactName || ''

    const fields: Record<string, string> = {
      first_name: firstName,
      company_name: (enrollment.company_name as string) || '',
      services_interested: (enrollment.services_interested as string) || '',
      media_budget: (enrollment.media_budget as string) || '',
    }

    const systemPrompt = (sequence.system_prompt as string) || ''
    const contextNotes = (enrollment as { research_summary?: string }).research_summary || ''

    // Render subject + body
    const [subject, body] = await Promise.all([
      renderTemplateWithFields(step.subject_template as string, fields, systemPrompt, contextNotes),
      renderTemplateWithFields(step.body_template as string, fields, systemPrompt, contextNotes),
    ])

    // Get sender email and name from user record
    const senderProfile = await getGmailProfile(senderUserId)
    const fromEmail = senderProfile?.email || ''
    const { data: senderUser } = await supabase.from('users').select('name').eq('id', senderUserId).single()
    const fromName = senderUser?.name || 'Darkroom'

    const contactEmail = enrollment.contact_email as string

    // Inbound contacts always get a Gmail draft — they reached out, so a human
    // should review and send. No auto-send path for inbound.
    const draftId = await createGmailDraft({
      userId: senderUserId,
      to: contactEmail,
      subject,
      body,
      fromName,
      fromEmail,
    })

    await supabase.from('inbound_emails').update({
      status: 'draft',
      gmail_draft_id: draftId,
      generated_subject: subject,
      generated_body: body,
    }).eq('id', emailId)

    return { emailId, status: 'draft' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('inbound_emails').update({
      status: 'error',
      error_message: errMsg,
    }).eq('id', emailId)
    return { emailId, status: 'error', error: errMsg }
  }
}

/**
 * Process all pending inbound emails due on or before a given date.
 */
export async function processInboundEmailsDue(upToDate: string): Promise<{
  processed: number
  sent: number
  drafted: number
  errors: number
}> {
  const supabase = createAdminClient()

  const { data: dueEmails, error } = await supabase
    .from('inbound_emails')
    .select('id')
    .in('status', ['pending', 'error'])
    .lte('send_date', upToDate)

  if (error || !dueEmails) {
    console.error('Error fetching due inbound emails:', error)
    return { processed: 0, sent: 0, drafted: 0, errors: 0 }
  }

  const results = { processed: 0, sent: 0, drafted: 0, errors: 0 }

  for (const { id } of dueEmails) {
    results.processed++
    const result = await processInboundEmail(id)
    if (result.status === 'sent') results.sent++
    else if (result.status === 'draft') results.drafted++
    else results.errors++
  }

  return results
}
