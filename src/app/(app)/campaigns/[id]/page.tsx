'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Rocket, Users, Eye, AlertTriangle, CheckCircle,
  Edit3, ChevronRight, BarChart2, Loader2, Mail,
} from 'lucide-react'
import CSVUpload from '@/components/campaigns/CSVUpload'

interface Campaign {
  id: string; name: string; status: string; system_prompt: string; from_name: string; launched_at: string | null
}
interface Step { id: string; step_number: number; day_offset: number; subject_template: string; body_template: string }
interface Contact {
  id: string; first_name: string; last_name: string; company_name: string; email: string; status: string
  enrolled_at: string | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-green-900/50 text-green-400 border-green-700/50',
    unenrolled:'bg-gray-800 text-gray-400 border-gray-700',
    completed: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
    error:     'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] || map.active}`}>
      {status}
    </span>
  )
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [launchSuccess, setLaunchSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'steps'>('overview')
  const [previewing, setPreviewing] = useState(false)
  const [previewResult, setPreviewResult] = useState<{ subject: string; body: string } | null>(null)
  const [previewContactId, setPreviewContactId] = useState('')
  const [previewStepId, setPreviewStepId] = useState('')
  const [generatingDrafts, setGeneratingDrafts] = useState(false)
  const [draftResult, setDraftResult] = useState<{ processed: number; drafted: number; skipped: number; errors: number } | null>(null)
  const [draftError, setDraftError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/campaigns/${id}`).then(r => r.json()),
      fetch(`/api/campaigns/${id}/steps`).then(r => r.json()),
      fetch(`/api/campaigns/${id}/contacts`).then(r => r.json()),
    ]).then(([c, s, co]) => {
      setCampaign(c)
      setSteps(Array.isArray(s) ? s : [])
      setContacts(Array.isArray(co) ? co : [])
    }).finally(() => setLoading(false))
  }, [id])

  async function launch() {
    setLaunchError('')
    setLaunching(true)
    const res = await fetch(`/api/campaigns/${id}/launch`, { method: 'POST' })
    const data = await res.json()
    setLaunching(false)
    if (!res.ok) { setLaunchError(data.error); return }
    setLaunchSuccess(true)
    setCampaign(prev => prev ? { ...prev, status: 'active' } : prev)
  }

  const [previewError, setPreviewError] = useState('')

  async function previewEmail() {
    if (!previewContactId || !previewStepId) return
    setPreviewing(true)
    setPreviewError('')
    setPreviewResult(null)
    try {
      const res = await fetch(`/api/campaigns/${id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: previewContactId, step_id: previewStepId }),
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (res.ok) {
        setPreviewResult(data)
      } else {
        setPreviewError(data.error || 'Preview failed')
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  async function generateDraftsNow() {
    setGeneratingDrafts(true)
    setDraftError('')
    setDraftResult(null)
    try {
      const res = await fetch(`/api/campaigns/${id}/generate-drafts`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setDraftError(data.error || 'Failed to generate drafts'); return }
      setDraftResult(data)
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Failed to generate drafts')
    } finally {
      setGeneratingDrafts(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-gray-800 animate-pulse rounded" />
        <div className="h-48 bg-gray-800 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!campaign) return <div className="p-8 text-gray-400">Campaign not found.</div>

  const canLaunch = campaign.status === 'draft' && contacts.length > 0 && steps.length > 0
  const unenrolledContacts = contacts.filter(c => !c.enrolled_at)

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link href="/campaigns" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Campaigns
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status} />
          </div>
          {campaign.from_name && <p className="text-gray-400 text-sm mt-1">From: {campaign.from_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/analytics/${id}`} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <BarChart2 className="w-4 h-4" />
            Analytics
          </Link>
          <Link href={`/campaigns/${id}/edit`} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Edit3 className="w-4 h-4" />
            Edit
          </Link>
        </div>
      </div>

      {/* Launch banner */}
      {campaign.status === 'draft' && (
        <div className="bg-indigo-900/20 border border-indigo-700/40 rounded-xl p-5 mb-8">
          {launchSuccess ? (
            <div className="flex items-center gap-3 text-green-300">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Campaign launched!</p>
                <p className="text-sm text-green-400/80">Drafts will be generated daily starting tomorrow.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-white font-medium text-sm">Ready to launch?</p>
                <p className="text-indigo-300/80 text-xs mt-0.5">
                  {contacts.length} contacts · {steps.length} steps
                  {unenrolledContacts.length < contacts.length && ` · ${contacts.length - unenrolledContacts.length} already enrolled`}
                </p>
                {launchError && <p className="text-red-400 text-xs mt-1">{launchError}</p>}
              </div>
              <button
                onClick={launch}
                disabled={!canLaunch || launching}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {launching ? 'Launching…' : 'Launch Campaign'}
              </button>
            </div>
          )}
          {!canLaunch && !launchSuccess && (
            <p className="text-yellow-400 text-xs mt-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              {contacts.length === 0 ? 'Upload contacts before launching.' : 'Add sequence steps before launching.'}
            </p>
          )}
        </div>
      )}

      {/* Generate drafts now — shown for active campaigns */}
      {campaign.status === 'active' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-medium text-sm">Generate drafts now</p>
              <p className="text-gray-400 text-xs mt-0.5">
                Drafts all pending emails due today or earlier — use this after adding new contacts.
              </p>
              {draftError && <p className="text-red-400 text-xs mt-1">{draftError}</p>}
              {draftResult && (
                <p className="text-green-400 text-xs mt-1">
                  Done — {draftResult.drafted} drafted, {draftResult.skipped} skipped, {draftResult.errors} errors
                  {draftResult.processed === 0 ? ' (no pending emails due today)' : ''}
                </p>
              )}
            </div>
            <button
              onClick={generateDraftsNow}
              disabled={generatingDrafts}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              {generatingDrafts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {generatingDrafts ? 'Generating…' : 'Draft Now'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900 rounded-xl mb-6 w-fit">
        {(['overview', 'contacts', 'steps'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Contacts', value: contacts.length, icon: Users },
              { label: 'Steps', value: steps.length, icon: ChevronRight },
              { label: 'Status', value: campaign.status, icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{label}</span>
                  <Icon className="w-4 h-4 text-gray-600" />
                </div>
                <p className="text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>

          {campaign.system_prompt && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Campaign Context</h3>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{campaign.system_prompt}</p>
            </div>
          )}

          {/* Email Preview */}
          {contacts.length > 0 && steps.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-medium text-white mb-4">Email Preview</h3>
              <div className="flex items-center gap-3 mb-4">
                <select
                  value={previewContactId}
                  onChange={e => { setPreviewContactId(e.target.value); setPreviewResult(null) }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select contact…</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name || ''} {c.last_name || ''} {c.company_name ? `(${c.company_name})` : ''} — {c.email}
                    </option>
                  ))}
                </select>
                <select
                  value={previewStepId}
                  onChange={e => { setPreviewStepId(e.target.value); setPreviewResult(null) }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select step…</option>
                  {steps.map(s => <option key={s.id} value={s.id}>Step {s.step_number} (Day {s.day_offset})</option>)}
                </select>
                <button
                  onClick={previewEmail}
                  disabled={!previewContactId || !previewStepId || previewing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                >
                  {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {previewing ? 'Generating…' : 'Preview'}
                </button>
              </div>

              {previewError && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl px-4 py-3 text-sm">
                  {previewError}
                </div>
              )}

              {previewResult && (
                <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                  <div>
                    <span className="text-xs text-gray-400 font-medium">Subject</span>
                    <p className="text-white text-sm mt-1 font-medium">{previewResult.subject}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 font-medium">Body</span>
                    <pre className="text-gray-300 text-sm mt-1 whitespace-pre-wrap font-sans leading-relaxed">{previewResult.body}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contacts tab */}
      {activeTab === 'contacts' && (
        <div className="space-y-6">
          <CSVUpload campaignId={id} onImported={(n) => {
            fetch(`/api/campaigns/${id}/contacts`).then(r => r.json()).then(data => {
              setContacts(Array.isArray(data) ? data : [])
            })
          }} />

          {contacts.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">{contacts.length} Contacts</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Email</th>
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Company</th>
                      <th className="px-4 py-2.5 text-left text-xs text-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 50).map(c => (
                      <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 text-white">{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-300 font-mono text-xs">{c.email}</td>
                        <td className="px-4 py-2.5 text-gray-400">{c.company_name || '—'}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.length > 50 && (
                  <p className="text-center text-xs text-gray-500 py-3">Showing 50 of {contacts.length} contacts</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Steps tab */}
      {activeTab === 'steps' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">{steps.length} sequence step{steps.length !== 1 ? 's' : ''}</p>
            <Link href={`/campaigns/${id}/edit`} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              <Edit3 className="w-3.5 h-3.5" />
              Edit Steps
            </Link>
          </div>
          {steps.map(s => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 text-xs font-bold flex items-center justify-center">{s.step_number}</span>
                <span className="text-sm font-medium text-white">Step {s.step_number}</span>
                <span className="text-xs text-gray-500">Day {s.day_offset}</span>
              </div>
              <p className="text-xs text-gray-400 mb-1">Subject</p>
              <p className="text-sm text-white font-mono mb-3 bg-gray-800 rounded-lg px-3 py-2">{s.subject_template}</p>
              <p className="text-xs text-gray-400 mb-1">Body preview</p>
              <pre className="text-xs text-gray-300 font-mono bg-gray-800 rounded-lg px-3 py-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {s.body_template.slice(0, 300)}{s.body_template.length > 300 ? '…' : ''}
              </pre>
            </div>
          ))}
          {steps.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
              <p className="text-gray-400 text-sm">No steps yet.</p>
              <Link href={`/campaigns/${id}/edit`} className="text-indigo-400 hover:text-indigo-300 text-sm mt-1 inline-block">Add steps →</Link>
            </div>
          )}
        </div>
      )}
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || map.draft}`}>
      {status}
    </span>
  )
}
