'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Mail, Send, Clock, CheckCircle, AlertTriangle,
  FileText, ExternalLink, RefreshCw,
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
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)

  async function load() {
    const res = await fetch(`/api/inbound/enrollments/${id}`)
    if (!res.ok) { router.push('/inbound'); return }
    const data = await res.json()
    setEnrollment(data.enrollment)
    setEmails(data.emails)
    setLoading(false)
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
          <h1 className="text-xl font-semibold text-white">{enrollment.contact_name}</h1>
          <p className="text-sm text-gray-500">{enrollment.contact_email}</p>
        </div>
      </div>

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
                    {email.status === 'error' && email.error_message && (
                      <p className="text-xs text-red-400 mt-0.5 truncate">{email.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {email.status === 'error' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); retry(email.id) }}
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
                </button>

                {expandedEmail === email.id && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                    {email.error_message && (
                      <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded p-3">
                        <p className="font-medium mb-1">Error</p>
                        <p>{email.error_message}</p>
                      </div>
                    )}
                    {email.generated_body && (
                      <pre className="text-xs text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                        {email.generated_body}
                      </pre>
                    )}
                    {email.hubspot_engagement_id && (
                      <p className="text-xs text-gray-600">HubSpot engagement: {email.hubspot_engagement_id}</p>
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
