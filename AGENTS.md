<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- PostgreSQL 16 is installed in this environment. systemd is not running, so start the cluster with `sudo pg_ctlcluster 16 main start` and wait until `pg_isready` succeeds. The local database is `mrs_leaderboard`; the role password matches `.env.example`.
- If `.env` is missing, copy `.env.example`. Those values are local defaults. `npm run dev` serves http://localhost:43177. Logins are in `README.md`.
- Run `npx prisma migrate deploy` after Postgres is up. Run `npm run db:seed` only when `"User"` is empty — the seed script deletes existing leads.
- `npm test` and `npm run lint` do not need the database. `npm run build` applies migrations and needs Postgres.
