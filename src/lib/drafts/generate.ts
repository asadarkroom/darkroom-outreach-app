import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate } from '@/lib/claude/personalize'
import { createGmailDraft, getGmailProfile } from '@/lib/gmail/drafts'
import { GmailNotConnectedError, GmailTokenExpiredError } from '@/lib/gmail/client'
import type { Contact } from '@/lib/supabase/types'

interface GenerateResult {
  processed: number
  drafted: number
  skipped: number
  errors: number
}

const SCHEDULED_EMAIL_SELECT = `
  id, user_id, campaign_id, contact_id, step_id,
  contacts(id, email, first_name, last_name, company_name, job_title, industry,
           website_or_linkedin, custom_notes, status, unenrolled_at, campaign_id,
           user_id, enrolled_at, unenroll_reason, reply_detected_at),
  sequence_steps(subject_template, body_template),
  campaigns(system_prompt, from_name)
`

/**
 * Generates Gmail drafts for all pending scheduled emails on a given date.
 * Optionally scoped to a specific campaign.
 */
export async function generateDraftsForDate(
  date: string,
  campaignId?: string
): Promise<GenerateResult> {
  const supabase = createAdminClient()
  const results: GenerateResult = { processed: 0, drafted: 0, skipped: 0, errors: 0 }

  let query = supabase
    .from('scheduled_emails')
    .select(SCHEDULED_EMAIL_SELECT)
    .eq('send_date', date)
    .eq('status', 'pending')

  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data: pendingEmails, error } = await query
  if (error) throw new Error('Failed to query pending emails: ' + error.message)

  for (const raw of (pendingEmails || []) as unknown as ScheduledEmailRow[]) {
    results.processed++

    const contact = raw.contacts
    if (!contact || contact.unenrolled_at || contact.status !== 'active') {
      results.skipped++
      continue
    }
    if (!contact.email) {
      console.warn(`Skipping email ${raw.id} — contact has no email`)
      results.skipped++
      continue
    }

    try {
      const profile = await getGmailProfile(raw.user_id)
      if (!profile) throw new GmailNotConnectedError('Gmail not connected')

      const contactData: Contact = { ...contact, status: contact.status as Contact['status'] }

      const subject = await renderTemplate(raw.sequence_steps.subject_template, contactData, raw.campaigns.system_prompt)
      const body = await renderTemplate(raw.sequence_steps.body_template, contactData, raw.campaigns.system_prompt)

      const draftId = await createGmailDraft({
        userId: raw.user_id,
        to: contact.email,
        subject,
        body,
        fromName: raw.campaigns.from_name,
        fromEmail: profile.email,
      })

      await supabase.from('scheduled_emails').update({
        status: 'drafted',
        gmail_draft_id: draftId,
        generated_subject: subject,
        generated_body: body,
        error_message: null,
      }).eq('id', raw.id)

      await supabase.from('analytics_events').insert({
        user_id: raw.user_id,
        campaign_id: raw.campaign_id,
        contact_id: raw.contact_id,
        event_type: 'draft_created',
        metadata: { draft_id: draftId, step_id: raw.step_id },
      })

      results.drafted++
    } catch (err) {
      const message =
        err instanceof GmailNotConnectedError || err instanceof GmailTokenExpiredError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unknown error'

      console.error(`Error drafting email ${raw.id}:`, message)

      await supabase.from('scheduled_emails').update({
        status: 'error',
        error_message: message,
      }).eq('id', raw.id)

      await supabase.from('analytics_events').insert({
        user_id: raw.user_id,
        campaign_id: raw.campaign_id,
        contact_id: raw.contact_id,
        event_type: 'error',
        metadata: { error: message, step_id: raw.step_id },
      })

      results.errors++
    }
  }

  return results
}

/**
 * Generates Gmail drafts for all pending scheduled emails due on or before a given date.
 * Used for manual "draft now" triggers to catch overdue and newly-enrolled contacts.
 */
export async function generateDraftsDue(
  upToDate: string,
  campaignId: string
): Promise<GenerateResult> {
  const supabase = createAdminClient()
  const results: GenerateResult = { processed: 0, drafted: 0, skipped: 0, errors: 0 }

  const { data: pendingEmails, error } = await supabase
    .from('scheduled_emails')
    .select(SCHEDULED_EMAIL_SELECT)
    .eq('campaign_id', campaignId)
    .lte('send_date', upToDate)
    .in('status', ['pending', 'error'])

  if (error) throw new Error('Failed to query pending emails: ' + error.message)

  for (const raw of (pendingEmails || []) as unknown as ScheduledEmailRow[]) {
    results.processed++

    const contact = raw.contacts
    if (!contact || contact.unenrolled_at || contact.status !== 'active') {
      results.skipped++
      continue
    }
    if (!contact.email) {
      results.skipped++
      continue
    }

    try {
      const profile = await getGmailProfile(raw.user_id)
      if (!profile) throw new GmailNotConnectedError('Gmail not connected')

      const contactData: Contact = { ...contact, status: contact.status as Contact['status'] }

      const subject = await renderTemplate(raw.sequence_steps.subject_template, contactData, raw.campaigns.system_prompt)
      const body = await renderTemplate(raw.sequence_steps.body_template, contactData, raw.campaigns.system_prompt)

      const draftId = await createGmailDraft({
        userId: raw.user_id,
        to: contact.email,
        subject,
        body,
        fromName: raw.campaigns.from_name,
        fromEmail: profile.email,
      })

      await supabase.from('scheduled_emails').update({
        status: 'drafted',
        gmail_draft_id: draftId,
        generated_subject: subject,
        generated_body: body,
        error_message: null,
      }).eq('id', raw.id)

      await supabase.from('analytics_events').insert({
        user_id: raw.user_id,
        campaign_id: raw.campaign_id,
        contact_id: raw.contact_id,
        event_type: 'draft_created',
        metadata: { draft_id: draftId, step_id: raw.step_id },
      })

      results.drafted++
    } catch (err) {
      const message =
        err instanceof GmailNotConnectedError || err instanceof GmailTokenExpiredError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unknown error'

      console.error(`Error drafting email ${raw.id}:`, message)

      await supabase.from('scheduled_emails').update({
        status: 'error',
        error_message: message,
      }).eq('id', raw.id)

      await supabase.from('analytics_events').insert({
        user_id: raw.user_id,
        campaign_id: raw.campaign_id,
        contact_id: raw.contact_id,
        event_type: 'error',
        metadata: { error: message, step_id: raw.step_id },
      })

      results.errors++
    }
  }

  return results
}

interface ScheduledEmailRow {
  id: string
  user_id: string
  campaign_id: string
  contact_id: string
  step_id: string
  contacts: {
    id: string; email: string; first_name: string | null; last_name: string | null
    company_name: string | null; job_title: string | null; industry: string | null
    website_or_linkedin: string | null; custom_notes: string | null
    status: string; unenrolled_at: string | null; campaign_id: string
    user_id: string; enrolled_at: string | null; unenroll_reason: string | null
    reply_detected_at: string | null
  }
  sequence_steps: { subject_template: string; body_template: string }
  campaigns: { system_prompt: string; from_name: string }
}
