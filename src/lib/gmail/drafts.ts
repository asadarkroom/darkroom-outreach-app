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

/**
 * Converts a plain text email body to minimal HTML.
 * Double newlines become paragraph breaks; single newlines become <br>.
 * This prevents Gmail from auto-wrapping plain text at 76 chars and
 * allows proper editing in Gmail's rich-text compose window.
 */
export function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const escaped = normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const body = escaped
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return `<html><body>${body}</body></html>`
}

export async function createGmailDraft(params: CreateDraftParams): Promise<string> {
  const { userId, to, subject, body, fromName, fromEmail } = params

  const auth = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const message = [
    'MIME-Version: 1.0',
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    plainTextToHtml(body),
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
 * Check whether a Gmail draft still exists.
 * Returns 'draft' if still pending, 'sent' if it's been sent (moved to Sent),
 * or null if the draft was deleted without sending.
 */
export async function checkDraftStatus(
  userId: string,
  draftId: string
): Promise<'draft' | 'sent' | 'deleted' | null> {
  try {
    const auth = await getAuthenticatedClient(userId)
    const gmail = google.gmail({ version: 'v1', auth })

    // Try to fetch the draft — if it's gone, it was sent or deleted
    let messageId: string | null = null
    try {
      const draft = await gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'minimal' })
      messageId = draft.data.message?.id || null
    } catch {
      // Draft not found — check sent folder for a recently sent message
      return 'deleted'
    }

    if (!messageId) return 'draft'

    // Check label on the underlying message
    const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'minimal' })
    const labels = msg.data.labelIds || []

    if (labels.includes('SENT') && !labels.includes('DRAFT')) return 'sent'
    return 'draft'
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
