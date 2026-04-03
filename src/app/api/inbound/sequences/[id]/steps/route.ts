import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('inbound_sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  // Expects array of steps; replaces all steps for this sequence
  const steps: Array<{
    step_number: number
    step_type: string
    day_offset: number
    subject_template: string
    body_template: string
  }> = body.steps || []

  const supabase = createAdminClient()

  // Delete existing steps and re-insert
  await supabase.from('inbound_sequence_steps').delete().eq('sequence_id', id)

  if (steps.length > 0) {
    const rows = steps.map((s, i) => ({
      sequence_id: id,
      step_number: s.step_number ?? i + 1,
      step_type: s.step_type || 'email',
      day_offset: s.day_offset ?? 0,
      subject_template: s.subject_template || '',
      body_template: s.body_template || '',
    }))

    const { error } = await supabase.from('inbound_sequence_steps').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = await supabase
    .from('inbound_sequence_steps')
    .select('*')
    .eq('sequence_id', id)
    .order('step_number', { ascending: true })

  return NextResponse.json(data)
}
