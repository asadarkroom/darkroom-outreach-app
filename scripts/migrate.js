#!/usr/bin/env node
/**
 * Run Supabase migrations and seed the first admin user.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:[password]@db.darkroom-sequencer.supabase.co:5432/postgres" \
 *   node scripts/migrate.js
 *
 * Get DATABASE_URL from: Supabase Dashboard → Settings → Database → Connection string → URI
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DATABASE_URL = process.env.DATABASE_URL
const ADMIN_INVITE_TOKEN = process.env.ADMIN_INVITE_TOKEN || 'darkroom-admin-2026'

if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL is required.\n')
  console.error('  Get it from: Supabase Dashboard → Settings → Database → Connection string → URI\n')
  console.error('  Then run:')
  console.error('  DATABASE_URL="postgresql://postgres:[password]@db.darkroom-sequencer.supabase.co:5432/postgres" node scripts/migrate.js\n')
  process.exit(1)
}

const MIGRATIONS = [
  path.join(__dirname, '../supabase/migrations/001_initial_schema.sql'),
  path.join(__dirname, '../supabase/migrations/002_analytics_views.sql'),
  path.join(__dirname, '../supabase/migrations/003_inbound_visitor_outreach.sql'),
]

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✓ Connected to database')

  // Run migrations
  for (const file of MIGRATIONS) {
    const name = path.basename(file)
    const sql = fs.readFileSync(file, 'utf8')
    try {
      await client.query(sql)
      console.log(`✓ Migration: ${name}`)
    } catch (err) {
      // Ignore "already exists" errors so re-runs are safe
      if (err.code === '42P07' || err.code === '42710' || err.message.includes('already exists')) {
        console.log(`⚠  ${name} — already applied, skipping`)
      } else {
        console.error(`❌  ${name} failed:`, err.message)
        await client.end()
        process.exit(1)
      }
    }
  }

  // Seed admin user
  const existing = await client.query(
    `SELECT id FROM public.users WHERE email = 'admin@darkroom.com' LIMIT 1`
  )
  if (existing.rows.length === 0) {
    await client.query(
      `INSERT INTO public.users (email, name, role, invite_token, invited_at, password_hash)
       VALUES ($1, $2, $3, $4, now(), '')`,
      ['admin@darkroom.com', 'Admin', 'admin', ADMIN_INVITE_TOKEN]
    )
    console.log(`✓ Admin user created  →  email: admin@darkroom.com`)
    console.log(`  Invite token: ${ADMIN_INVITE_TOKEN}`)
    console.log(`  Accept URL:   http://localhost:3000/accept-invite?token=${ADMIN_INVITE_TOKEN}`)
  } else {
    console.log('⚠  Admin user already exists, skipping')
  }

  await client.end()
  console.log('\n✅  All done! Open http://localhost:3000/accept-invite?token=' + ADMIN_INVITE_TOKEN)
}

run().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
