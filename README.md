# MRS Leaderboard (Phase 1 — track only)

Company lanes (what this app is, and what it is not) live in [docs/OPERATING-SYSTEM.md](docs/OPERATING-SYSTEM.md). Follow that doc before adding a hub, a job-number system, or a live integration.

Lead funnel web tracker for **Miller Roofing Solutions LLC / Mrs Roofers**, Jacksonville FL insurance-restoration roofing.

Phase 1 **tracks** leads. It does **not** dial, send SMS, create Roofr opportunities, or write the Roofr calendar.

| Locked 2026-09-18 | Value |
| --- | --- |
| Mode | Track only |
| Twilio / live call / live SMS | OFF (`FEATURE_TWILIO_LIVE=false`) |
| Roofr writeback | OFF (`FEATURE_ROOFR_WRITE=false`) |
| Calendar source of truth | Roofr calendar (display only) |
| Round-robin | Raymond → Austin Maddox → Cody Boyd |
| Out of routing | Chris Bell |
| Digests | Firstmate (this app is the login for Ray, PMs, and Firstmate) |

## What Ray can do in this preview

- Board or table of every funnel stage
- Open a lead, read the activity timeline
- Log a call or SMS by hand (no send)
- Set an appointment by hand and paste a Roofr calendar id
- Hit **Round-robin assign** — next PM is always Ray → Austin → Cody
- Import a storm / permit CSV
- Review webhook payloads that were stored and not acted on

## Run locally

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:43177](http://localhost:43177).

### Local logins

| Who | Email | Password env | Default in `.env.example` |
| --- | --- | --- | --- |
| Raymond | `ray@mrsroofers.com` | `AUTH_PASSWORD` | `track-only` |
| Austin Maddox | `austin@mrsroofers.com` | `AUTH_PASSWORD` | `track-only` |
| Cody Boyd | `cody@mrsroofers.com` | `AUTH_PASSWORD` | `track-only` |
| Firstmate | `FIRSTMATE_EMAIL` | `FIRSTMATE_PASSWORD` (falls back to `AUTH_PASSWORD`) | `firstmate-local` |

Chris Bell is seeded with `in_rr_pool=false` and is **not** on the allowlist.

## Environment variables

Copy `.env.example`. Nothing in that file is a production secret.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon, Vercel Postgres, Supabase). Format: `postgresql://user:password@host/db?sslmode=require` |
| `AUTH_SECRET` | Yes at runtime | Auth.js session signing. Generate a long random string for any shared deploy. |
| `AUTH_PASSWORD` | Yes for password login | Shared password for allowlisted PM emails |
| `ALLOWED_EMAILS` | No | Defaults to `ray@mrsroofers.com,austin@mrsroofers.com,cody@mrsroofers.com` |
| `FIRSTMATE_EMAIL` | No | Defaults to `firstmate@mrsroofers.com` |
| `FIRSTMATE_PASSWORD` | No | Firstmate password; uses `AUTH_PASSWORD` if omitted |
| `GOOGLE_CLIENT_ID` | No | Enables Google OAuth if both Google vars are set |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `AUTH_URL` / `NEXTAUTH_URL` | No | Public origin if the preview host is not detected |
| `WEBHOOK_SECRET` | No | If set, stubs require header `x-mrs-webhook-secret` |
| `FEATURE_TWILIO_LIVE` | No | Must stay `false` in Phase 1 |
| `FEATURE_ROOFR_WRITE` | No | Must stay `false` in Phase 1 |

Google OAuth is optional. If the Google client id/secret are missing, use the env-gated password login.

## Tests

```bash
npm test
```

Covers round-robin order (Chris Bell never assigned) and stage transitions.

## Webhook stubs (store only)

`POST /api/webhooks/{source}` writes the payload to the admin inbox and **does nothing else**.

Sources: `website` · `twilio` · `lsa` · `ghl` · `remodel_favor`

```bash
curl -X POST http://localhost:43177/api/webhooks/website \
  -H 'content-type: application/json' \
  -d '{"name":"Test","phone":"904-555-0000"}'
```

Live Twilio send (`POST /api/twilio/sms`) and Roofr opportunity create (`POST /api/roofr/opportunities`) return **403** while the flags are off.

## Deploy on Vercel

1. Import the repo in Vercel (Next.js is auto-detected; `vercel.json` runs `prisma generate && prisma migrate deploy && next build`).
2. Add the env vars from `.env.example`.
   - Set a pooled/direct PostgreSQL `DATABASE_URL` (e.g. Neon, Vercel Postgres, Supabase).
   - Set a real `AUTH_SECRET` (generate a 32+ character random string).
   - Set `AUTH_PASSWORD` (e.g. `track-only` or your chosen password for PM logins).
   - Keep both feature flags `false` (`FEATURE_TWILIO_LIVE=false`, `FEATURE_ROOFR_WRITE=false`).
3. Seed staff & initial lead data:
   - Run `DATABASE_URL="..." npm run db:seed` locally against the hosted database once.
4. Do not put live Twilio or Roofr write credentials in the project. They are not required to build.

```bash
npm run build   # runs prisma generate && prisma migrate deploy && next build
```

## Phase 2 gates (not this build)

Do not turn these on until Ray says yes:

- Live Twilio voice + SMS
- LSA 5-minute SLA timers
- Roofr opportunity create
- Roofr / Google calendar write
- Nurture drips / Outbound Desk / Appointment bot

## Data model

Prisma / PostgreSQL: `Lead`, `Activity`, `Appointment`, `OpportunityLink`, `AssignmentEvent`, `User`, plus `RoundRobinCursor` and `WebhookEvent`.

Stages (exact): `capture` · `qualify` · `assign` · `contact` · `appointment_set` · `inspection` · `proposal` · `negotiate` · `won` · `lost_nurture`

See `docs/STRUCTURE-v2.md` for the 2026-09-18 spec this build implements.
