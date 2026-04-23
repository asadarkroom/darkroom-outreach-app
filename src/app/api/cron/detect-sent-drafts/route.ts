/**
 * Cron: detect when Gmail drafts created by the app have been sent by the user.
 *
 * Checks all scheduled_emails in 'drafted' status that have a gmail_draft_id.
 * If the draft no longer exists in Gmail, marks the email as 'sent'.
 *
 * Schedule: every 30 minutes (or configure in vercel.json / external cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkDraftStatus } from '@/lib/gmail/drafts'

function verifyCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results = { checked: 0, sent: 0, errors: 0 }

  // ── 1. Campaign scheduled_emails ─────────────────────────────
  const { data: campaignDrafts } = await supabase
    .from('scheduled_emails')
    .select('id, user_id, campaign_id, contact_id, gmail_draft_id')
    .eq('status', 'drafted')
    .not('gmail_draft_id', 'is', null)

  for (const row of campaignDrafts || []) {
    results.checked++
    try {
      const draftStatus = await checkDraftStatus(row.user_id, row.gmail_draft_id!)
      if (draftStatus === 'sent' || draftStatus === 'deleted') {
        const now = new Date().toISOString()
        await supabase.from('scheduled_emails').update({
          status: 'completed',
          error_message: null,
        }).eq('id', row.id)

        await supabase.from('analytics_events').insert({
          user_id: row.user_id,
          campaign_id: row.campaign_id,
          contact_id: row.contact_id,
          event_type: 'draft_created',
          metadata: { sent_at: now, detected_by: 'cron' },
        })

        results.sent++
      }
    } catch (err) {
      console.error(`Error checking campaign draft ${row.id}:`, err)
      results.errors++
    }
  }

  // ── 2. Inbound emails ─────────────────────────────────────────
  const { data: inboundDrafts } = await supabase
    .from('inbound_emails')
    .select('id, enrollment_id, gmail_draft_id, inbound_enrollments!inner(inbound_sequences!inner(sender_user_id))')
    .eq('status', 'draft')
    .not('gmail_draft_id', 'is', null)

  for (const row of inboundDrafts || []) {
    results.checked++
    try {
      const enrollment = row.inbound_enrollments as unknown as {
        inbound_sequences: { sender_user_id: string | null }
      }
      const userId = enrollment?.inbound_sequences?.sender_user_id
      if (!userId) continue

      const draftStatus = await checkDraftStatus(userId, row.gmail_draft_id!)
      if (draftStatus === 'sent' || draftStatus === 'deleted') {
        const now = new Date().toISOString()
        await supabase.from('inbound_emails').update({
          status: 'sent',
          sent_at: now,
        }).eq('id', row.id)

        // Mark enrollment as completed if all emails sent/cancelled
        const { data: remaining } = await supabase
          .from('inbound_emails')
          .select('id')
          .eq('enrollment_id', row.enrollment_id)
          .in('status', ['pending', 'draft'])

        if (!remaining || remaining.length === 0) {
          await supabase.from('inbound_enrollments').update({ status: 'completed' })
            .eq('id', row.enrollment_id)
        }

        results.sent++
      }
    } catch (err) {
      console.error(`Error checking inbound draft ${row.id}:`, err)
      results.errors++
    }
  }

  // ── 3. Visitor emails ─────────────────────────────────────────
  const { data: visitorDrafts } = await supabase
    .from('visitor_emails')
    .select('id, enrollment_id, gmail_draft_id, visitor_enrollments!inner(visitor_sequences!inner(sender_user_id))')
    .eq('status', 'draft')
    .not('gmail_draft_id', 'is', null)

  for (const row of visitorDrafts || []) {
    results.checked++
    try {
      const enrollment = row.visitor_enrollments as unknown as {
        visitor_sequences: { sender_user_id: string | null }
      }
      const userId = enrollment?.visitor_sequences?.sender_user_id
      if (!userId) continue

      const draftStatus = await checkDraftStatus(userId, row.gmail_draft_id!)
      if (draftStatus === 'sent' || draftStatus === 'deleted') {
        const now = new Date().toISOString()
        await supabase.from('visitor_emails').update({
          status: 'sent',
          sent_at: now,
        }).eq('id', row.id)

        results.sent++
      }
    } catch (err) {
      console.error(`Error checking visitor draft ${row.id}:`, err)
      results.errors++
    }
  }

  console.log('Sent-draft detection complete:', results)
  return NextResponse.json(results)
}
