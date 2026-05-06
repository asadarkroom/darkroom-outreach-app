import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail } from '@/lib/gmail/send'
import { getGmailProfile } from '@/lib/gmail/drafts'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { subject, body } = await req.json() as { subject: string; body: string }

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: enrollment, error } = await supabase
    .from('inbound_enrollments')
    .select('id, contact_name, contact_email, first_response_sent_at, sequence_id')
    .eq('id', id)
    .single()

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  if (enrollment.first_response_sent_at) {
    return NextResponse.json({ error: 'First response already sent' }, { status: 409 })
  }

  // Determine sender: prefer sequence's sender, fall back to session user
  let senderUserId: string = session.user.id as string
  if (enrollment.sequence_id) {
    const { data: seq } = await supabase
      .from('inbound_sequences')
      .select('sender_user_id')
      .eq('id', enrollment.sequence_id)
      .single()
    if (seq?.sender_user_id) senderUserId = seq.sender_user_id
  }

  const [senderProfile, { data: senderUser }] = await Promise.all([
    getGmailProfile(senderUserId),
    supabase.from('users').select('name').eq('id', senderUserId).single(),
  ])

  const fromEmail = senderProfile?.email || ''
  const fromName = senderUser?.name || 'Darkroom'

  try {
    const messageId = await sendGmailEmail({
      userId: senderUserId,
      to: enrollment.contact_email,
      subject,
      body,
      fromName,
      fromEmail,
    })

    await supabase
      .from('inbound_enrollments')
      .update({
        first_response_subject: subject,
        first_response_body: body,
        first_response_sent_at: new Date().toISOString(),
        first_response_gmail_message_id: messageId,
      })
      .eq('id', id)

    return NextResponse.json({ success: true, messageId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
