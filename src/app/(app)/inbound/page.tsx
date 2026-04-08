'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Mail, Clock, CheckCircle, AlertTriangle, MessageSquare,
  ArrowRight, RefreshCw, Settings, UserX,
} from 'lucide-react'

interface InboundStats {
  total: number
  active: number
  replied: number
  completed: number
  unenrolled: number
  error: number
}

interface Enrollment {
  id: string
  contact_name: string
  contact_email: string
  company_name: string | null
  services_interested: string | null
  media_budget: string | null
  inquiry_type: string | null
  status: string
  enrolled_at: string
  reply_detected_at: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:     'bg-green-900/50 text-green-400 border border-green-700/50',
    replied:    'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    completed:  'bg-gray-800 text-gray-400 border border-gray-700',
    unenrolled: 'bg-orange-900/50 text-orange-400 border border-orange-700/50',
    error:      'bg-red-900/50 text-red-400 border border-red-700/50',
  }
  const labels: Record<string, string> = {
    active: 'Draft Created',
    replied: 'Replied',
    completed: 'Completed',
    unenrolled: 'No Sequence',
    error: 'Error',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.active}`}>
      {labels[status] || status}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

export default function InboundPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [stats, setStats] = useState<InboundStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('limit', '100')

      const res = await fetch(`/api/inbound/enrollments?${params}`)
      const data = await res.json()
      setEnrollments(data.enrollments || [])
      setStats(data.stats || null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, search])

  const replyRate = stats && stats.total > 0
    ? Math.round((stats.replied / stats.total) * 100)
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
          <h1 className="text-xl font-semibold text-white">Inbound Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HubSpot form submissions — Gmail draft created for each lead
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
          <Link
            href="/inbound/sequences"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Sequences
          </Link>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={Mail} color="bg-gray-700/50 text-gray-400" />
          <StatCard label="Draft Created" value={stats.active} icon={Clock} color="bg-green-900/50 text-green-400" />
          <StatCard label="Replied" value={stats.replied} icon={MessageSquare} color="bg-blue-900/50 text-blue-400" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="bg-indigo-900/50 text-indigo-400" />
          <StatCard label="No Sequence" value={stats.unenrolled} icon={UserX} color="bg-orange-900/50 text-orange-400" />
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Reply Rate</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-900/50 text-purple-400">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-white">{replyRate}%</p>
          </div>
        </div>
      )}

      {/* No-sequence warning */}
      {stats && stats.unenrolled > 0 && (
        <div className="bg-orange-900/20 border border-orange-700/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserX className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-300">
                {stats.unenrolled} lead{stats.unenrolled !== 1 ? 's' : ''} received with no active sequence
              </p>
              <p className="text-xs text-orange-500 mt-0.5">
                Create and activate an inbound sequence so future submissions get drafted automatically.
              </p>
            </div>
          </div>
          <Link
            href="/inbound/sequences"
            className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex-shrink-0"
          >
            Set up Sequence
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search name, email, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="active">Draft Created</option>
          <option value="replied">Replied</option>
          <option value="completed">Completed</option>
          <option value="unenrolled">No Sequence</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Enrollments Table */}
      {enrollments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Mail className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No inbound leads yet</p>
          <p className="text-gray-600 text-sm mt-1">
            Configure Zapier to POST to <code className="text-indigo-400">/api/webhooks/hubspot</code> when a new form submission arrives.
          </p>
          <Link
            href="/inbound/sequences"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Set up inbound sequence
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Services</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Received</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {enrollments.map((e) => (
                <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{e.contact_name}</p>
                    <p className="text-gray-500 text-xs">{e.contact_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{e.company_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate" title={e.services_interested || ''}>
                    {e.services_interested || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{e.media_budget || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(e.enrolled_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/inbound/enrollments/${e.id}`}
                      className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
