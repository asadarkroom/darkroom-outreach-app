/**
 * GET /api/cron/send-inbound
 * Daily cron: send all pending inbound emails due today.
 * Schedule: 7:30 AM UTC (after the main generate-drafts cron)
 */

import { NextRequest, NextResponse } from 'next/server'
import { processInboundEmailsDue } from '@/lib/inbound/process-emails'

function verifyCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const results = await processInboundEmailsDue(today)
    console.log('Inbound send cron complete:', results)
    return NextResponse.json({ success: true, date: today, ...results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed'
    console.error('Inbound send cron error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
