/**
 * Web visitor enrollment logic.
 *
 * Flow for each new sheet row:
 * 1. Check HubSpot for existing deal — skip if found
 * 2. Research the company with Claude
 * 3. Skip if not a good fit
 * 4. Skip if no email address
 * 5. Create visitor_enrollment record
 * 6. Schedule visitor_emails for each email step
 * 7. Process day-0 email immediately
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { assessCompany } from '@/lib/research/assess'
import { checkDealExists } from '@/lib/hubspot/client'
import type { SheetRow } from '@/lib/sheets/client'
import { processVisitorEmail } from './process-emails'

export interface VisitorEnrollResult {
  rowNumber: number
  company: string
  outcome: 'enrolled' | 'skipped_deal' | 'skipped_fit' | 'no_email' | 'error'
  reason?: string
}

export async function enrollVisitorContact(
  row: SheetRow,
  sequenceId: string
): Promise<VisitorEnrollResult> {
  const supabase = createAdminClient()
  const companyName = row.company || row.name

  // 1. Check HubSpot for existing deal — record in DB so it shows in the UI
  if (companyName) {
    const dealExists = await checkDealExists(companyName).catch(() => false)
    if (dealExists) {
      await supabase.from('visitor_enrollments').insert({
        sequence_id: null,
        contact_name: row.name,
        contact_email: row.email?.toLowerCase() || null,
        company_name: companyName || null,
        company_url: row.companyUrl || null,
        company_size: row.companySize || null,
        job_title: row.title || null,
        visited_page: row.visitedPage || null,
        visit_date: row.date ? new Date(row.date).toISOString() : null,
        industry: row.industry || null,
        sheet_row_number: row.rowNumber,
        google_sheet_id: process.env.GOOGLE_VISITOR_SHEET_ID || null,
        status: 'skipped',
        fit_assessment: 'existing_deal',
        hubspot_deal_found: true,
      })
      return { rowNumber: row.rowNumber, company: companyName, outcome: 'skipped_deal', reason: 'Existing HubSpot deal' }
    }
  }

  // 2. Research the company
  const research = await assessCompany({
    companyName: companyName || 'Unknown',
    companyUrl: row.companyUrl || null,
    industry: row.industry || null,
  })

  // 3. Skip if not a good fit
  if (!research.is_good_fit) {
    // Still record in DB as skipped so we don't re-process
    await supabase.from('visitor_enrollments').insert({
      sequence_id: sequenceId,
      contact_name: row.name,
      contact_email: row.email || null,
      company_name: companyName || null,
      company_url: row.companyUrl || null,
      company_size: row.companySize || null,
      job_title: row.title || null,
      visited_page: row.visitedPage || null,
      visit_date: row.date ? new Date(row.date).toISOString() : null,
      industry: row.industry || null,
      sheet_row_number: row.rowNumber,
      google_sheet_id: process.env.GOOGLE_VISITOR_SHEET_ID || null,
      status: 'skipped',
      fit_assessment: 'not_fit',
      research_summary: research.summary,
      hubspot_deal_found: false,
    })
    return { rowNumber: row.rowNumber, company: companyName, outcome: 'skipped_fit', reason: research.fit_reason }
  }

  // 4. Skip if no email
  if (!row.email) {
    await supabase.from('visitor_enrollments').insert({
      sequence_id: sequenceId,
      contact_name: row.name,
      contact_email: null,
      company_name: companyName || null,
      company_url: row.companyUrl || null,
      company_size: row.companySize || null,
      job_title: row.title || null,
      visited_page: row.visitedPage || null,
      visit_date: row.date ? new Date(row.date).toISOString() : null,
      industry: row.industry || null,
      sheet_row_number: row.rowNumber,
      google_sheet_id: process.env.GOOGLE_VISITOR_SHEET_ID || null,
      status: 'no_email',
      fit_assessment: 'good_fit',
      research_summary: research.summary,
      hubspot_deal_found: false,
    })
    return { rowNumber: row.rowNumber, company: companyName, outcome: 'no_email' }
  }

  // Check for duplicate email in visitor_enrollments
  const { data: existing } = await supabase
    .from('visitor_enrollments')
    .select('id')
    .eq('contact_email', row.email.toLowerCase())
    .not('status', 'in', '(skipped,no_email)')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { rowNumber: row.rowNumber, company: companyName, outcome: 'skipped_fit', reason: 'Already enrolled' }
  }

  // 5. Get sequence steps (email only)
  const { data: steps, error: stepsErr } = await supabase
    .from('visitor_sequence_steps')
    .select('id, step_number, day_offset, step_type')
    .eq('sequence_id', sequenceId)
    .eq('step_type', 'email')
    .order('step_number', { ascending: true })

  if (stepsErr || !steps || steps.length === 0) {
    return { rowNumber: row.rowNumber, company: companyName, outcome: 'error', reason: 'No email steps in sequence' }
  }

  const enrolledAt = new Date()

  // 6. Create enrollment
  const { data: enrollment, error: enrollErr } = await supabase
    .from('visitor_enrollments')
    .insert({
      sequence_id: sequenceId,
      contact_name: row.name,
      contact_email: row.email.toLowerCase(),
      company_name: companyName || null,
      company_url: row.companyUrl || null,
      company_size: row.companySize || null,
      job_title: row.title || null,
      visited_page: row.visitedPage || null,
      visit_date: row.date ? new Date(row.date).toISOString() : null,
      industry: row.industry || null,
      sheet_row_number: row.rowNumber,
      google_sheet_id: process.env.GOOGLE_VISITOR_SHEET_ID || null,
      status: 'active',
      fit_assessment: research.is_high_value ? 'good_fit' : 'good_fit',
      research_summary: research.summary,
      hubspot_deal_found: false,
      enrolled_at: enrolledAt.toISOString(),
    })
    .select('id')
    .single()

  if (enrollErr || !enrollment) {
    return { rowNumber: row.rowNumber, company: companyName, outcome: 'error', reason: enrollErr?.message }
  }

  // 7. Schedule emails
  const emailRows = steps.map((step) => {
    const sendDate = new Date(enrolledAt)
    sendDate.setDate(sendDate.getDate() + step.day_offset)
    return {
      enrollment_id: enrollment.id,
      step_id: step.id,
      send_date: sendDate.toISOString().split('T')[0],
      status: 'pending',
    }
  })

  await supabase.from('visitor_emails').insert(emailRows)

  // 8. Process day-0 email immediately
  const today = enrolledAt.toISOString().split('T')[0]
  const { data: day0Row } = await supabase
    .from('visitor_emails')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .eq('send_date', today)
    .single()

  if (day0Row) {
    await processVisitorEmail(day0Row.id).catch((err) => {
      console.error('Day-0 visitor email processing error:', err)
    })
  }

  return { rowNumber: row.rowNumber, company: companyName, outcome: 'enrolled' }
}
