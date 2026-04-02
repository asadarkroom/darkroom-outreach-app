-- ============================================================
-- Seed: Create initial admin user
-- Run this ONCE after migrations to bootstrap the first admin.
-- The ADMIN_INVITE_TOKEN env var should match the invite_token below.
-- Actual account creation happens via the /accept-invite route.
-- ============================================================

-- Insert a placeholder admin row so the invite link works.
-- The password_hash will be set when the admin accepts the invite.
insert into public.users (email, name, role, invite_token, invited_at, password_hash)
values (
  'admin@example.com',
  'Admin',
  'admin',
  current_setting('app.admin_invite_token', true),  -- set via: set app.admin_invite_token = 'xxx'
  now(),
  ''  -- placeholder — will be replaced on first sign-up
)
on conflict (email) do nothing;
