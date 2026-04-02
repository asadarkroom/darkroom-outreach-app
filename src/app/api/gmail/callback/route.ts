import { NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client } from '@/lib/gmail/client'
import { encryptToken } from '@/lib/gmail/encrypt'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID passed in state
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?gmailError=access_denied', req.url)
    )
  }

  try {
    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL('/dashboard?gmailError=no_refresh_token', req.url)
      )
    }

    const encryptedAccess = encryptToken(tokens.access_token!)
    const encryptedRefresh = encryptToken(tokens.refresh_token)
    const expiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null

    const supabase = createAdminClient()
    await supabase.from('gmail_tokens').upsert(
      {
        user_id: state,
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        token_expiry: expiry,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(new URL('/dashboard?gmailConnected=1', req.url))
  } catch (err) {
    console.error('Gmail OAuth error:', err)
    return NextResponse.redirect(
      new URL('/dashboard?gmailError=server_error', req.url)
    )
  }
}
