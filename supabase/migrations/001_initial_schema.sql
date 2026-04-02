-- ============================================================
-- Darkroom Outreach App — Initial Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
create table public.users (
  id          uuid primary key default uuid_generate_v4(),
  email       text not null unique,
  name        text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  password_hash text not null,
  invite_token  text unique,
  invited_at    timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

-- Users can read their own row; admins can read all
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_admin_select_all" on public.users
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

-- Service role bypasses RLS for auth operations
create policy "service_role_all" on public.users
  for all using (true)
  with check (true);

-- ============================================================
-- GMAIL TOKENS
-- ============================================================
create table public.gmail_tokens (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  access_token   text not null,
  refresh_token  text not null,
  token_expiry   timestamptz,
  connected_at   timestamptz not null default now(),
  unique (user_id)
);

alter table public.gmail_tokens enable row level security;

create policy "gmail_tokens_own" on public.gmail_tokens
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table public.campaigns (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.users(id) on delete cascade,
  name          text not null,
  system_prompt text not null default '',
  from_name     text not null default '',
  status        text not null default 'draft'
                  check (status in ('draft', 'active', 'paused', 'completed')),
  created_at    timestamptz not null default now(),
  launched_at   timestamptz
);

alter table public.campaigns enable row level security;

create policy "campaigns_own" on public.campaigns
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index campaigns_user_id_idx on public.campaigns(user_id);
create index campaigns_status_idx on public.campaigns(status);

-- ============================================================
-- SEQUENCE STEPS
-- ============================================================
create table public.sequence_steps (
  id               uuid primary key default uuid_generate_v4(),
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  step_number      int not null,
  day_offset       int not null default 0,
  subject_template text not null default '',
  body_template    text not null default '',
  unique (campaign_id, step_number)
);

alter table public.sequence_steps enable row level security;

create policy "sequence_steps_own" on public.sequence_steps
  for all using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.user_id = auth.uid()
    )
  );

create index sequence_steps_campaign_idx on public.sequence_steps(campaign_id);

-- ============================================================
-- CONTACTS
-- ============================================================
create table public.contacts (
  id                   uuid primary key default uuid_generate_v4(),
  campaign_id          uuid not null references public.campaigns(id) on delete cascade,
  user_id              uuid not null references public.users(id) on delete cascade,
  first_name           text,
  last_name            text,
  company_name         text,
  job_title            text,
  email                text not null,
  industry             text,
  website_or_linkedin  text,
  custom_notes         text,
  enrolled_at          timestamptz,
  unenrolled_at        timestamptz,
  unenroll_reason      text,
  reply_detected_at    timestamptz,
  status               text not null default 'active'
                         check (status in ('active', 'unenrolled', 'completed', 'error')),
  unique (campaign_id, email)
);

alter table public.contacts enable row level security;

create policy "contacts_own" on public.contacts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index contacts_campaign_idx on public.contacts(campaign_id);
create index contacts_user_id_idx on public.contacts(user_id);
create index contacts_status_idx on public.contacts(status);
create index contacts_email_idx on public.contacts(email);

-- ============================================================
-- SCHEDULED EMAILS
-- ============================================================
create table public.scheduled_emails (
  id                uuid primary key default uuid_generate_v4(),
  contact_id        uuid not null references public.contacts(id) on delete cascade,
  step_id           uuid not null references public.sequence_steps(id) on delete cascade,
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  send_date         date not null,
  status            text not null default 'pending'
                      check (status in ('pending', 'drafted', 'error', 'cancelled', 'completed')),
  gmail_draft_id    text,
  generated_subject text,
  generated_body    text,
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.scheduled_emails enable row level security;

create policy "scheduled_emails_own" on public.scheduled_emails
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index scheduled_emails_user_idx     on public.scheduled_emails(user_id);
create index scheduled_emails_campaign_idx on public.scheduled_emails(campaign_id);
create index scheduled_emails_contact_idx  on public.scheduled_emails(contact_id);
create index scheduled_emails_send_date_idx on public.scheduled_emails(send_date);
create index scheduled_emails_status_idx   on public.scheduled_emails(status);

-- auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scheduled_emails_updated_at
  before update on public.scheduled_emails
  for each row execute function public.update_updated_at();

-- ============================================================
-- ANALYTICS EVENTS
-- ============================================================
create table public.analytics_events (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.users(id) on delete cascade,
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete set null,
  event_type   text not null
                 check (event_type in ('enrolled','draft_created','reply_detected','unenrolled','error')),
  metadata     jsonb not null default '{}',
  occurred_at  timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

create policy "analytics_events_own" on public.analytics_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index analytics_events_user_idx     on public.analytics_events(user_id);
create index analytics_events_campaign_idx on public.analytics_events(campaign_id);
create index analytics_events_type_idx     on public.analytics_events(event_type);
create index analytics_events_occurred_idx on public.analytics_events(occurred_at);
