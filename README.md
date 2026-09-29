# MRS Leaderboard — owner recovery release

A manual lead tracker for Miller Roofing Solutions. Roofr remains the job book and calendar. Drive stores job documents, CompanyCam stores field evidence, and QuickBooks records posted accounting.

## Owner workflow

1. Open **Today** to see open leads needing an action, overdue actions, and upcoming work.
2. Verify each incoming lead in its original channel, capture it, and set an owner, next action, and due time in Eastern Time.
3. Create or find the opportunity in Roofr the same day. Paste its numeric job number into the lead. The old MRS identifier is retained as a read-only legacy reference.
4. Book appointments in Roofr first; then record the confirmed reference and Eastern time here.
5. Log completed calls and SMS manually. This app sends no messages.
6. Complete an action with its result, then set the next one. Won work continues in Roofr.

Known demo records and names beginning `SYSTEM CHECK —` are excluded from the working board and Today. They remain in a separate demo view; no records are deleted.

Round-robin applies only to **unassigned Remodel Favor** leads, in Raymond → Austin → Cody order. Repeated assignment does not advance the cursor again. Other sources require a manual assignment and explanation.

## Current boundaries

- Owner-only access defaults on, including for previously issued sessions. Set `OWNER_ONLY=false` only after reviewing team authorization.
- `OWNER_PASSWORD` overrides the old shared `AUTH_PASSWORD` for the owner. Before loading real customer data, the owner must set a private credential or verify the existing credential is private. Rotating `AUTH_SECRET` invalidates old sessions. Never use template passwords in production.
- Bulk CSV import and generic lead-writing API endpoints are paused. They need duplicate-safe import and idempotency work before reopening. Owner forms remain available.
- The webhook inbox defaults disabled. Enabling it requires both `FEATURE_WEBHOOK_INBOX=true` and `WEBHOOK_SECRET`. Enabled storage requires a matching secret, valid JSON, and a body under 256 KB. It does not create leads or perform outreach. Historical payloads remain accessible.
- `FEATURE_TWILIO_LIVE=false` and `FEATURE_ROOFR_WRITE=false` must remain off. No automated digest is implemented.
- Health checks now test database access. They do not establish business-data freshness.

## Build and verification

Use Node and the committed npm lockfile:

```bash
npm ci
npx prisma generate
npx next typegen
npx tsc --noEmit
npm test
npm run lint
npm run build
```

`npm run build` and `vercel.json` generate Prisma Client and build Next.js. **Neither runs migrations or seeds.** The recovery release does not change the database schema. Install dependencies against the lockfile; do not upgrade major framework or database versions during recovery.

For local development, configure `.env` from `.env.example` with a disposable PostgreSQL database, run `npm run db:migrate` on that database, then `npm run dev`. The port is 43177. Do not copy production credentials into a public repo.

`db:seed` is destructive and now refuses non-local database hosts; it also requires `ALLOW_DESTRUCTIVE_DEMO_SEED=yes`. Never seed or reset a hosted database.

## Deploying the repair

1. Confirm the current production commit and save its deployment URL for rollback.
2. Verify production/preview database scope. Do not treat a preview as isolated when it uses production data.
3. Keep existing production credentials private; set owner-specific authentication before importing customer data.
4. Deploy this code without migration or seeding. Run only synthetic verification records in an environment sharing production data.
5. Confirm the existing owner can read a record, save an action, refresh, complete it, and see the historical result. Test the empty working board and separate demo view.
6. Confirm anonymous access is denied, source-specific routing holds, and disabled intake returns a visible failure.
7. If any essential step fails, roll back to the saved deployment. Preserve all records; there is no schema rollback in this release.

Tests cover routing policy/repeated assignment, owner allowlisting, demo classification, Eastern and daylight-saving times, next-action stale completion, and webhook rejection. Mocked service tests do not replace an actual deployed save/reload test or a PostgreSQL concurrency test.

The recovery release supersedes conflicting implementation descriptions in older Phase 1 docs. Draft team-invite and operating-system PRs require reconciliation before merging; do not merge them blindly over these access and routing changes.
