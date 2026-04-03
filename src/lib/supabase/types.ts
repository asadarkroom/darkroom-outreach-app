export type UserRole = 'admin' | 'member'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'
export type ContactStatus = 'active' | 'unenrolled' | 'completed' | 'error'
export type EmailStatus = 'pending' | 'drafted' | 'error' | 'cancelled' | 'completed'
export type EventType = 'enrolled' | 'draft_created' | 'reply_detected' | 'unenrolled' | 'error'

export type InboundEnrollmentStatus = 'active' | 'replied' | 'completed' | 'draft_review' | 'error' | 'unenrolled'
export type InboundEmailStatus = 'pending' | 'sent' | 'draft' | 'error' | 'cancelled'
export type StepType = 'email' | 'linkedin'

export type VisitorEnrollmentStatus = 'active' | 'replied' | 'completed' | 'skipped' | 'error' | 'unenrolled' | 'no_email'
export type FitAssessment = 'good_fit' | 'not_fit' | 'existing_deal' | 'uncertain'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  invite_token: string | null
  invited_at: string | null
  created_at: string
}

export interface GmailToken {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  token_expiry: string | null
  connected_at: string
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  system_prompt: string
  from_name: string
  status: CampaignStatus
  created_at: string
  launched_at: string | null
}

export interface SequenceStep {
  id: string
  campaign_id: string
  step_number: number
  day_offset: number
  subject_template: string
  body_template: string
}

export interface Contact {
  id: string
  campaign_id: string
  user_id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  job_title: string | null
  email: string
  industry: string | null
  website_or_linkedin: string | null
  custom_notes: string | null
  enrolled_at: string | null
  unenrolled_at: string | null
  unenroll_reason: string | null
  reply_detected_at: string | null
  status: ContactStatus
}

export interface ScheduledEmail {
  id: string
  contact_id: string
  step_id: string
  campaign_id: string
  user_id: string
  send_date: string
  status: EmailStatus
  gmail_draft_id: string | null
  generated_subject: string | null
  generated_body: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface AnalyticsEvent {
  id: string
  user_id: string
  campaign_id: string
  contact_id: string
  event_type: EventType
  metadata: Record<string, unknown>
  occurred_at: string
}

// ── Inbound (HubSpot form leads) ──────────────────────────────

export interface InboundSequence {
  id: string
  name: string
  description: string
  system_prompt: string
  sender_user_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InboundSequenceStep {
  id: string
  sequence_id: string
  step_number: number
  step_type: StepType
  day_offset: number
  subject_template: string
  body_template: string
  created_at: string
}

export interface InboundEnrollment {
  id: string
  sequence_id: string | null
  contact_name: string
  contact_email: string
  contact_phone: string | null
  company_name: string | null
  services_interested: string | null
  media_budget: string | null
  inquiry_type: string | null
  referrer: string | null
  page_url: string | null
  status: InboundEnrollmentStatus
  is_high_value: boolean
  high_value_reason: string | null
  research_summary: string | null
  hubspot_contact_id: string | null
  enrolled_at: string
  completed_at: string | null
  reply_detected_at: string | null
  unenrolled_at: string | null
  unenroll_reason: string | null
  created_at: string
}

export interface InboundEmail {
  id: string
  enrollment_id: string
  step_id: string
  send_date: string
  status: InboundEmailStatus
  gmail_message_id: string | null
  gmail_draft_id: string | null
  hubspot_engagement_id: string | null
  generated_subject: string | null
  generated_body: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

// ── Visitor (Google Sheet web visitors) ───────────────────────

export interface VisitorSequence {
  id: string
  name: string
  description: string
  system_prompt: string
  sender_user_id: string | null
  auto_send: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface VisitorSequenceStep {
  id: string
  sequence_id: string
  step_number: number
  step_type: StepType
  day_offset: number
  subject_template: string
  body_template: string
  created_at: string
}

export interface VisitorEnrollment {
  id: string
  sequence_id: string | null
  contact_name: string
  contact_email: string | null
  company_name: string | null
  company_url: string | null
  company_size: string | null
  job_title: string | null
  visited_page: string | null
  visit_date: string | null
  industry: string | null
  sheet_row_number: number | null
  google_sheet_id: string | null
  status: VisitorEnrollmentStatus
  fit_assessment: FitAssessment | null
  research_summary: string | null
  hubspot_deal_found: boolean
  enrolled_at: string
  completed_at: string | null
  reply_detected_at: string | null
  unenrolled_at: string | null
  unenroll_reason: string | null
  created_at: string
}

export interface VisitorEmail {
  id: string
  enrollment_id: string
  step_id: string
  send_date: string
  status: InboundEmailStatus
  gmail_message_id: string | null
  gmail_draft_id: string | null
  generated_subject: string | null
  generated_body: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}
