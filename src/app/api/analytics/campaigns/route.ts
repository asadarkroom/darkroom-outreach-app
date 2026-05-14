import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const includeArchived = searchParams.get('archived') === 'true'

  const supabase = createAdminClient()

  let query = supabase
    .from('campaign_overview')
    .select('*')
    .order('created_at', { ascending: false })

  if (!includeArchived) query = query.eq('is_archived', false)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach author names
  const userIds = [...new Set((data || []).map((c: { user_id: string }) => c.user_id).filter(Boolean))]
  let nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, name').in('id', userIds)
    nameMap = Object.fromEntries((users || []).map((u: { id: string; name: string }) => [u.id, u.name]))
  }

  const result = (data || []).map((c: { user_id: string }) => ({
    ...c,
    author_name: nameMap[c.user_id] || null,
  }))

  return NextResponse.json(result)
}
