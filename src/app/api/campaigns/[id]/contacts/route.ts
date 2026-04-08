import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'

/** True if the campaign exists (for read access). */
async function campaignExists(campaignId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('campaigns').select('id').eq('id', campaignId).single()
  return !!data
}

/** True if user is creator of the campaign or an admin (for write access). */
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

  if (!await canMutate(session.user.id, session.user.role as string, id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const contacts = await req.json()
  if (!Array.isArray(contacts)) {
    return NextResponse.json({ error: 'Body must be array of contacts' }, { status: 400 })
  }

  const validContacts = contacts.filter(c => c.email?.trim())
  if (!validContacts.length) {
    return NextResponse.json({ error: 'No valid contacts (email required)' }, { status: 400 })
  }

  // Get campaign owner to assign user_id on contacts
  const supabase = createAdminClient()
  const { data: campaign } = await supabase.from('campaigns').select('user_id').eq('id', id).single()
  const contactUserId = campaign?.user_id || session.user.id

  const rows = validContacts.map(c => ({
    campaign_id: id,
    user_id: contactUserId,
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

  const { data, error } = await supabase
    .from('contacts')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length || 0, skipped: contacts.length - validContacts.length })
}
