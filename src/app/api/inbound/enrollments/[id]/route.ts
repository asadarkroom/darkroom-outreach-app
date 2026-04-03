import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: enrollment, error }, { data: emails }] = await Promise.all([
    supabase.from('inbound_enrollments').select('*').eq('id', id).single(),
    supabase
      .from('inbound_emails')
      .select('*, inbound_sequence_steps(step_number, day_offset, step_type, subject_template)')
      .eq('enrollment_id', id)
      .order('send_date', { ascending: true }),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ enrollment, emails: emails || [] })
}
