'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Send, Clock, CheckCircle, AlertTriangle,
  Star, FileText, ExternalLink,
} from 'lucide-react'

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
  is_high_value: boolean
  high_value_reason: string | null
  research_summary: string | null
  hubspot_contact_id: string | null
  enrolled_at: string
  reply_detected_at: string | null
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
  const [approving, setApproving] = useState(false)
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/inbound/enrollments/${id}`)
    if (!res.ok) { router.push('/inbound'); return }
    const data = await res.json()
    setEnrollment(data.enrollment)
    setEmails(data.emails)
    setLoading(false)
  }

  async function approve() {
    setApproving(true)
    try {
      const res = await fetch(`/api/inbound/enrollments/${id}/approve`, { method: 'POST' })
      if (res.ok) { await load() }
    } finally {
      setApproving(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading || !enrollment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/inbound" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-white">{enrollment.contact_name}</h1>
            {enrollment.is_high_value && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-700/50">
                <Star className="w-2.5 h-2.5" />
                High Value
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{enrollment.contact_email}</p>
        </div>
        {enrollment.status === 'draft_review' && (
          <button
            onClick={approve}
            disabled={approving}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {approving ? 'Approving...' : 'Approve & Send'}
          </button>
        )}
      </div>

      {/* High Value Note */}
      {enrollment.is_high_value && enrollment.status === 'draft_review' && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4">
          <div className="flex items-start gap-2.5">
            <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-300">High-value account — pending review</p>
              {enrollment.high_value_reason && (
                <p className="text-xs text-yellow-500 mt-1">{enrollment.high_value_reason}</p>
              )}
              <p className="text-xs text-yellow-600 mt-1">
                Email sequence has been drafted but not sent. Click &quot;Approve &amp; Send&quot; to send the sequence.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Details */}
        <div className="lg:col-span-1 space-y-4">
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
                  <div key={label}>
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
                      {enrollment.page_url.slice(0, 40)}...
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {enrollment.research_summary && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-white mb-2">Research</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{enrollment.research_summary}</p>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-white mb-2">Status</h2>
            <div className="space-y-1.5 text-xs text-gray-400">
              <p>Enrolled: {new Date(enrollment.enrolled_at).toLocaleString()}</p>
              {enrollment.reply_detected_at && (
                <p className="text-blue-400">Replied: {new Date(enrollment.reply_detected_at).toLocaleString()}</p>
              )}
              {enrollment.hubspot_contact_id && (
                <p>HubSpot ID: {enrollment.hubspot_contact_id}</p>
              )}
            </div>
          </div>
        </div>

        {/* Email Sequence */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-white">Email Sequence</h2>
          {emails.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Mail className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No emails scheduled</p>
            </div>
          ) : (
            emails.map((email) => (
              <div key={email.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors text-left"
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
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    email.status === 'sent' ? 'bg-green-900/50 text-green-400' :
                    email.status === 'draft' ? 'bg-yellow-900/50 text-yellow-400' :
                    email.status === 'error' ? 'bg-red-900/50 text-red-400' :
                    email.status === 'cancelled' ? 'bg-gray-800 text-gray-500' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {email.status}
                  </span>
                </button>

                {expandedEmail === email.id && email.generated_body && (
                  <div className="border-t border-gray-800 px-4 py-3">
                    <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                      {email.generated_body}
                    </pre>
                    {email.error_message && (
                      <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
                        Error: {email.error_message}
                      </p>
                    )}
                    {email.hubspot_engagement_id && (
                      <p className="mt-2 text-xs text-gray-600">HubSpot engagement: {email.hubspot_engagement_id}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
