import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const supabase = createAdminClient()

  // Verify contact belongs to user
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, campaign_id')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

  const now = new Date().toISOString()

  // Unenroll contact
  await supabase.from('contacts').update({
    status: 'unenrolled',
    unenrolled_at: now,
    unenroll_reason: 'manual',
  }).eq('id', id)

  // Cancel pending emails
  await supabase.from('scheduled_emails').update({ status: 'cancelled' })
    .eq('contact_id', id)
    .eq('status', 'pending')

  // Log analytics event
  await supabase.from('analytics_events').insert({
    user_id: session.user.id,
    campaign_id: contact.campaign_id,
    contact_id: id,
    event_type: 'unenrolled',
    metadata: { reason: 'manual', unenrolled_at: now },
  })

  return NextResponse.json({ success: true })
}
