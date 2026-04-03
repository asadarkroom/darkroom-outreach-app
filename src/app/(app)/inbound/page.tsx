'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Mail, Clock, CheckCircle, AlertTriangle, Star, MessageSquare,
  ArrowRight, RefreshCw, Settings,
} from 'lucide-react'

interface InboundStats {
  total: number
  active: number
  replied: number
  draft_review: number
  completed: number
  error: number
}

interface Enrollment {
  id: string
  contact_name: string
  contact_email: string
  company_name: string | null
  services_interested: string | null
  media_budget: string | null
  status: string
  is_high_value: boolean
  research_summary: string | null
  enrolled_at: string
  reply_detected_at: string | null
}

function StatusBadge({ status, isHighValue }: { status: string; isHighValue: boolean }) {
  const map: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400 border border-green-700/50',
    replied: 'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    draft_review: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50',
    completed: 'bg-gray-800 text-gray-400 border border-gray-700',
    error: 'bg-red-900/50 text-red-400 border border-red-700/50',
    unenrolled: 'bg-gray-800 text-gray-500 border border-gray-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.active}`}>
      {isHighValue && <Star className="w-2.5 h-2.5" />}
      {status === 'draft_review' ? 'Needs Review' : status}
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
            Auto-enrolled from HubSpot form submissions
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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} icon={Mail} color="bg-gray-700/50 text-gray-400" />
          <StatCard label="Active" value={stats.active} icon={Clock} color="bg-green-900/50 text-green-400" />
          <StatCard label="Replied" value={stats.replied} icon={MessageSquare} color="bg-blue-900/50 text-blue-400" />
          <StatCard label="Needs Review" value={stats.draft_review} icon={Star} color="bg-yellow-900/50 text-yellow-400" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle} color="bg-indigo-900/50 text-indigo-400" />
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

      {/* Needs Review Banner */}
      {stats && stats.draft_review > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">
                {stats.draft_review} high-value {stats.draft_review === 1 ? 'lead' : 'leads'} need manual review
              </p>
              <p className="text-xs text-yellow-500 mt-0.5">
                These companies exceed the $20M revenue / $50k ad spend threshold and were held for your approval.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('draft_review')}
            className="px-3 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors flex-shrink-0"
          >
            Review Now
          </button>
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
          <option value="draft_review">Needs Review</option>
          <option value="active">Active</option>
          <option value="replied">Replied</option>
          <option value="completed">Completed</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Enrollments Table */}
      {enrollments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Mail className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No inbound enrollments yet</p>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Enrolled</th>
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
                  <td className="px-4 py-3 text-gray-400 text-xs">{e.media_budget || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} isHighValue={e.is_high_value} />
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
