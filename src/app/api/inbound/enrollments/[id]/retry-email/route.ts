import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInboundEmail } from '@/lib/inbound/process-emails'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { emailId } = await req.json()
  if (!emailId) return NextResponse.json({ error: 'emailId required' }, { status: 400 })

  const supabase = createAdminClient()

  // Verify the email belongs to this enrollment
  const { data: email } = await supabase
    .from('inbound_emails')
    .select('id, status')
    .eq('id', emailId)
    .eq('enrollment_id', id)
    .single()

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  if (email.status !== 'error') return NextResponse.json({ error: 'Only errored emails can be retried' }, { status: 400 })

  // Reset to pending so processInboundEmail will process it
  await supabase
    .from('inbound_emails')
    .update({ status: 'pending', error_message: null })
    .eq('id', emailId)

  const result = await processInboundEmail(emailId)

  return NextResponse.json(result)
}
