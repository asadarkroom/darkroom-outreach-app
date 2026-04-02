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

  // Get all active contacts who have been enrolled (have at least one drafted email)
  const { data: activeContacts, error } = await supabase
    .from('contacts')
    .select('id, email, user_id, campaign_id, enrolled_at')
    .eq('status', 'active')
    .not('enrolled_at', 'is', null)

  if (error) {
    console.error('Reply detection query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = { checked: 0, replied: 0, errors: 0 }

  for (const contact of (activeContacts || [])) {
    results.checked++

    try {
      const enrolledAt = contact.enrolled_at ? new Date(contact.enrolled_at) : new Date()
      const replied = await detectReplyFromContact(contact.user_id, contact.email, enrolledAt)

      if (replied) {
        const now = new Date().toISOString()

        // Mark contact as unenrolled
        await supabase.from('contacts').update({
          status: 'unenrolled',
          unenrolled_at: now,
          unenroll_reason: 'replied',
          reply_detected_at: now,
        }).eq('id', contact.id)

        // Cancel all pending emails for this contact
        await supabase.from('scheduled_emails').update({ status: 'cancelled' })
          .eq('contact_id', contact.id)
          .eq('status', 'pending')

        // Log analytics events
        await supabase.from('analytics_events').insert([
          {
            user_id: contact.user_id,
            campaign_id: contact.campaign_id,
            contact_id: contact.id,
            event_type: 'reply_detected',
            metadata: { reply_detected_at: now },
          },
          {
            user_id: contact.user_id,
            campaign_id: contact.campaign_id,
            contact_id: contact.id,
            event_type: 'unenrolled',
            metadata: { reason: 'replied', unenrolled_at: now },
          },
        ])

        results.replied++
      }
    } catch (err) {
      if (err instanceof GmailNotConnectedError || err instanceof GmailTokenExpiredError) {
        // User's Gmail is disconnected — skip all their contacts (no point retrying)
        console.warn(`Gmail not available for user ${contact.user_id}, skipping reply detection`)
      } else {
        console.error(`Error checking contact ${contact.id}:`, err)
        results.errors++
      }
    }
  }

  console.log('Reply detection complete:', results)
  return NextResponse.json(results)
}
