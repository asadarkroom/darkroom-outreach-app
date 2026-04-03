import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectReplyFromContact } from '@/lib/gmail/drafts'
import { GmailNotConnectedError, GmailTokenExpiredError } from '@/lib/gmail/client'

function verifyCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const results = { checked: 0, replied: 0, errors: 0 }

  // ── 1. Campaign contacts ──────────────────────────────────────
  const { data: activeContacts } = await supabase
    .from('contacts')
    .select('id, email, user_id, campaign_id, enrolled_at')
    .eq('status', 'active')
    .not('enrolled_at', 'is', null)

  for (const contact of activeContacts || []) {
    results.checked++
    try {
      const enrolledAt = contact.enrolled_at ? new Date(contact.enrolled_at) : new Date()
      const replied = await detectReplyFromContact(contact.user_id, contact.email, enrolledAt)

      if (replied) {
        const now = new Date().toISOString()
        await supabase.from('contacts').update({
          status: 'unenrolled',
          unenrolled_at: now,
          unenroll_reason: 'replied',
          reply_detected_at: now,
        }).eq('id', contact.id)

        await supabase.from('scheduled_emails').update({ status: 'cancelled' })
          .eq('contact_id', contact.id)
          .eq('status', 'pending')

        await supabase.from('analytics_events').insert([
          { user_id: contact.user_id, campaign_id: contact.campaign_id, contact_id: contact.id, event_type: 'reply_detected', metadata: { reply_detected_at: now } },
          { user_id: contact.user_id, campaign_id: contact.campaign_id, contact_id: contact.id, event_type: 'unenrolled', metadata: { reason: 'replied', unenrolled_at: now } },
        ])
        results.replied++
      }
    } catch (err) {
      if (err instanceof GmailNotConnectedError || err instanceof GmailTokenExpiredError) {
        console.warn(`Gmail not available for user ${contact.user_id}, skipping`)
      } else {
        console.error(`Error checking contact ${contact.id}:`, err)
        results.errors++
      }
    }
  }

  // ── 2. Inbound enrollments ────────────────────────────────────
  const { data: inboundActive } = await supabase
    .from('inbound_enrollments')
    .select('id, contact_email, enrolled_at, inbound_sequences!inner(sender_user_id)')
    .eq('status', 'active')

  for (const enrollment of inboundActive || []) {
    results.checked++
    try {
      const seq = enrollment.inbound_sequences as { sender_user_id: string | null }
      const senderUserId = seq?.sender_user_id
      if (!senderUserId || !enrollment.contact_email) continue

      const enrolledAt = enrollment.enrolled_at ? new Date(enrollment.enrolled_at) : new Date()
      const replied = await detectReplyFromContact(senderUserId, enrollment.contact_email, enrolledAt)

      if (replied) {
        const now = new Date().toISOString()
        await supabase.from('inbound_enrollments').update({
          status: 'replied',
          unenrolled_at: now,
          unenroll_reason: 'replied',
          reply_detected_at: now,
        }).eq('id', enrollment.id)

        await supabase.from('inbound_emails').update({ status: 'cancelled' })
          .eq('enrollment_id', enrollment.id)
          .eq('status', 'pending')

        results.replied++
      }
    } catch (err) {
      if (!(err instanceof GmailNotConnectedError) && !(err instanceof GmailTokenExpiredError)) {
        console.error(`Error checking inbound enrollment ${enrollment.id}:`, err)
        results.errors++
      }
    }
  }

  // ── 3. Visitor enrollments ────────────────────────────────────
  const { data: visitorActive } = await supabase
    .from('visitor_enrollments')
    .select('id, contact_email, enrolled_at, visitor_sequences!inner(sender_user_id)')
    .eq('status', 'active')
    .not('contact_email', 'is', null)

  for (const enrollment of visitorActive || []) {
    results.checked++
    try {
      const seq = enrollment.visitor_sequences as { sender_user_id: string | null }
      const senderUserId = seq?.sender_user_id
      if (!senderUserId || !enrollment.contact_email) continue

      const enrolledAt = enrollment.enrolled_at ? new Date(enrollment.enrolled_at) : new Date()
      const replied = await detectReplyFromContact(senderUserId, enrollment.contact_email, enrolledAt)

      if (replied) {
        const now = new Date().toISOString()
        await supabase.from('visitor_enrollments').update({
          status: 'replied',
          unenrolled_at: now,
          unenroll_reason: 'replied',
          reply_detected_at: now,
        }).eq('id', enrollment.id)

        await supabase.from('visitor_emails').update({ status: 'cancelled' })
          .eq('enrollment_id', enrollment.id)
          .eq('status', 'pending')

        results.replied++
      }
    } catch (err) {
      if (!(err instanceof GmailNotConnectedError) && !(err instanceof GmailTokenExpiredError)) {
        console.error(`Error checking visitor enrollment ${enrollment.id}:`, err)
        results.errors++
      }
    }
  }

  console.log('Reply detection complete:', results)
  return NextResponse.json(results)
}
