/**
 * Daily Google Sheet processing for web visitor outreach.
 *
 * Reads new rows from the Live Feed tab, runs research + enrollment
 * for each unprocessed row.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getUnprocessedVisitorRows } from '@/lib/sheets/client'
import { enrollVisitorContact, type VisitorEnrollResult } from './enroll'

const SHEET_ID = process.env.GOOGLE_VISITOR_SHEET_ID || '1VaeFhD1SGMDkIdZ8lqIBaVvkBQ4WtGsDxvkTRaGJveI'

export interface ProcessSheetResult {
  rowsRead: number
  enrolled: number
  skippedDeal: number
  skippedFit: number
  noEmail: number
  errors: number
  results: VisitorEnrollResult[]
}

export async function processVisitorSheet(): Promise<ProcessSheetResult> {
  const supabase = createAdminClient()

  // Get the active visitor sequence
  const { data: sequence, error: seqErr } = await supabase
    .from('visitor_sequences')
    .select('id, sender_user_id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (seqErr || !sequence) {
    throw new Error('No active visitor sequence found. Please configure one at /web-visitors/sequences.')
  }

  // Read unprocessed rows from the sheet
  const rows = await getUnprocessedVisitorRows(SHEET_ID)

  const result: ProcessSheetResult = {
    rowsRead: rows.length,
    enrolled: 0,
    skippedDeal: 0,
    skippedFit: 0,
    noEmail: 0,
    errors: 0,
    results: [],
  }

  if (rows.length === 0) {
    return result
  }

  for (const row of rows) {
    try {
      const enrollResult = await enrollVisitorContact(row, sequence.id)
      result.results.push(enrollResult)

      switch (enrollResult.outcome) {
        case 'enrolled': result.enrolled++; break
        case 'skipped_deal': result.skippedDeal++; break
        case 'skipped_fit': result.skippedFit++; break
        case 'no_email': result.noEmail++; break
        case 'error': result.errors++; break
      }
    } catch (err) {
      console.error(`Error processing sheet row ${row.rowNumber}:`, err)
      result.errors++
      result.results.push({
        rowNumber: row.rowNumber,
        company: row.company || row.name,
        outcome: 'error',
        reason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return result
}
