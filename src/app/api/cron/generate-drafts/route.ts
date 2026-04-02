import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate } from '@/lib/claude/personalize'
import { createGmailDraft, getGmailProfile } from '@/lib/gmail/drafts'
import { GmailNotConnectedError, GmailTokenExpiredError } from '@/lib/gmail/client'
import type { Contact } from '@/lib/supabase/types'

function verifyCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
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
    status: string; unenrolled_at: string | null
    campaign_id: string; user_id: string; enrolled_at: string | null
    unenroll_reason: string | null; reply_detected_at: string | null
  }
  sequence_steps: { subject_template: string; body_template: string }
  campaigns: { system_prompt: string; from_name: string }
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: pendingEmails, error: queryError } = await supabase
    .from('scheduled_emails')
    .select(`
      id, user_id, campaign_id, contact_id, step_id,
      contacts(id, email, first_name, last_name, company_name, job_title, industry,
               website_or_linkedin, custom_notes, status, unenrolled_at, campaign_id,
               user_id, enrolled_at, unenroll_reason, reply_detected_at),
      sequence_steps(subject_template, body_template),
      campaigns(system_prompt, from_name)
    `)
    .eq('send_date', today)
    .eq('status', 'pending')

  if (queryError) {
    console.error('Cron query error:', queryError)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  const results = { processed: 0, drafted: 0, skipped: 0, errors: 0 }

  for (const rawEmail of (pendingEmails || []) as unknown as ScheduledEmailRow[]) {
    results.processed++

    const contact = rawEmail.contacts
    // Skip if contact is unenrolled
    if (!contact || contact.unenrolled_at || contact.status !== 'active') {
      results.skipped++
      continue
    }

    if (!contact.email) {
      console.warn(`Skipping email ${rawEmail.id} — contact has no email`)
      results.skipped++
      continue
    }

    const step = rawEmail.sequence_steps
    const campaign = rawEmail.campaigns

    try {
      const profile = await getGmailProfile(rawEmail.user_id)
      if (!profile) throw new GmailNotConnectedError('Gmail not connected')

      const contactData: Contact = {
        ...contact,
        status: contact.status as Contact['status'],
      }

      const subject = await renderTemplate(step.subject_template, contactData, campaign.system_prompt)
      const body = await renderTemplate(step.body_template, contactData, campaign.system_prompt)

      const draftId = await createGmailDraft({
        userId: rawEmail.user_id,
        to: contact.email,
        subject,
        body,
        fromName: campaign.from_name,
        fromEmail: profile.email,
      })

      await supabase.from('scheduled_emails').update({
        status: 'drafted',
        gmail_draft_id: draftId,
        generated_subject: subject,
        generated_body: body,
        error_message: null,
      }).eq('id', rawEmail.id)

      await supabase.from('analytics_events').insert({
        user_id: rawEmail.user_id,
        campaign_id: rawEmail.campaign_id,
        contact_id: rawEmail.contact_id,
        event_type: 'draft_created',
        metadata: { draft_id: draftId, step_id: rawEmail.step_id },
      })

      results.drafted++
    } catch (err) {
      const message =
        err instanceof GmailNotConnectedError || err instanceof GmailTokenExpiredError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unknown error'

      console.error(`Error processing email ${rawEmail.id}:`, message)

      await supabase.from('scheduled_emails').update({
        status: 'error',
        error_message: message,
      }).eq('id', rawEmail.id)

      await supabase.from('analytics_events').insert({
        user_id: rawEmail.user_id,
        campaign_id: rawEmail.campaign_id,
        contact_id: rawEmail.contact_id,
        event_type: 'error',
        metadata: { error: message, step_id: rawEmail.step_id },
      })

      results.errors++
    }
  }

  console.log('Draft generation complete:', results)
  return NextResponse.json(results)
}
