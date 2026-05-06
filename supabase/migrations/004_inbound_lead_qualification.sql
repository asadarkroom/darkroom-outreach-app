-- Lead qualification, in-app first-response, and follow-up cadence tracking

ALTER TABLE public.inbound_enrollments
  ADD COLUMN IF NOT EXISTS lead_tier text DEFAULT 'unassessed'
    CHECK (lead_tier IN ('good_fit', 'questionable', 'not_fit', 'unassessed')),
  ADD COLUMN IF NOT EXISTS first_response_subject text,
  ADD COLUMN IF NOT EXISTS first_response_body    text,
  ADD COLUMN IF NOT EXISTS first_response_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_gmail_message_id text,
  ADD COLUMN IF NOT EXISTS cadence_json  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disqualify_reason text;

-- Extend status enum to include 'disqualified'
ALTER TABLE public.inbound_enrollments
  DROP CONSTRAINT IF EXISTS inbound_enrollments_status_check;

ALTER TABLE public.inbound_enrollments
  ADD CONSTRAINT inbound_enrollments_status_check
    CHECK (status IN (
      'active', 'replied', 'completed', 'draft_review',
      'error', 'unenrolled', 'disqualified'
    ));

CREATE INDEX IF NOT EXISTS inbound_enrollments_tier_idx ON public.inbound_enrollments(lead_tier);
