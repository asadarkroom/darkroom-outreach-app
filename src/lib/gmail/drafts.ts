import { google } from 'googleapis'
import { getAuthenticatedClient } from './client'

interface CreateDraftParams {
  userId: string
  to: string
  subject: string
  body: string
  fromName: string
  fromEmail: string
}

export async function createGmailDraft(params: CreateDraftParams): Promise<string> {
  const { userId, to, subject, body, fromName, fromEmail } = params

  const auth = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const message = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n')

  const encoded = Buffer.from(message).toString('base64url')

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encoded },
    },
  })

  if (!res.data.id) throw new Error('No draft ID returned from Gmail API')
  return res.data.id
}

export async function getGmailProfile(userId: string): Promise<{ email: string } | null> {
  try {
    const auth = await getAuthenticatedClient(userId)
    const gmail = google.gmail({ version: 'v1', auth })
    const res = await gmail.users.getProfile({ userId: 'me' })
    return { email: res.data.emailAddress || '' }
  } catch {
    return null
  }
}

/**
 * Search for replies from a specific sender in the user's mailbox.
 * Returns true if any reply is found.
 */
export async function detectReplyFromContact(
  userId: string,
  contactEmail: string,
  afterDate: Date
): Promise<boolean> {
  const auth = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/')
  const query = `from:${contactEmail} after:${dateStr} in:inbox`

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 1,
  })

  return !!(res.data.messages && res.data.messages.length > 0)
}
