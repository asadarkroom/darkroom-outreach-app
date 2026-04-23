/**
 * Process a single visitor_email row: render, send or draft.
 *
 * Behavior depends on the sequence's auto_send setting:
 *   auto_send = true  → send immediately
 *   auto_send = false → create Gmail draft
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplateWithFields } from '@/lib/claude/personalize'
import { sendGmailEmail } from '@/lib/gmail/send'
import { createGmailDraft, getGmailProfile } from '@/lib/gmail/drafts'

export interface VisitorEmailProcessResult {
  emailId: string
  status: 'sent' | 'draft' | 'error'
  error?: string
}

export async function processVisitorEmail(
  emailId: string
): Promise<VisitorEmailProcessResult> {
  const supabase = createAdminClient()

  const { data: email, error: emailErr } = await supabase
    .from('visitor_emails')
    .select(`
      id, enrollment_id, step_id, send_date, status,
      visitor_enrollments!inner (
        id, contact_name, contact_email, company_name,
        company_url, industry, job_title, visited_page,
        research_summary, status,
        visitor_sequences!inner (
          id, sender_user_id, system_prompt, auto_send
        )
      ),
      visitor_sequence_steps!inner (
        subject_template, body_template, step_number, step_type
      )
    `)
    .eq('id', emailId)
    .single()

  if (emailErr || !email) {
    return { emailId, status: 'error', error: 'Email record not found' }
  }

  const enrollment = email.visitor_enrollments as unknown as Record<string, unknown>
  const sequence = enrollment.visitor_sequences as unknown as Record<string, unknown>
  const step = email.visitor_sequence_steps as unknown as Record<string, unknown>

  // Only process pending or errored emails — skip sent/draft/cancelled
  if (email.status !== 'pending' && email.status !== 'error') {
    return { emailId, status: email.status as 'sent' | 'draft' | 'error' }
  }

  const enrollmentStatus = enrollment.status as string
  if (enrollmentStatus === 'unenrolled' || enrollmentStatus === 'replied' || enrollmentStatus === 'skipped') {
    await supabase.from('visitor_emails').update({ status: 'cancelled' }).eq('id', emailId)
    return { emailId, status: 'error', error: 'Enrollment not active' }
  }

  const senderUserId = sequence.sender_user_id as string | null
  if (!senderUserId) {
    const errMsg = 'No sender user configured on visitor sequence'
    await supabase.from('visitor_emails').update({ status: 'error', error_message: errMsg }).eq('id', emailId)
    return { emailId, status: 'error', error: errMsg }
  }

  try {
    const contactName = enrollment.contact_name as string
    const firstName = contactName?.split(' ')[0] || contactName || ''

    const fields: Record<string, string> = {
      first_name: firstName,
      company_name: (enrollment.company_name as string) || '',
      industry: (enrollment.industry as string) || '',
      visited_page: (enrollment.visited_page as string) || '',
      job_title: (enrollment.job_title as string) || '',
    }

    const systemPrompt = (sequence.system_prompt as string) || ''
    const contextNotes = (enrollment.research_summary as string) || ''

    const [subject, body] = await Promise.all([
      renderTemplateWithFields(step.subject_template as string, fields, systemPrompt, contextNotes),
      renderTemplateWithFields(step.body_template as string, fields, systemPrompt, contextNotes),
    ])

    const senderProfile = await getGmailProfile(senderUserId)
    const fromEmail = senderProfile?.email || ''
    const { data: senderUser } = await supabase.from('users').select('name').eq('id', senderUserId).single()
    const fromName = senderUser?.name || 'Darkroom'

    const contactEmail = enrollment.contact_email as string

    // Draft mode by default. Set AUTO_SEND_EMAILS=true in Vercel env to auto-send.
    // The sequence's auto_send field also acts as a per-sequence override when AUTO_SEND_EMAILS=true.
    const autoSend = process.env.AUTO_SEND_EMAILS === 'true' && (sequence.auto_send as boolean)

    if (autoSend) {
      const messageId = await sendGmailEmail({
        userId: senderUserId,
        to: contactEmail,
        subject,
        body,
        fromName,
        fromEmail,
      })

      await supabase.from('visitor_emails').update({
        status: 'sent',
        gmail_message_id: messageId,
        generated_subject: subject,
        generated_body: body,
        sent_at: new Date().toISOString(),
      }).eq('id', emailId)

      return { emailId, status: 'sent' }
    }

    const draftId = await createGmailDraft({
      userId: senderUserId,
      to: contactEmail,
      subject,
      body,
      fromName,
      fromEmail,
    })

    await supabase.from('visitor_emails').update({
      status: 'draft',
      gmail_draft_id: draftId,
      generated_subject: subject,
      generated_body: body,
    }).eq('id', emailId)

    return { emailId, status: 'draft' }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('visitor_emails').update({
      status: 'error',
      error_message: errMsg,
    }).eq('id', emailId)
    return { emailId, status: 'error', error: errMsg }
  }
}

/**
 * Process all pending visitor emails due on or before a given date.
 */
export async function processVisitorEmailsDue(upToDate: string): Promise<{
  processed: number
  sent: number
  drafted: number
  errors: number
}> {
  const supabase = createAdminClient()

  const { data: dueEmails, error } = await supabase
    .from('visitor_emails')
    .select('id')
    .in('status', ['pending', 'error'])
    .lte('send_date', upToDate)

  if (error || !dueEmails) {
    console.error('Error fetching due visitor emails:', error)
    return { processed: 0, sent: 0, drafted: 0, errors: 0 }
  }

  const results = { processed: 0, sent: 0, drafted: 0, errors: 0 }

  for (const { id } of dueEmails) {
    results.processed++
    const result = await processVisitorEmail(id)
    if (result.status === 'sent') results.sent++
    else if (result.status === 'draft') results.drafted++
    else results.errors++
  }

  return results
}
