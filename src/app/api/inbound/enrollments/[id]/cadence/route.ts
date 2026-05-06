import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CadenceItem } from '@/lib/inbound/qualify'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { itemId, status } = await req.json() as { itemId: string; status: 'done' | 'skipped' | 'pending' }

  if (!itemId || !['done', 'skipped', 'pending'].includes(status)) {
    return NextResponse.json({ error: 'itemId and valid status required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: enrollment, error } = await supabase
    .from('inbound_enrollments')
    .select('cadence_json')
    .eq('id', id)
    .single()

  if (error || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const cadence = (enrollment.cadence_json || []) as CadenceItem[]
  const updated = cadence.map(item => {
    if (item.id !== itemId) return item
    return {
      ...item,
      status,
      done_at: status === 'done' ? new Date().toISOString() : undefined,
    }
  })

  await supabase
    .from('inbound_enrollments')
    .update({ cadence_json: updated })
    .eq('id', id)

  return NextResponse.json({ success: true, cadence: updated })
}
