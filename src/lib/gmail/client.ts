import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { encryptToken, decryptToken } from './encrypt'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
]

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/gmail/callback`
  )
}

export function getAuthUrl(userId: string): string {
  const oauth2Client = getOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId,
  })
}

/**
 * Returns an authenticated OAuth2 client for a given user.
 * Automatically refreshes the access token if expired.
 * Throws if the token cannot be refreshed (user needs to reconnect).
 */
export async function getAuthenticatedClient(userId: string) {
  const supabase = createAdminClient()
  const { data: tokenRow, error } = await supabase
    .from('gmail_tokens')
    .select('access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw new GmailNotConnectedError('Gmail not connected')
  }

  const oauth2Client = getOAuth2Client()
  const accessToken = decryptToken(tokenRow.access_token)
  const refreshToken = decryptToken(tokenRow.refresh_token)

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: tokenRow.token_expiry ? new Date(tokenRow.token_expiry).getTime() : undefined,
  })

  // If within 5 minutes of expiry (or already expired), refresh
  const expiryMs = tokenRow.token_expiry ? new Date(tokenRow.token_expiry).getTime() : 0
  const needsRefresh = Date.now() > expiryMs - 5 * 60 * 1000

  if (needsRefresh) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      const newAccessToken = encryptToken(credentials.access_token!)
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null

      await supabase
        .from('gmail_tokens')
        .update({
          access_token: newAccessToken,
          token_expiry: newExpiry,
        })
        .eq('user_id', userId)

      oauth2Client.setCredentials(credentials)
    } catch {
      throw new GmailTokenExpiredError('Gmail token expired — user must reconnect')
    }
  }

  return oauth2Client
}

export class GmailNotConnectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GmailNotConnectedError'
  }
}

export class GmailTokenExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GmailTokenExpiredError'
  }
}
