-- ============================================================
-- Darkroom Outreach — Inbound & Web Visitor Outreach
-- Migration 003
-- ============================================================

-- ============================================================
-- INBOUND SEQUENCES (HubSpot form leads)
-- ============================================================
create table if not exists public.inbound_sequences (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  description    text not null default '',
  system_prompt  text not null default '',
  sender_user_id uuid references public.users(id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger inbound_sequences_updated_at
  before update on public.inbound_sequences
  for each row execute function public.update_updated_at();

-- ============================================================
-- INBOUND SEQUENCE STEPS
-- ============================================================
create table if not exists public.inbound_sequence_steps (
  id               uuid primary key default uuid_generate_v4(),
  sequence_id      uuid not null references public.inbound_sequences(id) on delete cascade,
  step_number      int not null,
  step_type        text not null default 'email' check (step_type in ('email', 'linkedin')),
  day_offset       int not null default 0,
  subject_template text not null default '',
  body_template    text not null default '',
  created_at       timestamptz not null default now(),
  unique (sequence_id, step_number)
);

create index if not exists inbound_sequence_steps_seq_idx on public.inbound_sequence_steps(sequence_id);

-- ============================================================
-- INBOUND ENROLLMENTS (one per HubSpot form submission)
-- ============================================================
create table if not exists public.inbound_enrollments (
  id                   uuid primary key default uuid_generate_v4(),
  sequence_id          uuid references public.inbound_sequences(id) on delete set null,
  contact_name         text not null,
  contact_email        text not null,
  contact_phone        text,
  company_name         text,
  services_interested  text,
  media_budget         text,
  inquiry_type         text,
  referrer             text,
  page_url             text,
  status               text not null default 'active'
                         check (status in ('active', 'replied', 'completed', 'draft_review', 'error', 'unenrolled')),
  is_high_value        boolean not null default false,
  high_value_reason    text,
  research_summary     text,
  hubspot_contact_id   text,
  enrolled_at          timestamptz not null default now(),
  completed_at         timestamptz,
  reply_detected_at    timestamptz,
  unenrolled_at        timestamptz,
  unenroll_reason      text,
  created_at           timestamptz not null default now()
);

create index if not exists inbound_enrollments_status_idx on public.inbound_enrollments(status);
create index if not exists inbound_enrollments_email_idx  on public.inbound_enrollments(contact_email);
create index if not exists inbound_enrollments_seq_idx    on public.inbound_enrollments(sequence_id);

-- ============================================================
-- INBOUND EMAILS (scheduled/sent for each enrollment step)
-- ============================================================
create table if not exists public.inbound_emails (
  id                    uuid primary key default uuid_generate_v4(),
  enrollment_id         uuid not null references public.inbound_enrollments(id) on delete cascade,
  step_id               uuid not null references public.inbound_sequence_steps(id) on delete cascade,
  send_date             date not null,
  status                text not null default 'pending'
                          check (status in ('pending', 'sent', 'draft', 'error', 'cancelled')),
  gmail_message_id      text,
  gmail_draft_id        text,
  hubspot_engagement_id text,
  generated_subject     text,
  generated_body        text,
  error_message         text,
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger inbound_emails_updated_at
  before update on public.inbound_emails
  for each row execute function public.update_updated_at();

create index if not exists inbound_emails_enrollment_idx on public.inbound_emails(enrollment_id);
create index if not exists inbound_emails_send_date_idx  on public.inbound_emails(send_date);
create index if not exists inbound_emails_status_idx     on public.inbound_emails(status);

-- ============================================================
-- VISITOR SEQUENCES (Google Sheet web visitors)
-- ============================================================
create table if not exists public.visitor_sequences (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  description    text not null default '',
  system_prompt  text not null default '',
  sender_user_id uuid references public.users(id) on delete set null,
  auto_send      boolean not null default true,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger visitor_sequences_updated_at
  before update on public.visitor_sequences
  for each row execute function public.update_updated_at();

-- ============================================================
-- VISITOR SEQUENCE STEPS
-- ============================================================
create table if not exists public.visitor_sequence_steps (
  id               uuid primary key default uuid_generate_v4(),
  sequence_id      uuid not null references public.visitor_sequences(id) on delete cascade,
  step_number      int not null,
  step_type        text not null default 'email' check (step_type in ('email', 'linkedin')),
  day_offset       int not null default 0,
  subject_template text not null default '',
  body_template    text not null default '',
  created_at       timestamptz not null default now(),
  unique (sequence_id, step_number)
);

create index if not exists visitor_sequence_steps_seq_idx on public.visitor_sequence_steps(sequence_id);

-- ============================================================
-- VISITOR ENROLLMENTS (one per unique web visitor processed)
-- ============================================================
create table if not exists public.visitor_enrollments (
  id                 uuid primary key default uuid_generate_v4(),
  sequence_id        uuid references public.visitor_sequences(id) on delete set null,
  contact_name       text not null,
  contact_email      text,
  company_name       text,
  company_url        text,
  company_size       text,
  job_title          text,
  visited_page       text,
  visit_date         timestamptz,
  industry           text,
  sheet_row_number   int,
  google_sheet_id    text,
  status             text not null default 'active'
                       check (status in ('active', 'replied', 'completed', 'skipped', 'error', 'unenrolled', 'no_email')),
  fit_assessment     text check (fit_assessment in ('good_fit', 'not_fit', 'existing_deal', 'uncertain')),
  research_summary   text,
  hubspot_deal_found boolean not null default false,
  enrolled_at        timestamptz not null default now(),
  completed_at       timestamptz,
  reply_detected_at  timestamptz,
  unenrolled_at      timestamptz,
  unenroll_reason    text,
  created_at         timestamptz not null default now()
);

create index if not exists visitor_enrollments_status_idx on public.visitor_enrollments(status);
create index if not exists visitor_enrollments_email_idx  on public.visitor_enrollments(contact_email);
create index if not exists visitor_enrollments_seq_idx    on public.visitor_enrollments(sequence_id);
create index if not exists visitor_enrollments_sheet_idx  on public.visitor_enrollments(google_sheet_id, sheet_row_number);

-- ============================================================
-- VISITOR EMAILS
-- ============================================================
create table if not exists public.visitor_emails (
  id                uuid primary key default uuid_generate_v4(),
  enrollment_id     uuid not null references public.visitor_enrollments(id) on delete cascade,
  step_id           uuid not null references public.visitor_sequence_steps(id) on delete cascade,
  send_date         date not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'sent', 'draft', 'error', 'cancelled')),
  gmail_message_id  text,
  gmail_draft_id    text,
  generated_subject text,
  generated_body    text,
  error_message     text,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger visitor_emails_updated_at
  before update on public.visitor_emails
  for each row execute function public.update_updated_at();

create index if not exists visitor_emails_enrollment_idx on public.visitor_emails(enrollment_id);
create index if not exists visitor_emails_send_date_idx  on public.visitor_emails(send_date);
create index if not exists visitor_emails_status_idx     on public.visitor_emails(status);

-- ============================================================
-- SEED: Default visitor sequence with pre-loaded template
-- ============================================================
do $$
declare
  seq_id uuid;
begin
  insert into public.visitor_sequences (name, description, system_prompt, auto_send, is_active)
  values (
    'Web Visitor Outreach',
    'Default outreach sequence for web visitors from the daily Google Sheet feed.',
    'You are writing on behalf of Asa at Darkroom, a performance marketing agency that helps ambitious consumer brands scale efficiently. Keep all writing concise, confident, and human. No jargon, no fluff.',
    true,
    true
  )
  returning id into seq_id;

  insert into public.visitor_sequence_steps (sequence_id, step_number, step_type, day_offset, subject_template, body_template)
  values
    (seq_id, 1, 'email', 0,
     'ideas to drive growth at {{company_name}}',
     E'Hi {{first_name}},\n\nI wanted to reach out because many teams at your stage start reassessing how well their growth engine is set up for what comes next.\n\nCommon patterns we see include performance flattening as creative loses impact, funnels that convert but not consistently, and pressure to scale before the system is truly ready.\n\nThat is where Darkroom tends to be most useful. We help ambitious brands strengthen the connection between creative, media, and the full funnel so growth remains profitable as spend increases.\n\nWould you be open to a brief 20-minute conversation to explore further?\n\nSending my best,\n\nAsa'),

    (seq_id, 2, 'email', 2,
     'ideas to drive growth at {{company_name}}',
     E'Hi {{first_name}}, resurfacing this in case it got lost in your inbox.\n\nThe brands we work with are rarely short on ideas or channels. The real constraint is having enough creative depth and funnel efficiency to support scale without eroding returns.\n\nOur work focuses on performance creative systems, funnel optimization, and lifecycle driven revenue so growth compounds instead of resetting every quarter.\n\nLet me know what works.\n\nAsa'),

    (seq_id, 3, 'linkedin', 7,
     '',
     E'Hey {{first_name}}, quick note to connect.\n\nI work with growth teams focused on scaling efficiently as complexity increases. If that is a priority this year, would be good to connect and exchange notes.'),

    (seq_id, 4, 'email', 15,
     'Pressure testing scale',
     E'Hi {{first_name}},\n\nAs brands move into the next phase of growth, one useful exercise is pressure testing whether the current system can actually support more scale.\n\nWhat we often find is that constraints show up outside of media buying. Creative velocity slows, funnels introduce friction, or retention is not strong enough to support higher acquisition spend.\n\nThat is the type of work Darkroom is focused on. Helping teams identify where scale will hold and where it will break before growth stalls.\n\nIf it would be useful, I am happy to offer a brief outside perspective on how your current setup is positioned for profitable scale.\n\nAsa'),

    (seq_id, 5, 'email', 18,
     'Pressure testing scale',
     E'Hi {{first_name}}, if this is not relevant for you right now, no problem at all. Just let me know and I will step back.\n\nIf improving growth efficiency or pressure testing your current setup becomes a priority later on, I am always happy to reconnect and share perspective.\n\nAsa');
end;
$$;
