-- Store per-user booking/calendar links for use in email templates
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS calendar_url text;
