/**
 * GET /api/cron/process-visitors
 * Daily cron: read new rows from the Google Sheet and enroll web visitors.
 * Also sends any pending visitor emails due today.
 * Schedule: 9:00 AM UTC daily
 */

import { NextRequest, NextResponse } from 'next/server'
import { processVisitorSheet } from '@/lib/visitors/process-sheet'
import { processVisitorEmailsDue } from '@/lib/visitors/process-emails'

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
    // 1. Process new sheet rows
    const sheetResults = await processVisitorSheet()

    // 2. Send any pending visitor emails due today (follow-up steps)
    const emailResults = await processVisitorEmailsDue(today)

    const result = { date: today, sheet: sheetResults, emails: emailResults }
    console.log('Visitor process cron complete:', JSON.stringify(result))
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cron failed'
    console.error('Visitor process cron error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
