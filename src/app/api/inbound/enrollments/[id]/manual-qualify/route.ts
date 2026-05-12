import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { qualifyInboundLead } from '@/lib/inbound/qualify'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { overrideType } = await req.json() as { overrideType: 'qualified' | 'on_the_fence' }

  if (overrideType !== 'qualified' && overrideType !== 'on_the_fence') {
    return NextResponse.json({ error: 'Invalid overrideType' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: enrollment, error } = await supabase
    .from('inbound_enrollments')
    .select('id, contact_name, company_name, services_interested, media_budget, inquiry_type, page_url')
    .eq('id', id)
    .single()

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const result = await qualifyInboundLead({
    contactName: enrollment.contact_name,
    companyName: enrollment.company_name,
    servicesInterested: enrollment.services_interested,
    mediaBudget: enrollment.media_budget,
    inquiryType: enrollment.inquiry_type,
    pageUrl: enrollment.page_url,
    manualOverride: overrideType,
  })

  // Reset sent state so the new email can be sent
  const updates: Record<string, unknown> = {
    lead_tier: result.tier,
    research_summary: result.research_summary,
    cadence_json: result.cadence,
    first_response_sent_at: null,
    first_response_gmail_message_id: null,
    disqualify_reason: null,
    status: 'active',
  }

  if (result.first_response_subject) updates.first_response_subject = result.first_response_subject
  if (result.first_response_body) updates.first_response_body = result.first_response_body

  await supabase.from('inbound_enrollments').update(updates).eq('id', id)

  return NextResponse.json({ success: true, tier: result.tier })
}
