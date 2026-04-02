'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Search, Filter, RefreshCw, X } from 'lucide-react'

interface AnalyticsData {
  overview: {
    name: string; status: string; total_enrolled: number; active_contacts: number
    completed_contacts: number; unenrolled_contacts: number; reply_rate: number
    drafts_today: number; error_count: number
  } | null
  steps: StepRow[]
  avg_steps_before_reply: number
  error_rate: number | string
}

interface StepRow {
  step_id: string; step_number: number; day_offset: number
  total_scheduled: number; drafted_count: number; error_count: number
  replies_attributed: number; reply_rate: number
}

interface ContactRow {
  id: string; first_name: string | null; last_name: string | null; company_name: string | null
  email: string; status: string; current_step: number; total_steps: number
  next_send_date: string | null; reply_detected_at: string | null
}

function StatTile({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function ContactStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-green-900/50 text-green-400 border-green-700/50',
    unenrolled:'bg-gray-800 text-gray-400 border-gray-700',
    completed: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    error:     'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] || map.active}`}>
      {status === 'unenrolled' ? 'Unenrolled (Replied)' : status}
    </span>
  )
}

export default function CampaignAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loading, setLoading] = useState(true)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [unenrolling, setUnenrolling] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/analytics/campaigns/${id}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadContacts()
  }, [id, search, statusFilter, dateFrom, dateTo])

  function loadContacts() {
    setContactsLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)

    fetch(`/api/analytics/campaigns/${id}/contacts?${params}`)
      .then(r => r.json())
      .then(d => setContacts(Array.isArray(d) ? d : []))
      .finally(() => setContactsLoading(false))
  }

  async function unenroll(contactId: string) {
    if (!confirm('Unenroll this contact from the campaign?')) return
    setUnenrolling(contactId)
    await fetch(`/api/contacts/${contactId}/unenroll`, { method: 'POST' })
    setUnenrolling(null)
    loadContacts()
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter) params.set('status', statusFilter)
    params.set('format', 'csv')
    window.location.href = `/api/analytics/campaigns/${id}/contacts?${params}`
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-gray-800 animate-pulse rounded" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-800 animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  const ov = data?.overview

  return (
    <div className="p-8 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <Link href="/analytics" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-3 transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Analytics
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{ov?.name || 'Campaign Analytics'}</h1>
            <p className="text-gray-400 text-sm mt-1">Detailed performance breakdown</p>
          </div>
          <Link href={`/campaigns/${id}`} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            View Campaign
          </Link>
        </div>
      </div>

      {/* Funnel Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatTile label="Total Enrolled" value={ov?.total_enrolled || 0} />
        <StatTile label="Active" value={ov?.active_contacts || 0} color="text-green-400" />
        <StatTile label="Completed" value={ov?.completed_contacts || 0} color="text-blue-400" />
        <StatTile label="Replied / Unenrolled" value={ov?.unenrolled_contacts || 0} color="text-indigo-400" />
        <StatTile label="Reply Rate" value={`${ov?.reply_rate || 0}%`} color={(ov?.reply_rate || 0) > 10 ? 'text-green-400' : 'text-white'} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Errors" value={ov?.error_count || 0} color={(ov?.error_count || 0) > 0 ? 'text-red-400' : 'text-gray-500'} />
        <StatTile label="Error Rate" value={`${data?.error_rate || 0}%`} />
        <StatTile label="Avg Steps Before Reply" value={data?.avg_steps_before_reply || 0} sub="for replied contacts" />
        <StatTile label="Drafted Today" value={ov?.drafts_today || 0} color="text-indigo-400" />
      </div>

      {/* Step Performance Table */}
      {data?.steps && data.steps.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-medium text-white">Step Performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Step</th>
                <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Day</th>
                <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Scheduled</th>
                <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Drafted</th>
                <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Errors</th>
                <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Replies</th>
                <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Reply Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.steps.map(s => (
                <tr key={s.step_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-5 py-3 text-white font-medium">Step {s.step_number}</td>
                  <td className="px-5 py-3 text-gray-400">Day {s.day_offset}</td>
                  <td className="px-5 py-3 text-right text-gray-300">{s.total_scheduled}</td>
                  <td className="px-5 py-3 text-right text-green-400">{s.drafted_count}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={s.error_count > 0 ? 'text-red-400 font-medium' : 'text-gray-500'}>{s.error_count}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-indigo-400">{s.replies_attributed}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={(s.reply_rate || 0) > 0 ? 'text-green-400 font-medium' : 'text-gray-500'}>
                      {s.reply_rate || 0}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contact Status Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Contacts ({contacts.length})</h2>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-8 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="unenrolled">Unenrolled</option>
                <option value="completed">Completed</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>From:</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              <span>To:</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            {(search || statusFilter || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo('') }}
                className="text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {contactsLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading contacts…</div>
        ) : contacts.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No contacts match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Contact</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Email</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Step</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Next Send</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Status</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Replied</th>
                  <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3">
                      <p className="text-white font-medium">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</p>
                      {c.company_name && <p className="text-xs text-gray-500">{c.company_name}</p>}
                    </td>
                    <td className="px-5 py-3 text-gray-300 font-mono text-xs">{c.email}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {c.current_step}/{c.total_steps}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {c.next_send_date ? new Date(c.next_send_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3"><ContactStatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {c.reply_detected_at ? new Date(c.reply_detected_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status === 'active' && (
                          <button
                            onClick={() => unenroll(c.id)}
                            disabled={unenrolling === c.id}
                            className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
                          >
                            {unenrolling === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            Unenroll
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
