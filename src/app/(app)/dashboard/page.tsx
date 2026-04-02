'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle, CheckCircle, Mail, Send, Clock, XCircle,
  TrendingUp, Users, Zap, ArrowRight, RefreshCw,
} from 'lucide-react'

interface DashboardData {
  today_queue: { total: number; pending: number; drafted: number; error: number }
  campaigns: CampaignCard[]
  gmail_connected: boolean
  error_count: number
}

interface CampaignCard {
  campaign_id: string
  name: string
  status: string
  total_enrolled: number
  active_contacts: number
  reply_rate: number
  drafts_today: number
  error_count: number
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400 border border-green-700/50',
    paused: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50',
    completed: 'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    draft: 'bg-gray-800 text-gray-400 border border-gray-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const gmailConnected = searchParams.get('gmailConnected')
  const gmailError = searchParams.get('gmailError')

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-800 rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Zap className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {/* Notifications */}
      {gmailConnected === '1' && (
        <div className="flex items-center gap-3 bg-green-900/30 border border-green-700/50 text-green-300 rounded-xl px-4 py-3 text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Gmail connected successfully!
        </div>
      )}
      {gmailError && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          Gmail connection failed: {gmailError === 'access_denied' ? 'Access was denied.' :
            gmailError === 'no_refresh_token' ? 'No refresh token received. Please try again.' :
            'Server error. Please try again.'}
        </div>
      )}
      {!data?.gmail_connected && (
        <div className="flex items-center justify-between bg-yellow-900/20 border border-yellow-700/40 text-yellow-300 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Gmail is not connected. Connect your Gmail account to send drafts.
          </div>
          <a
            href="/api/gmail/connect"
            className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Connect Gmail
          </a>
        </div>
      )}
      {(data?.error_count ?? 0) > 0 && (
        <div className="flex items-center justify-between bg-red-900/20 border border-red-700/40 text-red-300 rounded-xl px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {data?.error_count} email{data?.error_count !== 1 ? 's' : ''} have errors and need attention.
          </div>
          <Link href="/analytics" className="text-red-400 hover:text-red-300 text-xs underline">
            View errors
          </Link>
        </div>
      )}

      {/* Today's Queue */}
      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">Today&apos;s Queue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Scheduled', value: data?.today_queue.total || 0, icon: Clock, color: 'text-gray-300' },
            { label: 'Drafts Created', value: data?.today_queue.drafted || 0, icon: Send, color: 'text-green-400' },
            { label: 'Pending', value: data?.today_queue.pending || 0, icon: RefreshCw, color: 'text-blue-400' },
            { label: 'Errors', value: data?.today_queue.error || 0, icon: XCircle, color: 'text-red-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">{label}</span>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Campaign Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Active Campaigns</h2>
          <Link href="/campaigns" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!data?.campaigns?.length ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No campaigns yet.</p>
            <Link href="/campaigns/new" className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 inline-block">
              Create your first campaign →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {data.campaigns.map(c => (
              <Link
                key={c.campaign_id}
                href={`/campaigns/${c.campaign_id}`}
                className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-white text-sm truncate">{c.name}</h3>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.total_enrolled} enrolled</span>
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{c.reply_rate || 0}% reply rate</span>
                      {c.drafts_today > 0 && <span className="text-green-400">{c.drafts_today} drafted today</span>}
                      {c.error_count > 0 && <span className="text-red-400">{c.error_count} errors</span>}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <DashboardContent />
    </Suspense>
  )
}

function Megaphone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}
