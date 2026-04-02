# Darkroom Outreach App

A full-stack AI-powered email outreach sequencing platform for sales teams.

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: NextAuth.js with invite-only credentials provider
- **Gmail**: Google OAuth 2.0 via Gmail API (tokens AES-256-GCM encrypted)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Scheduling**: Vercel Cron Jobs
- **Styling**: Tailwind CSS v4 (dark-mode-first)
- **Charts**: Recharts

---

## Setup

### 1. Environment Variables

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Random secret for JWT signing |
| `NEXTAUTH_URL` | Your deployment URL |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `CRON_SECRET` | Secret header for protecting `/api/cron/*` |
| `ADMIN_INVITE_TOKEN` | Token for first admin account setup |
| `TOKEN_ENCRYPTION_KEY` | 32+ char key for Gmail token encryption |

### 2. Google OAuth Setup

1. Create a Google Cloud project and enable the **Gmail API**
2. Create OAuth 2.0 credentials (Web application type)
3. Add authorized redirect URI: `{NEXTAUTH_URL}/api/gmail/callback`
4. Required scopes: `gmail.compose`, `gmail.readonly`, `gmail.modify`

### 3. Supabase Setup

Run migrations in the Supabase SQL editor:

```sql
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_analytics_views.sql
```

### 4. Bootstrap First Admin

```sql
-- In Supabase SQL editor:
INSERT INTO public.users (email, name, role, invite_token, invited_at, password_hash)
VALUES ('admin@yourcompany.com', 'Admin', 'admin', 'YOUR_ADMIN_INVITE_TOKEN', now(), '');
```

Then visit: `{NEXTAUTH_URL}/accept-invite?token=YOUR_ADMIN_INVITE_TOKEN`

### 5. Deploy to Vercel

```bash
vercel deploy
```

`vercel.json` configures two cron jobs:
- **7:00 AM UTC** — Generate Gmail drafts for emails due today
- **8:00 AM UTC** — Detect replies, auto-unenroll replied contacts

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to cron routes.

---

## Features

### Authentication
- Invite-only — no public signups
- Admin generates invite links from `/admin`
- Users accept invite, set password, auto sign in

### Gmail Integration
- Each user connects their own Gmail via OAuth
- Tokens encrypted with AES-256-GCM before storing
- Auto-refresh on expiry; warns in UI if refresh fails

### Campaign Builder
- Multi-step sequences with day offsets (Day 0, Day 3, Day 7…)
- Template syntax highlighting in editor:
  - `{{first_name}}`, `{{company_name}}` — merge fields (blue)
  - `{{ai: write a personalized intro}}` — Claude AI sections (purple)
- Contact preview: render any email for any contact before launching

### CSV Import
- Upload any CSV, map columns to expected fields
- Preview before confirming; deduplicates by email

### Automated Draft Generation (Cron)
- Renders templates with Claude per contact
- Creates Gmail drafts directly in the user's inbox
- Errors surface in dashboard with re-trigger option

### Reply Detection (Cron)
- Searches Gmail for replies from enrolled contacts
- Auto-unenrolls and cancels pending emails on reply detection

### Analytics (First-class)
- Global: totals, reply rate, weekly trend chart
- Per-campaign: funnel, step performance table, reply attribution by step
- Contact table: filterable by status/date/search, CSV export
- Re-trigger failed drafts directly from the analytics UI

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes
│   │   ├── dashboard/
│   │   ├── campaigns/
│   │   ├── analytics/
│   │   ├── admin/
│   │   └── settings/
│   ├── (auth)/             # Login + invite
│   └── api/
│       ├── auth/
│       ├── campaigns/
│       ├── contacts/
│       ├── gmail/
│       ├── analytics/
│       ├── admin/
│       ├── dashboard/
│       └── cron/           # Protected cron endpoints
├── components/
│   ├── campaigns/          # TemplateEditor, CSVUpload
│   └── layout/             # Sidebar
└── lib/
    ├── auth/               # NextAuth options, password hashing
    ├── claude/             # AI personalization engine
    ├── gmail/              # OAuth client, drafts, AES encryption
    └── supabase/           # Clients + TypeScript types
supabase/
├── migrations/             # Schema + analytics views
└── seed.sql
```
