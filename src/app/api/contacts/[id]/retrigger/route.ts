import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderTemplate } from '@/lib/claude/personalize'
import { createGmailDraft, getGmailProfile } from '@/lib/gmail/drafts'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: contactId } = await params
  const { email_id } = await req.json()

  if (!email_id) return NextResponse.json({ error: 'email_id is required' }, { status: 400 })

  const supabase = createAdminClient()

  // Get the failed scheduled email
  const { data: email } = await supabase
    .from('scheduled_emails')
    .select('*, contacts(*), sequence_steps(*), campaigns(*)')
    .eq('id', email_id)
    .eq('contact_id', contactId)
    .eq('user_id', session.user.id)
    .single()

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  if (email.status !== 'error') {
    return NextResponse.json({ error: 'Can only retrigger emails with status: error' }, { status: 400 })
  }

  try {
    const profile = await getGmailProfile(session.user.id)
    if (!profile) throw new Error('Gmail not connected')

    const subject = await renderTemplate(
      email.sequence_steps.subject_template,
      email.contacts,
      email.campaigns.system_prompt
    )
    const body = await renderTemplate(
      email.sequence_steps.body_template,
      email.contacts,
      email.campaigns.system_prompt
    )

    const draftId = await createGmailDraft({
      userId: session.user.id,
      to: email.contacts.email,
      subject,
      body,
      fromName: email.campaigns.from_name,
      fromEmail: profile.email,
    })

    await supabase.from('scheduled_emails').update({
      status: 'drafted',
      gmail_draft_id: draftId,
      generated_subject: subject,
      generated_body: body,
      error_message: null,
    }).eq('id', email_id)

    return NextResponse.json({ success: true, draft_id: draftId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await supabase.from('scheduled_emails').update({
      error_message: message,
    }).eq('id', email_id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
