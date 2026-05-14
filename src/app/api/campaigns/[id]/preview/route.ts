import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { previewTemplate } from '@/lib/claude/personalize'
import type { Contact } from '@/lib/supabase/types'

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  campaign_id: '',
  user_id: '',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@testcompany.com',
  company_name: 'Test Company',
  job_title: 'VP of Marketing',
  industry: 'Consumer Goods',
  website_or_linkedin: 'https://testcompany.com',
  custom_notes: 'Recently launched a new product line focused on sustainable packaging.',
  enrolled_at: new Date().toISOString(),
  unenrolled_at: null,
  unenroll_reason: null,
  reply_detected_at: null,
  status: 'active',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { step_id, contact_id, sample } = body

  if (!step_id) {
    return NextResponse.json({ error: 'step_id is required' }, { status: 400 })
  }
  if (!sample && !contact_id) {
    return NextResponse.json({ error: 'contact_id or sample:true is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('system_prompt, from_name')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: step } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('id', step_id)
    .eq('campaign_id', id)
    .single()

  if (!step) return NextResponse.json({ error: 'Step not found' }, { status: 404 })

  let contact: Contact
  if (sample) {
    contact = { ...SAMPLE_CONTACT, campaign_id: id }
  } else {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('campaign_id', id)
      .single()
    if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    contact = data
  }

  try {
    const { subject, body: emailBody } = await previewTemplate(
      step.subject_template,
      step.body_template,
      contact,
      campaign.system_prompt
    )
    return NextResponse.json({ subject, body: emailBody, sample: !!sample })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate preview'
    console.error('Preview error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
