'use client'

import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { Upload, X, Check, AlertTriangle, ChevronDown } from 'lucide-react'

const EXPECTED_FIELDS = [
  { key: 'email', label: 'Email', required: true },
  { key: 'first_name', label: 'First Name', required: false },
  { key: 'last_name', label: 'Last Name', required: false },
  { key: 'company_name', label: 'Company', required: false },
  { key: 'job_title', label: 'Job Title', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'website_or_linkedin', label: 'Website / LinkedIn', required: false },
  { key: 'custom_notes', label: 'Custom Notes', required: false },
]

interface Props {
  campaignId: string
  onImported: (count: number) => void
}

type Step = 'upload' | 'map' | 'preview' | 'done'

export default function CSVUpload({ campaignId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')

  function handleFile(file: File) {
    setError('')
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data.length) { setError('CSV file is empty'); return }
        const csvHeaders = result.meta.fields || []
        setHeaders(csvHeaders)
        setRows(result.data as Record<string, string>[])

        // Auto-map if header names match exactly (case-insensitive)
        const autoMap: Record<string, string> = {}
        for (const field of EXPECTED_FIELDS) {
          const match = csvHeaders.find(h => h.toLowerCase().replace(/[\s_-]/g, '') === field.key.replace(/_/g, ''))
          if (match) autoMap[field.key] = match
          // also handle exact match
          const exact = csvHeaders.find(h => h.toLowerCase() === field.key.toLowerCase() || h.toLowerCase() === field.label.toLowerCase())
          if (exact) autoMap[field.key] = exact
        }
        setMapping(autoMap)
        setStep('map')
      },
      error: (err) => setError('Failed to parse CSV: ' + err.message),
    })
  }

  function getMappedRows() {
    return rows.map(row => {
      const mapped: Record<string, string> = {}
      for (const field of EXPECTED_FIELDS) {
        const csvCol = mapping[field.key]
        if (csvCol) mapped[field.key] = row[csvCol] || ''
      }
      return mapped
    }).filter(r => r.email?.trim())
  }

  async function doImport() {
    setError('')
    const mapped = getMappedRows()
    if (!mapped.length) { setError('No valid rows (email is required)'); return }

    setImporting(true)
    const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped),
    })
    const data = await res.json()
    setImporting(false)

    if (!res.ok) { setError(data.error || 'Import failed'); return }

    setStep('done')
    onImported(data.imported)
  }

  if (step === 'done') {
    return (
      <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-6 text-center">
        <Check className="w-8 h-8 text-green-400 mx-auto mb-2" />
        <p className="text-green-300 text-sm font-medium">Contacts imported successfully!</p>
        <button onClick={() => { setStep('upload'); setRows([]); setHeaders([]); setMapping({}) }}
          className="text-green-400 hover:text-green-300 text-xs mt-2 underline">
          Import more
        </button>
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <div
        className="border-2 border-dashed border-gray-700 hover:border-gray-600 rounded-xl p-10 text-center cursor-pointer transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onDragOver={e => e.preventDefault()}
      >
        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
        <p className="text-white text-sm font-medium mb-1">Drop a CSV file or click to upload</p>
        <p className="text-gray-500 text-xs">Required column: email. Optional: first_name, last_name, company_name, job_title, industry, website_or_linkedin, custom_notes</p>
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
    )
  }

  if (step === 'map') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Map Your CSV Columns</h3>
          <button onClick={() => setStep('upload')} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400">{rows.length} rows detected. Map your columns to the expected fields below.</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg px-3 py-2 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          {EXPECTED_FIELDS.map(field => (
            <div key={field.key} className="flex items-center gap-3">
              <div className="w-36 flex-shrink-0">
                <span className="text-xs text-gray-300">{field.label}</span>
                {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
              </div>
              <div className="relative flex-1">
                <select
                  value={mapping[field.key] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full appearance-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-8"
                >
                  <option value="">— skip —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
              {mapping[field.key] && <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setStep('preview')} disabled={!mapping.email}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
            Preview ({getMappedRows().length} contacts)
          </button>
          <button onClick={doImport} disabled={importing || !mapping.email}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
            {importing ? 'Importing…' : `Import ${getMappedRows().length} Contacts`}
          </button>
        </div>
      </div>
    )
  }

  // Preview step
  const mapped = getMappedRows()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Preview ({mapped.length} contacts)</h3>
        <button onClick={() => setStep('map')} className="text-gray-400 hover:text-white text-xs">← Back</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900">
              {EXPECTED_FIELDS.filter(f => mapping[f.key]).map(f => (
                <th key={f.key} className="px-3 py-2 text-left text-gray-400 font-medium">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapped.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                {EXPECTED_FIELDS.filter(f => mapping[f.key]).map(f => (
                  <td key={f.key} className="px-3 py-2 text-gray-300 max-w-32 truncate">{row[f.key] || '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {mapped.length > 5 && (
          <p className="text-center text-xs text-gray-500 py-2">…and {mapped.length - 5} more rows</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button onClick={() => setStep('map')} className="text-gray-400 hover:text-white text-sm transition-colors">Back</button>
        <button onClick={doImport} disabled={importing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          {importing ? 'Importing…' : `Confirm Import (${mapped.length})`}
        </button>
      </div>
    </div>
  )
}
