import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth/password'

export async function POST(req: NextRequest) {
  const { token, name, password } = await req.json()

  if (!token || !name || !password) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Find user by invite token
  const { data: user, error } = await supabase
    .from('users')
    .select('id, password_hash, email')
    .eq('invite_token', token)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'Invalid or expired invite token' }, { status: 400 })
  }

  // If account already activated (has password), reject
  if (user.password_hash && user.password_hash.length > 0) {
    return NextResponse.json({ error: 'Invite has already been used' }, { status: 400 })
  }

  const passwordHash = hashPassword(password)

  const { error: updateError } = await supabase
    .from('users')
    .update({ name, password_hash: passwordHash, invite_token: null })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email: user.email })
}
