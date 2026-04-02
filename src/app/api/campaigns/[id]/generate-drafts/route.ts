import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDraftsDue } from '@/lib/drafts/generate'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Verify campaign ownership
  const supabase = createAdminClient()
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status === 'draft') {
    return NextResponse.json({ error: 'Launch the campaign before generating drafts' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const results = await generateDraftsDue(today, id)
    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
