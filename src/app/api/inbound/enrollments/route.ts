import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  let query = supabase
    .from('inbound_enrollments')
    .select('*', { count: 'exact' })
    .order('enrolled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(
      `contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate stats
  const { data: stats } = await supabase
    .from('inbound_enrollments')
    .select('status')

  const statMap = { total: 0, active: 0, replied: 0, completed: 0, unenrolled: 0, error: 0 }
  for (const row of stats || []) {
    statMap.total++
    const s = row.status as keyof typeof statMap
    if (s in statMap) statMap[s]++
  }

  return NextResponse.json({ enrollments: data, total: count, stats: statMap })
}
