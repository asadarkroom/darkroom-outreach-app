'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Users, Send, TrendingUp, ChevronRight, Trophy } from 'lucide-react'

interface GlobalData {
  total_enrolled: number
  total_drafted: number
  overall_reply_rate: number
  active_campaigns: number
  weekly_trend: { week_start: string; reply_count: number }[]
  top_campaign: { name: string; reply_rate: number; campaign_id: string } | null
}

interface CampaignOverview {
  campaign_id: string
  name: string
  status: string
  total_enrolled: number
  active_contacts: number
  reply_rate: number
  error_count: number
  drafts_today: number
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: React.ElementType; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-gray-600" />
      </div>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400 border border-green-700/50',
    paused: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50',
    completed: 'bg-blue-900/50 text-blue-400 border border-blue-700/50',
    draft: 'bg-gray-800 text-gray-400 border border-gray-700',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}

export default function AnalyticsPage() {
  const [global, setGlobal] = useState<GlobalData | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignOverview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics/global').then(r => r.json()),
      fetch('/api/analytics/campaigns').then(r => r.json()),
    ]).then(([g, c]) => {
      setGlobal(g)
      setCampaigns(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 bg-gray-800 animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-gray-800 animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  const trendData = global?.weekly_trend?.map(w => ({
    week: new Date(w.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    replies: w.reply_count,
  })) || []

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm mt-1">Overview of all your outreach activity</p>
      </div>

      {/* Global stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Enrolled" value={global?.total_enrolled || 0} icon={Users} />
        <StatCard label="Emails Drafted" value={global?.total_drafted || 0} icon={Send} />
        <StatCard label="Overall Reply Rate" value={`${global?.overall_reply_rate || 0}%`} icon={TrendingUp} />
        <StatCard label="Active Campaigns" value={global?.active_campaigns || 0} icon={Megaphone} />
      </div>

      {/* Top campaign */}
      {global?.top_campaign && (
        <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-700/40 rounded-xl p-5 flex items-center gap-4">
          <Trophy className="w-8 h-8 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Top Performing Campaign</p>
            <Link href={`/analytics/${global.top_campaign.campaign_id}`} className="text-white font-medium hover:text-indigo-300 transition-colors">
              {global.top_campaign.name}
            </Link>
            <p className="text-indigo-300 text-sm">{global.top_campaign.reply_rate}% reply rate</p>
          </div>
        </div>
      )}

      {/* Reply trend chart */}
      {trendData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-white mb-6">Reply Rate Trend (Last 12 Weeks)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line type="monotone" dataKey="replies" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign list */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">All Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-400 text-sm">
            No campaign data yet.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Campaign</th>
                  <th className="px-5 py-3 text-left text-xs text-gray-400 font-medium">Status</th>
                  <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Enrolled</th>
                  <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Active</th>
                  <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Reply Rate</th>
                  <th className="px-5 py-3 text-right text-xs text-gray-400 font-medium">Errors</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.campaign_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3.5">
                      <Link href={`/analytics/${c.campaign_id}`} className="text-white hover:text-indigo-400 font-medium transition-colors">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5"><CampaignStatusBadge status={c.status} /></td>
                    <td className="px-5 py-3.5 text-right text-gray-300">{c.total_enrolled}</td>
                    <td className="px-5 py-3.5 text-right text-green-400">{c.active_contacts}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`font-medium ${(c.reply_rate || 0) > 10 ? 'text-green-400' : 'text-gray-300'}`}>
                        {c.reply_rate || 0}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={c.error_count > 0 ? 'text-red-400 font-medium' : 'text-gray-500'}>
                        {c.error_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/analytics/${c.campaign_id}`} className="text-gray-400 hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
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

function Megaphone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  )
}
