/**
 * POST /api/webhooks/hubspot
 *
 * Receives form submission data from Zapier when a new HubSpot form
 * submission comes in for "Form - Call (new) August 2025".
 *
 * Zapier setup:
 *   Trigger: HubSpot → New Form Submission (form: "Form - Call (new) August 2025")
 *   Action:  Webhooks by Zapier → POST to https://your-domain.com/api/webhooks/hubspot
 *   Headers: Authorization: Bearer {HUBSPOT_WEBHOOK_SECRET}
 *   Body (JSON):
 *     {
 *       "contact_name": "{{fullname}}",
 *       "contact_email": "{{email}}",
 *       "contact_phone": "{{phone}}",
 *       "company_name": "{{company}}",
 *       "services_interested": "{{services_interested_in}}",
 *       "media_budget": "{{media_budget}}",
 *       "inquiry_type": "{{what_are_you_inquiring_about}}",
 *       "referrer": "{{where_did_you_hear_about_us}}",
 *       "page_url": "{{page_url}}"
 *     }
 */

import { NextRequest, NextResponse } from 'next/server'
import { enrollInboundContact } from '@/lib/inbound/enroll'

function verifyWebhookSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contactEmail = (body.contact_email || '').trim().toLowerCase()
  const contactName = (body.contact_name || '').trim()

  if (!contactEmail) {
    return NextResponse.json({ error: 'contact_email is required' }, { status: 400 })
  }

  if (!contactName) {
    return NextResponse.json({ error: 'contact_name is required' }, { status: 400 })
  }

  try {
    const result = await enrollInboundContact({
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: body.contact_phone || undefined,
      company_name: body.company_name || undefined,
      services_interested: body.services_interested || undefined,
      media_budget: body.media_budget || undefined,
      inquiry_type: body.inquiry_type || undefined,
      referrer: body.referrer || undefined,
      page_url: body.page_url || undefined,
    })

    return NextResponse.json({
      success: true,
      enrollment_id: result.enrollmentId,
      is_high_value: result.isHighValue,
      message: result.isHighValue
        ? 'High-value account — draft created for review'
        : 'Contact enrolled and day-0 email sent',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enrollment failed'
    console.error('HubSpot webhook enrollment error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
