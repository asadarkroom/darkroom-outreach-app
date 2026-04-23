'use client'

import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import {
  Users, Mail, CheckCircle, Clock, XCircle, Download,
  RefreshCw, Settings, Play, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'

interface VisitorStats {
  total: number
  active: number
  replied: number
  completed: number
  skipped: number
  no_email: number
  good_fit: number
  not_fit: number
  existing_deal: number
}

interface Enrollment {
  id: string
  contact_name: string
  contact_email: string | null
  company_name: string | null
  industry: string | null
  visited_page: string | null
  status: string
  fit_assessment: string | null
  research_summary: string | null
  enrolled_at: string
  reply_detected_at: string | null
}

function FitBadge({ fit }: { fit: string | null }) {
  const map: Record<string, string> = {
    good_fit:      'bg-green-900/50 text-green-400 border border-green-700/50',
    not_fit:       'bg-red-900/50 text-red-400 border border-red-700/50',
    existing_deal: 'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    uncertain:     'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50',
  }
  const labels: Record<string, string> = {
    good_fit: 'Good Fit', not_fit: 'Not a Fit',
    existing_deal: 'Existing Deal', uncertain: 'Uncertain',
  }
  if (!fit) return <span className="text-gray-600 text-xs">—</span>
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[fit] || ''}`}>
      {labels[fit] || fit}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-green-900/50 text-green-400 border border-green-700/50',
    replied:   'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    completed: 'bg-gray-800 text-gray-400 border border-gray-700',
    skipped:   'bg-gray-800 text-gray-500 border border-gray-700',
    no_email:  'bg-orange-900/50 text-orange-400 border border-orange-700/50',
    error:     'bg-red-900/50 text-red-400 border border-red-700/50',
  }
  const labels: Record<string, string> = {
    active: 'Draft Created', replied: 'Replied', completed: 'Completed',
    skipped: 'Skipped', no_email: 'No Email', error: 'Error',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs border ${map[status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
          <Icon className="w-3 h-3" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

export default function WebVisitorsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [stats, setStats] = useState<VisitorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [fitFilter, setFitFilter] = useState('')
  const [search, setSearch] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processResult, setProcessResult] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  async function load() {
    setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (fitFilter) params.set('fit', fitFilter)
      if (search) params.set('search', search)
      params.set('limit', '100')

      const res = await fetch(`/api/visitors/enrollments?${params}`)
      const data = await res.json()
      setEnrollments(data.enrollments || [])
      setStats(data.stats || null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function runProcess() {
    setProcessing(true)
    setProcessResult('')
    try {
      const res = await fetch('/api/visitors/process', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setProcessResult(`Error: ${data.error}`)
      } else {
        setProcessResult(
          `Processed ${data.sheet?.rowsRead ?? 0} rows — ${data.sheet?.enrolled ?? 0} enrolled, ` +
          `${data.sheet?.skippedFit ?? 0} not a fit, ${data.sheet?.skippedDeal ?? 0} existing deals`
        )
        await load()
      }
    } finally {
      setProcessing(false)
    }
  }

  function exportCsv() {
    window.open('/api/visitors/enrollments?format=csv', '_blank')
  }

  useEffect(() => { load() }, [statusFilter, fitFilter, search])

  const replyRate = stats && stats.total > 0
    ? Math.round(((stats.replied) / Math.max(stats.active + stats.replied + stats.completed, 1)) * 100)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Web Visitor Outreach</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auto-processed daily from Google Sheet web visitor feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={runProcess}
            disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${processing ? 'animate-pulse' : ''}`} />
            {processing ? 'Processing...' : 'Run Now'}
          </button>
          <Link
            href="/web-visitors/sequences"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Sequences
          </Link>
        </div>
      </div>

      {processResult && (
        <div className={`border rounded-xl p-3 text-sm ${
          processResult.startsWith('Error')
            ? 'bg-red-900/20 border-red-700/50 text-red-400'
            : 'bg-green-900/20 border-green-700/50 text-green-400'
        }`}>
          {processResult.startsWith('Error') ? <AlertTriangle className="w-4 h-4 inline mr-1" /> : <CheckCircle className="w-4 h-4 inline mr-1" />}
          {processResult}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total Seen" value={stats.total} icon={Users} color="bg-gray-700/50 text-gray-400" />
          <StatCard label="Good Fit" value={stats.good_fit} icon={CheckCircle} color="bg-green-900/50 text-green-400" />
          <StatCard label="Not a Fit" value={stats.not_fit} icon={XCircle} color="bg-red-900/50 text-red-400" />
          <StatCard label="Existing Deal" value={stats.existing_deal} icon={CheckCircle} color="bg-blue-900/50 text-blue-400" />
          <StatCard label="Enrolled" value={stats.active} icon={Clock} color="bg-indigo-900/50 text-indigo-400" />
          <StatCard label="Replied" value={stats.replied} icon={Mail} color="bg-purple-900/50 text-purple-400" />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <span className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Reply Rate</span>
            <p className="text-2xl font-semibold text-white">{replyRate}%</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search name, email, company..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="replied">Replied</option>
          <option value="completed">Completed</option>
          <option value="skipped">Skipped</option>
          <option value="no_email">No Email</option>
        </select>
        <select
          value={fitFilter}
          onChange={e => setFitFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All fit types</option>
          <option value="good_fit">Good Fit</option>
          <option value="not_fit">Not a Fit</option>
          <option value="existing_deal">Existing Deal</option>
        </select>
      </div>

      {/* Table */}
      {enrollments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No web visitor enrollments yet</p>
          <p className="text-gray-600 text-sm mt-1 mb-4">
            Click &quot;Run Now&quot; to process the Google Sheet and enroll new visitors.
          </p>
          <Link href="/web-visitors/sequences" className="text-indigo-400 text-sm hover:text-indigo-300">
            Configure a sequence first →
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fit</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Enrolled</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {enrollments.map(e => (
                <Fragment key={e.id}>
                  <tr
                    className="hover:bg-gray-800/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {e.research_summary
                          ? expandedRow === e.id
                            ? <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-gray-500 flex-shrink-0" />
                          : <span className="w-3 h-3 flex-shrink-0" />
                        }
                        <div>
                          <p className="font-medium text-white">{e.contact_name}</p>
                          <p className="text-gray-500 text-xs">{e.contact_email || 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{e.company_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{e.industry || '—'}</td>
                    <td className="px-4 py-3"><FitBadge fit={e.fit_assessment} /></td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(e.enrolled_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={ev => ev.stopPropagation()}>
                      <Link
                        href={`/web-visitors/enrollments/${e.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                  {expandedRow === e.id && e.research_summary && (
                    <tr className="bg-gray-800/20">
                      <td colSpan={7} className="px-10 py-3 border-t border-gray-800/50">
                        <p className="text-xs text-gray-400 leading-relaxed">{e.research_summary}</p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
