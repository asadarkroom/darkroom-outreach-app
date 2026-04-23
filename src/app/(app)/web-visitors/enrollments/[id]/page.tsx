'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Send, Clock, CheckCircle, AlertTriangle, FileText, ExternalLink } from 'lucide-react'

interface Email {
  id: string
  send_date: string
  status: string
  generated_subject: string | null
  generated_body: string | null
  gmail_message_id: string | null
  gmail_draft_id: string | null
  sent_at: string | null
  error_message: string | null
  visitor_sequence_steps: {
    step_number: number
    day_offset: number
    step_type: string
    subject_template: string
  } | null
}

interface Enrollment {
  id: string
  contact_name: string
  contact_email: string | null
  company_name: string | null
  company_url: string | null
  company_size: string | null
  job_title: string | null
  visited_page: string | null
  visit_date: string | null
  industry: string | null
  status: string
  fit_assessment: string | null
  research_summary: string | null
  enrolled_at: string
  reply_detected_at: string | null
  sheet_row_number: number | null
}

function EmailStatusIcon({ status }: { status: string }) {
  if (status === 'sent') return <Send className="w-3.5 h-3.5 text-green-400" />
  if (status === 'draft') return <FileText className="w-3.5 h-3.5 text-yellow-400" />
  if (status === 'error') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
  if (status === 'cancelled') return <CheckCircle className="w-3.5 h-3.5 text-gray-500" />
  return <Clock className="w-3.5 h-3.5 text-gray-400" />
}

export default function VisitorEnrollmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/visitors/enrollments/${id}`)
      .then(r => { if (!r.ok) { router.push('/web-visitors'); return null } return r.json() })
      .then(d => {
        if (!d) return
        setEnrollment(d.enrollment)
        setEmails(d.emails)
        setLoading(false)
      })
  }, [id])

  if (loading || !enrollment) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const fitLabels: Record<string, string> = {
    good_fit: 'Good Fit', not_fit: 'Not a Fit',
    existing_deal: 'Existing Deal', uncertain: 'Uncertain',
  }
  const fitColors: Record<string, string> = {
    good_fit: 'text-green-400', not_fit: 'text-red-400',
    existing_deal: 'text-blue-400', uncertain: 'text-yellow-400',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/web-visitors" className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-white">{enrollment.contact_name}</h1>
          <p className="text-sm text-gray-500">{enrollment.contact_email || 'No email'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-white">Visitor Info</h2>
            <dl className="space-y-2">
              {[
                ['Company', enrollment.company_name],
                ['Title', enrollment.job_title],
                ['Industry', enrollment.industry],
                ['Company Size', enrollment.company_size],
                ['Visited Page', enrollment.visited_page],
                ['Visit Date', enrollment.visit_date ? new Date(enrollment.visit_date).toLocaleDateString() : null],
                ['Sheet Row', enrollment.sheet_row_number != null ? `#${enrollment.sheet_row_number}` : null],
              ].map(([label, val]) =>
                val ? (
                  <div key={label}>
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="text-sm text-gray-300 mt-0.5">{val}</dd>
                  </div>
                ) : null
              )}
              {enrollment.company_url && (
                <div>
                  <dt className="text-xs text-gray-500">Website</dt>
                  <dd className="text-sm mt-0.5">
                    <a href={enrollment.company_url} target="_blank" rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 text-xs break-all">
                      {enrollment.company_url}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-white mb-2">Assessment</h2>
            <div className="space-y-1.5">
              <p className="text-xs">
                <span className="text-gray-500">Fit: </span>
                <span className={fitColors[enrollment.fit_assessment || ''] || 'text-gray-400'}>
                  {fitLabels[enrollment.fit_assessment || ''] || '—'}
                </span>
              </p>
              <p className="text-xs">
                <span className="text-gray-500">Status: </span>
                <span className="text-gray-300">{enrollment.status}</span>
              </p>
              {enrollment.reply_detected_at && (
                <p className="text-xs text-blue-400">
                  Replied {new Date(enrollment.reply_detected_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {enrollment.research_summary && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-white mb-2">Research</h2>
              <p className="text-xs text-gray-400 leading-relaxed">{enrollment.research_summary}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-white">Email Sequence</h2>
          {emails.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <Mail className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No emails scheduled</p>
            </div>
          ) : (
            emails.map(email => (
              <div key={email.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === email.id ? null : email.id)}
                >
                  <EmailStatusIcon status={email.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      Step {email.visitor_sequence_steps?.step_number} — {email.generated_subject || email.visitor_sequence_steps?.subject_template || 'No subject'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {email.status === 'sent' && email.sent_at
                        ? `Sent ${new Date(email.sent_at).toLocaleString()}`
                        : `Scheduled ${new Date(email.send_date).toLocaleDateString()}`}
                    </p>
                    {email.status === 'error' && (
                      <p className="text-xs text-red-400 mt-0.5 truncate">
                        {email.error_message || 'Error — click to see details'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
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

                {expanded === email.id && (
                  <div className="border-t border-gray-800 px-4 py-3 space-y-3">
                    {email.status === 'error' && (
                      <div className="bg-red-900/20 border border-red-800/40 rounded p-3 space-y-1">
                        <p className="text-xs font-semibold text-red-400">Error details</p>
                        <p className="text-xs text-red-300">
                          {email.error_message || 'No error message saved. This likely happened before error logging was added.'}
                        </p>
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
            ))
          )}
        </div>
      </div>
    </div>
  )
}
