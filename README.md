# MRS Leaderboard (Phase 1 — track only)

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
- Manage staff access and invite team members with individual passwords via **Team & Invites**

## Authentication & Staff Access

MRS Leaderboard uses per-user credential authentication with single-use, time-limited invitation links. Shared passwords have been completely removed.

### Access flow
1. **Invite**: Raymond (owner) or Firstmate creates an invitation for an allowlisted staff email from the **Team & Invites** dashboard (`/admin/team`).
2. **Invite Link**: A single-use token valid for 7 days is generated. Raymond can copy and send the link via text/email, or it is emailed automatically if Resend is configured.
3. **Set Password**: The user opens `/invite/[token]`, creates their unique password (minimum 12 characters, confirmed), and activates their account.
4. **Sign In**: User signs in with their email and personal password.

### Allowlisted Staff
- `ray@mrsroofers.com` (Raymond Miller, Owner)
- `austin@mrsroofers.com` (Austin Maddox, PM)
- `cody@mrsroofers.com` (Cody Boyd, PM)
- `firstmate@mrsroofers.com` (Firstmate, ops login)

Chris Bell is seeded with `inRrPool=false` and is excluded from round-robin routing and the default allowlist.

### Initial Owner Bootstrap

When first deploying the app, no user has an active password yet. To bootstrap Raymond's initial account:
1. Set `BOOTSTRAP_INVITE_SECRET="<random-secure-secret>"` in environment variables.
2. Visit `/bootstrap` (or run `curl -X POST https://<domain>/api/auth/bootstrap -H "x-bootstrap-secret: <secret>"`).
3. Enter the secret to generate a single-use invite link for `ray@mrsroofers.com`.
4. Open the invite link to set Raymond's password.
5. **Lockout safety**: As soon as any user sets a password, the bootstrap endpoint is automatically and permanently locked. Raymond can then invite Austin and Cody from the **Team & Invites** UI.

In local development (`NODE_ENV !== "production"`), running `npm run db:seed` automatically prints a ready-to-use invite link for `ray@mrsroofers.com` in the terminal output.

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

## Environment variables

Copy `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon, Vercel Postgres, Supabase). Format: `postgresql://user:password@host/db?sslmode=require` |
| `AUTH_SECRET` | Yes at runtime | Auth.js session signing. Generate a long random string for any shared deploy. |
| `BOOTSTRAP_INVITE_SECRET` | For initial deploy | One-time secret to generate Raymond's initial invite before any account has a password |
| `BOOTSTRAP_OWNER_EMAIL` | No | Owner email for bootstrap; defaults to `ray@mrsroofers.com` |
| `ALLOWED_EMAILS` | No | Defaults to `ray@mrsroofers.com,austin@mrsroofers.com,cody@mrsroofers.com` |
| `FIRSTMATE_EMAIL` | No | Defaults to `firstmate@mrsroofers.com` |
| `FIRSTMATE_PASSWORD` | No | Optional ops bot login password for Firstmate automation |
| `RESEND_API_KEY` | No | Optional Resend API key to automatically email invite links |
| `EMAIL_FROM` | No | Sender email address for automated invite emails |
| `GOOGLE_CLIENT_ID` | No | Enables Google OAuth if both Google vars are set |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth secret |
| `AUTH_URL` / `NEXTAUTH_URL` | No | Public origin if the preview host is not detected |
| `WEBHOOK_SECRET` | No | If set, stubs require header `x-mrs-webhook-secret` |
| `FEATURE_TWILIO_LIVE` | No | Must stay `false` in Phase 1 |
| `FEATURE_ROOFR_WRITE` | No | Must stay `false` in Phase 1 |

## Tests

```bash
npm test
```

Covers round-robin order, stage transitions, CSV import, invite token creation & validation, per-user password hashing & verification, token expiration, single-use token reuse prevention, and bootstrap lockout rules.

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
   - Set `BOOTSTRAP_INVITE_SECRET` for initial setup.
   - Keep both feature flags `false` (`FEATURE_TWILIO_LIVE=false`, `FEATURE_ROOFR_WRITE=false`).
3. Seed staff & initial lead data:
   - Run `DATABASE_URL="..." npm run db:seed` locally against the hosted database once.
4. Complete owner bootstrap:
   - Visit `/bootstrap` on the deployed URL, enter `BOOTSTRAP_INVITE_SECRET`, and set Raymond's password.
   - Log in as Raymond and invite Austin and Cody from `/admin/team`.

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
