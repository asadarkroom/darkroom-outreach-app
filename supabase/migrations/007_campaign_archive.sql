-- Add is_archived flag to campaigns
-- Run in Supabase SQL editor (Dashboard → SQL Editor → New query)

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS campaigns_is_archived_idx ON public.campaigns(is_archived);
