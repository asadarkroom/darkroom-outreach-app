/**
 * GET /api/cron/cadence-digest
 * Daily cron: send Asa an email digest of all inbound cadence steps due today or overdue.
 * Schedule: 8:00 AM UTC daily
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGmailEmail } from '@/lib/gmail/send'
import { getGmailProfile } from '@/lib/gmail/drafts'
import type { CadenceItem } from '@/lib/inbound/qualify'

function verifyCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

interface EnrollmentRow {
  id: string
  contact_name: string
  contact_email: string
  company_name: string | null
  enrolled_at: string
  cadence_json: CadenceItem[] | null
}

interface DueItem {
  enrollment: EnrollmentRow
  item: CadenceItem
  daysOverdue: number
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find Asa's account
  const digestEmail = process.env.DIGEST_EMAIL || 'asa@darkroomagency.com'
  const { data: asaUser } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', digestEmail)
    .single()

  if (!asaUser) {
    console.error('Cadence digest: could not find digest recipient', digestEmail)
    return NextResponse.json({ error: 'Digest recipient not found' }, { status: 500 })
  }

  // Load all active enrollments with cadence data
  const { data: enrollments } = await supabase
    .from('inbound_enrollments')
    .select('id, contact_name, contact_email, company_name, enrolled_at, cadence_json')
    .not('cadence_json', 'is', null)
    .in('status', ['active', 'replied'])

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ success: true, sent: false, reason: 'No active enrollments with cadence' })
  }

  const today = new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  const dueItems: DueItem[] = []

  for (const enrollment of enrollments as EnrollmentRow[]) {
    if (!enrollment.cadence_json) continue
    const enrolledDate = new Date(enrollment.enrolled_at)
    const enrolledMidnight = new Date(enrolledDate.getFullYear(), enrolledDate.getMonth(), enrolledDate.getDate())

    for (const item of enrollment.cadence_json) {
      if (item.status !== 'pending') continue
      const dueDate = new Date(enrolledMidnight)
      dueDate.setDate(dueDate.getDate() + item.day_offset)
      const diffDays = Math.floor((todayMidnight.getTime() - dueDate.getTime()) / 86400000)
      if (diffDays >= 0) {
        dueItems.push({ enrollment, item, daysOverdue: diffDays })
      }
    }
  }

  if (dueItems.length === 0) {
    return NextResponse.json({ success: true, sent: false, reason: 'No cadence steps due today' })
  }

  // Sort: overdue first, then by contact name
  dueItems.sort((a, b) => b.daysOverdue - a.daysOverdue || a.enrollment.contact_name.localeCompare(b.enrollment.contact_name))

  // Build digest email body
  const appUrl = process.env.NEXTAUTH_URL || 'https://app.darkroom.com'
  const todayStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const typeLabel = (type: string) => type === 'call' ? '📞 Call' : type === 'text' ? '💬 Text' : '✉️ Email'

  const lines: string[] = [
    `Daily Cadence Digest — ${todayStr}`,
    ``,
    `${dueItems.length} step${dueItems.length !== 1 ? 's' : ''} due today`,
    ``,
    '─────────────────────────────────────────',
    '',
  ]

  for (const { enrollment, item, daysOverdue } of dueItems) {
    const company = enrollment.company_name ? ` (${enrollment.company_name})` : ''
    const overdueNote = daysOverdue > 0 ? ` — ⚠️ ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue` : ''
    lines.push(`${typeLabel(item.type)} — Day ${item.day_offset}: ${item.title}`)
    lines.push(`${enrollment.contact_name}${company}${overdueNote}`)
    lines.push(`${appUrl}/inbound/enrollments/${enrollment.id}`)
    lines.push(``)
    if (item.body) {
      const preview = item.body.split('\n').slice(0, 3).join('\n')
      lines.push(preview)
      lines.push(``)
    }
    lines.push('─────────────────────────────────────────')
    lines.push('')
  }

  const emailBody = lines.join('\n')
  const subject = `[Darkroom] ${dueItems.length} cadence step${dueItems.length !== 1 ? 's' : ''} due today`

  try {
    const senderProfile = await getGmailProfile(asaUser.id)
    const fromEmail = senderProfile?.email || asaUser.email
    const fromName = asaUser.name || 'Darkroom'

    await sendGmailEmail({
      userId: asaUser.id,
      to: asaUser.email,
      subject,
      body: emailBody,
      fromName,
      fromEmail,
    })

    console.log(`Cadence digest sent: ${dueItems.length} items to ${asaUser.email}`)
    return NextResponse.json({ success: true, sent: true, itemCount: dueItems.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed'
    console.error('Cadence digest send error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
