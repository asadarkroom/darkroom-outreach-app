'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Send, Clock, CheckCircle, AlertTriangle,
  FileText, ExternalLink, RefreshCw, Phone, MessageSquare,
  Sparkles, Ban, HelpCircle, Check, X, Loader2,
} from 'lucide-react'
import type { CadenceItem } from '@/lib/inbound/qualify'

interface Email {
  id: string
  send_date: string
  status: string
  generated_subject: string | null
  generated_body: string | null
  gmail_message_id: string | null
  gmail_draft_id: string | null
  hubspot_engagement_id: string | null
  sent_at: string | null
  error_message: string | null
  inbound_sequence_steps: {
    step_number: number
    day_offset: number
    step_type: string
    subject_template: string
  } | null
}

interface Enrollment {
  id: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  company_name: string | null
  services_interested: string | null
  media_budget: string | null
  inquiry_type: string | null
  referrer: string | null
  page_url: string | null
  status: string
  hubspot_contact_id: string | null
  enrolled_at: string
  reply_detected_at: string | null
  lead_tier: string | null
  research_summary: string | null
  disqualify_reason: string | null
  first_response_subject: string | null
  first_response_body: string | null
  first_response_sent_at: string | null
  first_response_gmail_message_id: string | null
  cadence_json: CadenceItem[] | null
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier || tier === 'unassessed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
        <Loader2 className="w-3 h-3 animate-spin" />
        Assessing…
      </span>
    )
  }
  if (tier === 'good_fit') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/60 text-green-300 border border-green-700/60">
        <CheckCircle className="w-3 h-3" />
        Good Fit
      </span>
    )
  }
  if (tier === 'questionable') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-900/60 text-yellow-300 border border-yellow-700/60">
        <HelpCircle className="w-3 h-3" />
        Needs Clarification
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/60 text-red-300 border border-red-700/60">
      <Ban className="w-3 h-3" />
      Disqualified
    </span>
  )
}

function CadenceIcon({ type }: { type: string }) {
  if (type === 'call') return <Phone className="w-3.5 h-3.5" />
  if (type === 'text') return <MessageSquare className="w-3.5 h-3.5" />
  return <Mail className="w-3.5 h-3.5" />
}

function EmailStatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <Send className="w-3.5 h-3.5 text-green-400" />
  if (status === 'draft') return <FileText className="w-3.5 h-3.5 text-yellow-400" />
  if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
  if (status === 'cancelled') return <CheckCircle className="w-3.5 h-3.5 text-gray-500" />
  return <Clock className="w-3.5 h-3.5 text-gray-400" />
}

export default function InboundEnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)

  // First response editor state
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Cadence state
  const [cadence, setCadence] = useState<CadenceItem[]>([])
  const [updatingItem, setUpdatingItem] = useState<string | null>(null)
  const [expandedCadenceItem, setExpandedCadenceItem] = useState<string | null>(null)

  // Sequence email expand state
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  // Re-qualify
  const [qualifying, setQualifying] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  async function load() {
    const res = await fetch(`/api/inbound/enrollments/${id}`)
    if (!res.ok) { router.push('/inbound'); return }
    const data = await res.json()
    setEnrollment(data.enrollment)
    setEmails(data.emails)
    const c = data.enrollment.cadence_json || []
    setCadence(c)
    if (!editSubject && data.enrollment.first_response_subject) {
      setEditSubject(data.enrollment.first_response_subject)
    }
    if (!editBody && data.enrollment.first_response_body) {
      setEditBody(data.enrollment.first_response_body)
    }
    setLoading(false)
  }

  async function sendResponse() {
    if (!editSubject.trim() || !editBody.trim()) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/inbound/enrollments/${id}/send-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || 'Failed to send')
      } else {
        await load()
      }
    } finally {
      setSending(false)
    }
  }

  async function updateCadenceItem(itemId: string, status: 'done' | 'skipped' | 'pending') {
    setUpdatingItem(itemId)
    try {
      const res = await fetch(`/api/inbound/enrollments/${id}/cadence`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, status }),
      })
      const data = await res.json()
      if (res.ok) setCadence(data.cadence)
    } finally {
      setUpdatingItem(null)
    }
  }

  async function reQualify() {
    setQualifying(true)
    try {
      await fetch(`/api/inbound/enrollments/${id}/qualify`, { method: 'POST' })
      await load()
    } finally {
      setQualifying(false)
    }
  }

  async function retry(emailId: string) {
    setRetrying(emailId)
    try {
      await fetch(`/api/inbound/enrollments/${id}/retry-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })
      await load()
    } finally {
      setRetrying(null)
    }
  }

  useEffect(() => { load() }, [id])

  // Poll while unassessed, but give up after 5 attempts (~20s)
  useEffect(() => {
    if (!enrollment || enrollment.lead_tier !== 'unassessed' || pollCount >= 5) return
    const timer = setTimeout(() => {
      setPollCount(c => c + 1)
      load()
    }, 4000)
    return () => clearTimeout(timer)
  }, [enrollment?.lead_tier, pollCount])

  if (loading || !enrollment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const alreadySent = !!enrollment.first_response_sent_at
  const hasFirstResponse = !!(enrollment.first_response_subject || enrollment.first_response_body)
  const isDisqualified = enrollment.lead_tier === 'not_fit' || enrollment.status === 'disqualified'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/inbound" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{enrollment.contact_name}</h1>
            <TierBadge tier={enrollment.lead_tier} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {enrollment.company_name ? `${enrollment.company_name} · ` : ''}
            {enrollment.contact_email}
          </p>
        </div>
        <button
          onClick={reQualify}
          disabled={qualifying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${qualifying ? 'animate-pulse' : ''}`} />
          {qualifying ? 'Re-qualifying…' : 'Re-qualify'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Contact + Status */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-white">Contact Info</h2>
            <dl className="space-y-2">
              {[
                ['Email', enrollment.contact_email],
                ['Phone', enrollment.contact_phone],
                ['Company', enrollment.company_name],
                ['Services', enrollment.services_interested],
                ['Budget', enrollment.media_budget],
                ['Inquiry', enrollment.inquiry_type],
                ['Referrer', enrollment.referrer],
              ].map(([label, val]) =>
                val ? (
                  <div key={label as string}>
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="text-sm text-gray-300 mt-0.5">{val}</dd>
                  </div>
                ) : null
              )}
              {enrollment.page_url && (
                <div>
                  <dt className="text-xs text-gray-500">Landing Page</dt>
                  <dd className="text-sm mt-0.5">
                    <a
                      href={enrollment.page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-xs"
                    >
                      {enrollment.page_url.slice(0, 38)}…
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-medium text-white">Status</h2>
            <div className="space-y-1.5 text-xs text-gray-400">
              <p>Enrolled: {new Date(enrollment.enrolled_at).toLocaleString()}</p>
              {enrollment.reply_detected_at && (
                <p className="text-blue-400">
                  Replied: {new Date(enrollment.reply_detected_at).toLocaleString()}
                </p>
              )}
              {alreadySent && enrollment.first_response_sent_at && (
                <p className="text-green-400">
                  First response sent: {new Date(enrollment.first_response_sent_at).toLocaleString()}
                </p>
              )}
              {enrollment.hubspot_contact_id && (
                <p>HubSpot ID: {enrollment.hubspot_contact_id}</p>
              )}
            </div>
          </div>

          {/* Research summary */}
          {enrollment.research_summary && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-white mb-2">Assessment</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{enrollment.research_summary}</p>
              {isDisqualified && enrollment.disqualify_reason && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-xs font-medium text-red-400 mb-1">Disqualified</p>
                  <p className="text-xs text-red-300/80">{enrollment.disqualify_reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: First response + cadence + sequence emails */}
        <div className="lg:col-span-2 space-y-5">

          {/* First Response Card */}
          {!isDisqualified && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-indigo-400" />
                  <h2 className="text-sm font-medium text-white">First Response</h2>
                </div>
                {alreadySent ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Sent {new Date(enrollment.first_response_sent_at!).toLocaleDateString()}
                  </span>
                ) : (
                  <span className="text-xs text-yellow-500">Not sent yet</span>
                )}
              </div>

              {alreadySent ? (
                <div className="px-4 py-4 space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Subject</p>
                    <p className="text-sm text-gray-300">{enrollment.first_response_subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Body</p>
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {enrollment.first_response_body}
                    </pre>
                  </div>
                </div>
              ) : hasFirstResponse ? (
                <div className="px-4 py-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Subject</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                      placeholder="Email subject…"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Body</label>
                    <textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={12}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y"
                      placeholder="Email body…"
                    />
                  </div>
                  {sendError && (
                    <p className="text-xs text-red-400">{sendError}</p>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={sendResponse}
                      disabled={sending || !editSubject.trim() || !editBody.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {sending
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                        : <><Send className="w-3.5 h-3.5" /> Send Now</>
                      }
                    </button>
                    <p className="text-xs text-gray-500">
                      Sends immediately from your connected Gmail
                    </p>
                  </div>
                </div>
              ) : pollCount >= 5 ? (
                <div className="px-4 py-8 text-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Qualification didn't complete.</p>
                  <p className="text-xs text-gray-600 mt-1 mb-4">The database migration may not have run yet, or there was an API error.</p>
                  <button
                    onClick={reQualify}
                    disabled={qualifying}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg mx-auto transition-colors disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${qualifying ? 'animate-pulse' : ''}`} />
                    {qualifying ? 'Running…' : 'Try Re-qualify'}
                  </button>
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Generating first response…</p>
                  <p className="text-xs text-gray-600 mt-1">Usually takes 10–20 seconds</p>
                </div>
              )}
            </div>
          )}

          {/* Disqualified banner */}
          {isDisqualified && (
            <div className="bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-medium text-red-300">Lead Disqualified</h2>
              </div>
              <p className="text-xs text-red-300/80">
                {enrollment.disqualify_reason || 'This lead did not meet Darkroom\'s qualification criteria.'}
              </p>
            </div>
          )}

          {/* Follow-up Cadence */}
          {cadence.length > 0 && !isDisqualified && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <h2 className="text-sm font-medium text-white">Follow-up Cadence</h2>
                <span className="text-xs text-gray-600 ml-auto">
                  {cadence.filter(i => i.status === 'done').length}/{cadence.length} done
                </span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {cadence.map(item => (
                  <div key={item.id} className={`${item.status === 'done' || item.status === 'skipped' ? 'opacity-50' : ''}`}>
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
                      onClick={() => setExpandedCadenceItem(expandedCadenceItem === item.id ? null : item.id)}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs
                        ${item.type === 'call' ? 'bg-blue-900/50 text-blue-400' :
                          item.type === 'text' ? 'bg-purple-900/50 text-purple-400' :
                          'bg-indigo-900/50 text-indigo-400'}`}>
                        <CadenceIcon type={item.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Day {item.day_offset}</span>
                          <span className="text-sm text-white font-medium">{item.title}</span>
                          {item.status === 'done' && (
                            <span className="text-xs text-green-500 ml-auto">✓ Done</span>
                          )}
                          {item.status === 'skipped' && (
                            <span className="text-xs text-gray-500 ml-auto">Skipped</span>
                          )}
                        </div>
                        {item.status === 'pending' && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">
                            {item.body.slice(0, 80)}…
                          </p>
                        )}
                      </div>
                      {item.status === 'pending' && (
                        <div
                          className="flex items-center gap-1.5 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateCadenceItem(item.id, 'done')}
                            disabled={updatingItem === item.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-900/40 hover:bg-green-900/70 text-green-400 rounded border border-green-800/50 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Done
                          </button>
                          <button
                            onClick={() => updateCadenceItem(item.id, 'skipped')}
                            disabled={updatingItem === item.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-500 rounded border border-gray-700 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Skip
                          </button>
                        </div>
                      )}
                      {(item.status === 'done' || item.status === 'skipped') && (
                        <button
                          onClick={e => { e.stopPropagation(); updateCadenceItem(item.id, 'pending') }}
                          className="text-xs text-gray-600 hover:text-gray-400 flex-shrink-0 transition-colors"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                    {expandedCadenceItem === item.id && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-800/50">
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                          {item.body}
                        </pre>
                        {item.done_at && (
                          <p className="text-xs text-gray-600 mt-2">
                            Completed {new Date(item.done_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sequence Follow-up Emails */}
          {emails.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-gray-500 px-1">Sequence Follow-ups</h2>
              {emails.map(email => (
                <div key={email.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedEmail(expandedEmail === email.id ? null : email.id)}
                  >
                    <EmailStatusIcon status={email.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        Step {email.inbound_sequence_steps?.step_number} — {email.generated_subject || email.inbound_sequence_steps?.subject_template || 'No subject'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {email.status === 'sent' && email.sent_at
                          ? `Sent ${new Date(email.sent_at).toLocaleString()}`
                          : `Scheduled ${new Date(email.send_date).toLocaleDateString()}`}
                      </p>
                      {email.status === 'error' && (
                        <p className="text-xs text-red-400 mt-0.5 truncate">
                          {email.error_message || 'Error — click for details'}
                        </p>
                      )}
                    </div>
                    <div
                      className="flex items-center gap-2 flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      {(email.status === 'draft' || email.status === 'sent') && email.gmail_draft_id && (
                        <a
                          href="https://mail.google.com/mail/u/0/#drafts"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-900/40 hover:bg-indigo-900/70 text-indigo-400 rounded border border-indigo-800/50 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Gmail
                        </a>
                      )}
                      {email.status === 'error' && (
                        <button
                          onClick={() => retry(email.id)}
                          disabled={retrying === email.id}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 rounded border border-red-800/50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${retrying === email.id ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        email.status === 'sent' ? 'bg-green-900/50 text-green-400' :
                        email.status === 'draft' ? 'bg-yellow-900/50 text-yellow-400' :
                        email.status === 'error' ? 'bg-red-900/50 text-red-400' :
                        email.status === 'cancelled' ? 'bg-gray-800 text-gray-500' :
                        'bg-gray-800 text-gray-400'
                      }`}>
                        {email.status}
                      </span>
                    </div>
                  </div>
                  {expandedEmail === email.id && (
                    <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                      {email.status === 'error' && (
                        <div className="bg-red-900/20 border border-red-800/40 rounded p-3 space-y-2">
                          <p className="text-xs font-semibold text-red-400">Error details</p>
                          <p className="text-xs text-red-300">
                            {email.error_message || 'No error message saved. Click Retry to attempt again.'}
                          </p>
                          <button
                            onClick={() => retry(email.id)}
                            disabled={retrying === email.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${retrying === email.id ? 'animate-spin' : ''}`} />
                            {retrying === email.id ? 'Retrying…' : 'Retry now'}
                          </button>
                        </div>
                      )}
                      {email.generated_body && (
                        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                          {email.generated_body}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isDisqualified && !hasFirstResponse && cadence.length === 0 && emails.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
              <Sparkles className="w-6 h-6 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Generating qualified response…</p>
              <p className="text-gray-600 text-xs mt-1">This usually takes 10–20 seconds</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
