/**
 * POST /api/inbound/enrollments/[id]/approve
 *
 * Approve a high-value enrollment that's pending manual review (status: draft_review).
 * This sends all drafted emails immediately and marks the enrollment as active.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { createAdminClient } from '@/lib/supabase/admin'
import { processInboundEmail } from '@/lib/inbound/process-emails'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createAdminClient()

  // Verify enrollment exists and is in draft_review
  const { data: enrollment, error: enrollErr } = await supabase
    .from('inbound_enrollments')
    .select('id, status, is_high_value')
    .eq('id', id)
    .single()

  if (enrollErr || !enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  if (enrollment.status !== 'draft_review') {
    return NextResponse.json({ error: 'Enrollment is not in draft_review status' }, { status: 400 })
  }

  // Mark as active (removes high-value draft hold)
  await supabase
    .from('inbound_enrollments')
    .update({ status: 'active', is_high_value: false })
    .eq('id', id)

  // Get all pending/draft emails and process them
  const { data: pendingEmails } = await supabase
    .from('inbound_emails')
    .select('id')
    .eq('enrollment_id', id)
    .in('status', ['pending', 'draft'])

  const results = []
  for (const email of pendingEmails || []) {
    // Reset draft status back to pending so processInboundEmail will send it
    await supabase.from('inbound_emails').update({ status: 'pending', gmail_draft_id: null }).eq('id', email.id)
    const result = await processInboundEmail(email.id)
    results.push(result)
  }

  return NextResponse.json({ success: true, emails_processed: results.length, results })
}
