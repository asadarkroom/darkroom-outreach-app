import { NextRequest, NextResponse } from 'next/server'
import { generateDraftsForDate } from '@/lib/drafts/generate'

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
    const results = await generateDraftsForDate(today)
    console.log('Draft generation complete:', results)
    return NextResponse.json(results)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Cron draft generation failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
