/**
 * Send emails directly via Gmail API (not as drafts).
 * Used for auto-send flows in inbound and visitor outreach.
 */

import { google } from 'googleapis'
import { getAuthenticatedClient } from './client'

interface SendEmailParams {
  userId: string
  to: string
  subject: string
  body: string
  fromName: string
  fromEmail: string
  inReplyTo?: string
  threadId?: string
}

/**
 * Send an email immediately via Gmail API.
 * Returns the Gmail message ID of the sent message.
 */
export async function sendGmailEmail(params: SendEmailParams): Promise<string> {
  const { userId, to, subject, body, fromName, fromEmail, inReplyTo, threadId } = params

  const auth = await getAuthenticatedClient(userId)
  const gmail = google.gmail({ version: 'v1', auth })

  const headers = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ]

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`)
    headers.push(`References: ${inReplyTo}`)
  }

  const message = [...headers, '', body].join('\r\n')
  const encoded = Buffer.from(message).toString('base64url')

  const requestBody: { raw: string; threadId?: string } = { raw: encoded }
  if (threadId) requestBody.threadId = threadId

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody,
  })

  if (!res.data.id) throw new Error('No message ID returned from Gmail send API')
  return res.data.id
}
