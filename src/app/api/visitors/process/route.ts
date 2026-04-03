/**
 * POST /api/visitors/process
 * Manual trigger to process the Google Sheet and enroll new web visitors.
 * Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { processVisitorSheet } from '@/lib/visitors/process-sheet'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await processVisitorSheet()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    console.error('Manual visitor process error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
