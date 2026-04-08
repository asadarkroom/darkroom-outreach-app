import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const fit = searchParams.get('fit')
  const search = searchParams.get('search')
  const format = searchParams.get('format')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // CSV export
  if (format === 'csv') {
    const { data: all } = await supabase
      .from('visitor_enrollments')
      .select('*')
      .order('enrolled_at', { ascending: false })

    if (!all) return NextResponse.json({ error: 'Export failed' }, { status: 500 })

    const cols = [
      'contact_name', 'contact_email', 'company_name', 'company_url',
      'company_size', 'job_title', 'industry', 'visited_page', 'visit_date',
      'status', 'fit_assessment', 'research_summary', 'hubspot_deal_found',
      'enrolled_at', 'completed_at', 'reply_detected_at',
    ]

    const header = cols.join(',')
    const rows = all.map((row) =>
      cols
        .map((col) => {
          const val = (row as Record<string, unknown>)[col]
          if (val === null || val === undefined) return ''
          const str = String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(',')
    )

    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="visitor-enrollments-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  let query = supabase
    .from('visitor_enrollments')
    .select('*', { count: 'exact' })
    .order('enrolled_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (fit) query = query.eq('fit_assessment', fit)
  if (search) {
    query = query.or(
      `contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stats
  const { data: allStats } = await supabase.from('visitor_enrollments').select('status, fit_assessment')
  const stats = {
    total: 0, active: 0, replied: 0, completed: 0, skipped: 0, no_email: 0,
    good_fit: 0, not_fit: 0, existing_deal: 0,
  }
  for (const row of allStats || []) {
    stats.total++
    const s = row.status as keyof typeof stats
    if (s in stats) stats[s]++
    const f = row.fit_assessment as string | null
    if (f === 'good_fit') stats.good_fit++
    else if (f === 'not_fit') stats.not_fit++
    else if (f === 'existing_deal') stats.existing_deal++
  }

  return NextResponse.json({ enrollments: data, total: count, stats })
}
