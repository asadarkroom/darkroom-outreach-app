'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Users, TrendingUp, ChevronRight, Pause, Play } from 'lucide-react'

interface Campaign {
  campaign_id: string
  name: string
  status: string
  total_enrolled: number
  active_contacts: number
  completed_contacts: number
  unenrolled_contacts: number
  reply_rate: number
  drafts_today: number
  error_count: number
  created_at: string
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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/campaigns')
      .then(r => r.json())
      .then(data => setCampaigns(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  async function toggleStatus(id: string, current: string) {
    const next = current === 'active' ? 'paused' : 'active'
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setCampaigns(prev => prev.map(c =>
      c.campaign_id === id ? { ...c, status: next } : c
    ))
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-40 bg-gray-800 animate-pulse rounded" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-800 animate-pulse rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Campaigns</h1>
          <p className="text-gray-400 text-sm mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-white font-medium mb-1">No campaigns yet</h3>
          <p className="text-gray-400 text-sm mb-4">Create your first outreach campaign to get started.</p>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.campaign_id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Link href={`/campaigns/${c.campaign_id}`} className="font-medium text-white hover:text-indigo-400 transition-colors">
                      {c.name}
                    </Link>
                    <StatusBadge status={c.status} />
                    {c.error_count > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-400 border border-red-700/50">
                        {c.error_count} error{c.error_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{c.total_enrolled} enrolled</span>
                    <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" />{c.reply_rate || 0}% reply rate</span>
                    {c.active_contacts > 0 && <span className="text-green-400">{c.active_contacts} active</span>}
                    {c.completed_contacts > 0 && <span className="text-blue-400">{c.completed_contacts} completed</span>}
                    {c.drafts_today > 0 && <span className="text-indigo-400">{c.drafts_today} drafted today</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(c.status === 'active' || c.status === 'paused') && (
                    <button
                      onClick={() => toggleStatus(c.campaign_id, c.status)}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                      title={c.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                    >
                      {c.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}
                  <Link
                    href={`/campaigns/${c.campaign_id}`}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Megaphone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}
