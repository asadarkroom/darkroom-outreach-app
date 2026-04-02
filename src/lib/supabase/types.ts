export type UserRole = 'admin' | 'member'
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed'
export type ContactStatus = 'active' | 'unenrolled' | 'completed' | 'error'
export type EmailStatus = 'pending' | 'drafted' | 'error' | 'cancelled' | 'completed'
export type EventType = 'enrolled' | 'draft_created' | 'reply_detected' | 'unenrolled' | 'error'

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
