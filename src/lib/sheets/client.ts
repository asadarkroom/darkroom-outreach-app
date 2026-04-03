/**
 * Google Sheets API client using a service account.
 *
 * Setup required:
 * 1. In Google Cloud Console, enable the Google Sheets API for your project.
 * 2. Create a service account and download its JSON key.
 * 3. Share the target Google Sheet with the service account email (Viewer access).
 * 4. Set GOOGLE_SHEETS_CREDENTIALS env var to the full JSON key contents.
 *    Example: GOOGLE_SHEETS_CREDENTIALS='{"type":"service_account","project_id":...}'
 */

import { google } from 'googleapis'

function getAuth() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS
  if (!raw) throw new Error('GOOGLE_SHEETS_CREDENTIALS env var is not set')

  const credentials = JSON.parse(raw)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export interface SheetRow {
  rowNumber: number
  name: string
  email: string
  linkedin: string
  company: string
  companyUrl: string
  companySize: string
  title: string
  visitedPage: string
  date: string
  industry: string
  status: string      // col K
  fitTimestamp: string // col L
}

/**
 * Read the Live Feed tab from the web visitor Google Sheet.
 * Returns rows that have not been processed yet (col K is empty or "Not Started").
 *
 * Column mapping (1-indexed):
 *  A=name, B=email, C=linkedin, D=company, E=companyUrl,
 *  F=companySize, G=title, H=visitedPage, I=date, J=industry,
 *  K=status, L=fit+timestamp
 */
export async function getUnprocessedVisitorRows(
  sheetId: string,
  tabName = 'Live Feed'
): Promise<SheetRow[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!A2:L`,
  })

  const rawRows = res.data.values || []
  const results: SheetRow[] = []

  rawRows.forEach((row, idx) => {
    const status = (row[10] || '').trim()
    // Skip rows already processed (non-empty K, unless it's "Not Started")
    if (status && status !== 'Not Started') return

    const name = (row[0] || '').trim()
    const email = (row[1] || '').trim()
    const company = (row[3] || '').trim()

    // Skip rows without a name or company (incomplete data)
    if (!name && !company) return

    results.push({
      rowNumber: idx + 2, // +2 because data starts at row 2 (row 1 is header)
      name,
      email,
      linkedin: (row[2] || '').trim(),
      company,
      companyUrl: (row[4] || '').trim(),
      companySize: (row[5] || '').trim(),
      title: (row[6] || '').trim(),
      visitedPage: (row[7] || '').trim(),
      date: (row[8] || '').trim(),
      industry: (row[9] || '').trim(),
      status,
      fitTimestamp: (row[11] || '').trim(),
    })
  })

  return results
}

/**
 * Get the most recently processed row date from the sheet
 * by finding the last non-empty value in column L.
 */
export async function getLastProcessedDate(
  sheetId: string,
  tabName = 'Live Feed'
): Promise<string | null> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabName}'!L2:L`,
  })

  const values = res.data.values || []
  // Find last row with a value
  for (let i = values.length - 1; i >= 0; i--) {
    const val = (values[i]?.[0] || '').trim()
    if (val) return val
  }
  return null
}
