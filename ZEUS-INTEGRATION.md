# Zeus research in the Leaderboard

This feature is an owner-only, manual import of the September 12 Zeus ZIP/day snapshot. It stores storm observations in `StormObservation`, separate from `Lead`. It does not create contacts, assign reps, schedule outreach, or write to Roofr. The ZIP/day `homes_affected` number is a vendor estimate, not a count of unique properties or verified damage.

## Deploy and import

1. Review the migration and back up the production PostgreSQL database. Apply `prisma migrate deploy` to the intended database before deploying code; `next build` does not migrate. Verify the project, branch and database scope before any production deployment.
2. Deploy the code with existing owner-only authentication intact. Do not put the Zeus JSON in this public GitHub repository or a browser bundle.
3. Sign in as owner, open `/storm-research`, and upload the original `storm-snapshot.json` from the private archived MRS Lead Workspace. The endpoint accepts only the known Zeus rollup format, 4 MB maximum, and at most 6,000 rows. Repeating the same file keeps stable IDs and does not overwrite existing rows. A partial import can be retried unchanged.
4. Confirm 4,685 observations, 77 flagged suspect ZIP rows, zero customer leads created. Compare a few rows with the original file. An error or mismatched count is a blocker, not proof of success.

Flagged ZIPs are stored for audit but excluded from the visible research list. Remaining ZIPs still need geography validation. Source swath links are evidence pointers, not property exposure proof. The nine neighborhood reports and subsequent Verisk corrections are deliberately outside this initial importer; do not mix withdrawn or disputed rows into a candidate queue.

To create a real lead, obtain a specific property address, verify the storm exposure and roof evidence against original sources, and establish an actual customer contact/inquiry or an authorized outreach workflow. Search for duplicates first, then use the existing New lead form. No automated promotion is implemented.

## Verification boundary

Parser check against the archived file: 4,685 observations, 77 flagged ZIPs. This check does not verify production migration, authentication, persistence, deployment, or live Zeus access. Keep the old mailbox-wide automation disabled. No Zeus credential is used or stored by this feature.
