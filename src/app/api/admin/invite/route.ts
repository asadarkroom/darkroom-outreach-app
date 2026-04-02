import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { email, name, role = 'member' } = await req.json()
  if (!email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
  }
  if (!['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const token = randomBytes(32).toString('hex')
  const supabase = createAdminClient()

  // Check if user already exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing?.password_hash) {
    return NextResponse.json({ error: 'User already has an active account' }, { status: 400 })
  }

  if (existing) {
    // Update existing invite
    await supabase.from('users').update({
      invite_token: token,
      invited_at: new Date().toISOString(),
      role,
      name: name.trim(),
    }).eq('id', existing.id)
  } else {
    // Create new user placeholder
    const { error } = await supabase.from('users').insert({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
      invite_token: token,
      invited_at: new Date().toISOString(),
      password_hash: '',
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const inviteUrl = `${process.env.NEXTAUTH_URL}/accept-invite?token=${token}`
  return NextResponse.json({ invite_url: inviteUrl, token })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, role, invited_at, created_at, invite_token')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Don't expose tokens in the list — just show if pending
  const users = data?.map(u => ({
    ...u,
    invite_pending: !!u.invite_token,
    invite_token: undefined,
  }))

  return NextResponse.json(users)
}
