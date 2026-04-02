import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyCampaignOwner(userId: string, campaignId: string) {
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
  if (!await verifyCampaignOwner(session.user.id, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = req.nextUrl
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const supabase = createAdminClient()
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('campaign_id', id)
    .order('email', { ascending: true })

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  if (!await verifyCampaignOwner(session.user.id, id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contacts = await req.json()
  if (!Array.isArray(contacts)) {
    return NextResponse.json({ error: 'Body must be array of contacts' }, { status: 400 })
  }

  const validContacts = contacts.filter(c => c.email?.trim())
  if (!validContacts.length) {
    return NextResponse.json({ error: 'No valid contacts (email required)' }, { status: 400 })
  }

  const rows = validContacts.map(c => ({
    campaign_id: id,
    user_id: session.user.id,
    first_name: c.first_name || null,
    last_name: c.last_name || null,
    company_name: c.company_name || null,
    job_title: c.job_title || null,
    email: c.email.trim().toLowerCase(),
    industry: c.industry || null,
    website_or_linkedin: c.website_or_linkedin || null,
    custom_notes: c.custom_notes || null,
    status: 'active',
  }))

  const supabase = createAdminClient()
  // Upsert to handle deduplication by email within campaign
  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length || 0, skipped: contacts.length - validContacts.length })
}
