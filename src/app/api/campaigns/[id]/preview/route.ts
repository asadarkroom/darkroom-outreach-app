import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { previewTemplate } from '@/lib/claude/personalize'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { contact_id, step_id } = await req.json()
  if (!contact_id || !step_id) {
    return NextResponse.json({ error: 'contact_id and step_id are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('system_prompt, from_name')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: contact }, { data: step }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contact_id).eq('campaign_id', id).single(),
    supabase.from('sequence_steps').select('*').eq('id', step_id).eq('campaign_id', id).single(),
  ])

  if (!contact || !step) {
    return NextResponse.json({ error: 'Contact or step not found' }, { status: 404 })
  }

  const { subject, body } = await previewTemplate(
    step.subject_template,
    step.body_template,
    contact,
    campaign.system_prompt
  )

  return NextResponse.json({ subject, body })
}
