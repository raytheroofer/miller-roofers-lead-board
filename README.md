# Miller Roofing Solutions — lead and follow-up workspace

A manual lead tracker for Miller Roofing Solutions. Roofr remains the job book and calendar. Drive stores job documents, CompanyCam stores field evidence, and QuickBooks records posted accounting.

## Owner workflow

1. Open **Today** to see open leads needing an action, overdue actions, and upcoming work.
2. Verify each incoming lead in its original channel, capture it, and set an owner, next action, and due time in Eastern Time.
3. Create or find the opportunity in Roofr the same day. Copy its job ID exactly, including leading zeros and any hyphens. Both older numeric IDs and newer date-prefixed IDs are supported. Save the job ID and verified CompanyCam project URL, then use **Open saved Roofr job** or **Open saved CompanyCam project** to open the source in a new tab. These links use the last saved values; unsaved edits do not change the destination. The old MRS identifier is retained as a read-only legacy reference.
4. Book appointments in Roofr first; then record the confirmed reference and Eastern time here.
5. Log completed calls and SMS manually. This app sends no messages.
6. Complete an action with its result, then set the next one. Won work continues in Roofr.

Known demo records and names beginning `SYSTEM CHECK —` are excluded from the working board and Today. They remain in a separate demo view; no records are deleted.

Round-robin applies only to **unassigned Remodel Favor** leads. The default order is Raymond → Cody. The owner can add assignees and pause/resume paid-lead membership in **Lead routing** (`/routing`). Pausing preserves the member's position and historical assignments; other sources require manual assignment and an explanation. If everyone is paused, incoming paid leads are saved unassigned with an immediate review action. Repeated delivery does not assign again, including after the pool resumes.

New assignees start outside the paid-lead pool and do not receive login access or invitations. They are available for manual assignment, next actions and confirmed appointments. Only the owner can change pool membership, and a private `OWNER_PASSWORD` is required. Old unused database pool flags are ignored until the owner explicitly saves a pool change; deploying this release does not initialize settings or change the current rotation. The first save initializes the existing defaults and applies the requested change in one transaction. No schema migration is required.

## Current boundaries

**Duplicate review** (`/duplicates`) compares records across sources using normalized phone numbers (extensions preserved), exact normalized email, or matching address plus ZIP. It also finds repeat records within a source. Names alone, approximate addresses and records outside this board are not matched. Demo and working records are compared separately; closed inquiries are included. The comparison stops at 5,000 candidate pairs and explicitly warns when incomplete.

Signed-in staff can mark a pair related or separate, record a reason/follow-up plan, or reopen it. Reviews are append-only activity history, retry-safe and protected against stale record/review versions. Contact/name/source changes make the old decision pending again; follow-up-only changes retain it. Today and lead details flag unresolved or related pairs before follow-up. A review preserves both records and their assignments, stages and follow-ups; staff coordinate the next step. No schema migration, automatic merge, duplicate suppression or customer message is performed.

- Restricted source-specific intake and an owner-only **Lead sources** status page are implemented, including a separate **ChatGPT Ads Manager** source for attributed website inquiries. All feeds default off until credentials and upstream delivery are verified. See [LEAD-INTEGRATIONS.md](LEAD-INTEGRATIONS.md) for setup, field mappings, safe retries and remaining activation work. This does not restore the raw webhook inbox.

- Austin is inactive: new assignments and sign-in are blocked, including stale allowlists and sessions. Historical assignments remain labeled inactive for explicit owner review. Routing starts a separate Raymond/Cody cursor at Raymond; the previous cursor is preserved.
- Owner-only access defaults on. To enable only Cody Boyd (`cody@mrsroofers.com`), set a private `CODY_PASSWORD` of at least 16 characters, different from owner/shared passwords. Keep `OWNER_ONLY=true`. Cody receives the PM role, uses no shared-password fallback, and cannot view the webhook inbox. Changing/removing his credential invalidates his earlier sessions; old shared-password sessions are not accepted.
- `OWNER_PASSWORD` overrides the old shared `AUTH_PASSWORD` for the owner. Owner sessions are bound to the active credential and whether it is private or legacy/shared. Configuring, changing or removing the private password invalidates prior owner sessions, as does changing the shared password while legacy mode is active. This session-binding upgrade requires a fresh owner sign-in even if no password changed. Cody's separate sessions remain valid unless his credential or the session secret also changes. Rotating `AUTH_SECRET` invalidates all earlier sessions. Never use template passwords in production.
- Bulk CSV import and generic lead-writing API endpoints are paused. They need duplicate-safe import and idempotency work before reopening. Owner forms remain available.
- Generic webhook intake and raw payload reads are retired for every role. `/admin/webhooks` and GET `/api/webhooks` return not found; source POST endpoints return 410 without reading or storing the body. Old feature flags and secrets cannot enable them. Historical database events are retained for investigation but have no application read path. Future source integrations must validate and retain only approved lead fields.
- `FEATURE_TWILIO_LIVE=false` and `FEATURE_ROOFR_WRITE=false` must remain off. No automated digest is implemented.
- Read-only Roofr links use `ROOFR_TEAM_ID`, defaulting to MRS's verified team `137502`. Only supported job IDs and HTTPS CompanyCam project URLs are made clickable; older unrecognized references remain visible in the form for review. Opening a link does not create or synchronize records.
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

## Brand assets

The original company logo is served locally from `public/brand/mrs-logo.png`, unchanged. The supplied MRS brand reference specifies teal `#006778`, gold `#D7A22A`, bronze `#9F792C` and charcoal `#1E1D1D`. Light surfaces and semantic status colors support readable forms and stage labels.
