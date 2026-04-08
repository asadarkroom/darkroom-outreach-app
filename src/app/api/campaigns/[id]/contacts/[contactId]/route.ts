import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, contactId } = await params

  const supabase = createAdminClient()

  // Verify contact belongs to this campaign
  const { data: contact, error: fetchError } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('campaign_id', id)
    .single()

  if (fetchError || !contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Only campaign creator or admin can delete contacts
  const role = session.user.role as string
  if (role !== 'admin') {
    const { data: camp } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single()
    if (!camp) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase.from('scheduled_emails').delete().eq('contact_id', contactId)
  const { error } = await supabase.from('contacts').delete().eq('id', contactId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
