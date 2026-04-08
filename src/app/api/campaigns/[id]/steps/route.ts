import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

async function campaignExists(campaignId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('campaigns').select('id').eq('id', campaignId).single()
  return !!data
}

async function canMutate(userId: string, role: string, campaignId: string): Promise<boolean> {
  if (role === 'admin') return true
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await campaignExists(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sequence_steps')
    .select('*')
    .eq('campaign_id', id)
    .order('step_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (!await canMutate(session.user.id, session.user.role as string, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const steps = await req.json()
  if (!Array.isArray(steps)) {
    return NextResponse.json({ error: 'Body must be an array of steps' }, { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase.from('sequence_steps').delete().eq('campaign_id', id)

  if (steps.length > 0) {
    const rows = steps.map((s, i) => ({
      campaign_id: id,
      step_number: i + 1,
      day_offset: Number(s.day_offset) || 0,
      subject_template: s.subject_template || '',
      body_template: s.body_template || '',
    }))

    const { data, error } = await supabase.from('sequence_steps').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json([])
}
