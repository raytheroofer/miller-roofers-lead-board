<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- PostgreSQL 16 is installed in the image. systemd is not running. The environment start command launches the cluster with `sudo pg_ctlcluster 16 main start`, waits for `pg_isready`, applies `npx prisma migrate deploy`, and seeds only when `"User"` is empty. The seed script deletes existing leads, so do not re-seed a database that already has staff.
- The same start command then runs `npm run dev` on port 43177. If that port is already listening, do not start a second server.
- If `.env` is missing, copy `.env.example`. Those values are local defaults. The database is `mrs_leaderboard` and the role password matches `.env.example`. Logins are in `README.md`.
- `npm test` and `npm run lint` do not need the database. `npm run build` applies migrations and needs Postgres.
