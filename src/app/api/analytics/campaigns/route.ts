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

  // Fetch is_archived from the base campaigns table (the view doesn't expose it)
  const { data: campaignMeta, error: metaError } = await supabase
    .from('campaigns')
    .select('id, is_archived, user_id')

  if (metaError) return NextResponse.json({ error: metaError.message }, { status: 500 })

  const archivedSet = new Set(
    (campaignMeta || []).filter((c: { is_archived: boolean }) => c.is_archived).map((c: { id: string }) => c.id)
  )

  const { data: overviewData, error } = await supabase
    .from('campaign_overview')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach author names
  const userIds = [...new Set((overviewData || []).map((c: { user_id: string }) => c.user_id).filter(Boolean))]
  let nameMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, name').in('id', userIds)
    nameMap = Object.fromEntries((users || []).map((u: { id: string; name: string }) => [u.id, u.name]))
  }

  const data = (overviewData || []).map((c: { campaign_id: string; user_id: string }) => ({
    ...c,
    is_archived: archivedSet.has(c.campaign_id),
    author_name: nameMap[c.user_id] || null,
  }))

  const result = includeArchived ? data : data.filter((c: { is_archived: boolean }) => !c.is_archived)

  return NextResponse.json(result)
}
