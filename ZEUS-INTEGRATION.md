# Zeus research in the Leaderboard

## Owner-selected ZIP territory

The October 2 targeting view at `/target-markets` uses the owner's priorities: **32082, 32081, 32259, 32250, 32034, 32223, 32257**, in that order. The five additional suggestions remain inactive. The photo's home values, roof-age assumptions, budgets and conversion promises are not imported into scoring or advertising settings.

The owner page combines saved, non-quarantined Zeus observations with current official NWS county-alert context for St. Johns (`FLC109`), Duval (`FLC031`) and Nassau (`FLC089`). Weather fetches run in parallel, timeout after six seconds, revalidate every five minutes on visits, reject responses older than fifteen minutes, and show unavailable coverage distinctly from an empty alert result. County alerts are not ZIP/property exposure or damage proof. Test, expired, cancelled, future and unrelated hazards do not become current roofing signals. This is not a background monitor or a live Zeus account connector.

Cards show original event/snapshot dates, preliminary status and real working lead counts by ZIP/source, excluding demo records. They link to exact-ZIP Zeus evidence, exact-ZIP board review and a blank lead form with the ZIP prefilled. No lead is created from a storm row or alert. The private owner CSV endpoint `/api/marketing-targets` exports the seven priorities and geography only; it does not configure provider campaigns or change budgets. Existing leads outside these ZIPs remain accessible in All ZIPs.

Research orders known hail descending with explicit PostgreSQL `NULLS LAST`, then known wind and stable ID ties. This fixes PR 23 `discussion_r4167966698`; unknown hail must not fill the first fifty results ahead of known values.

Official API references: [NWS API](https://www.weather.gov/documentation/services-web-api), [NWS geolocation guide](https://www.weather.gov/media/documentation/docs/NWS_Geolocation.pdf). County-code queries include county- and zone-based alerts; point exposure still requires separate verification against the original geometry/swath. No Zeus credential is used or stored by this feature.

This feature is an owner-only, manual import of the September 12 Zeus ZIP/day snapshot. It stores storm observations in `StormObservation`, separate from `Lead`. It does not create contacts, assign reps, schedule outreach, or write to Roofr. The ZIP/day `homes_affected` number is a vendor estimate, not a count of unique properties or verified damage.

## Deploy and import

1. Review the migration and back up the production PostgreSQL database. Apply `prisma migrate deploy` to the intended database before deploying code; `next build` does not migrate. Verify the project, branch and database scope before any production deployment.
2. Deploy the code with existing owner-only authentication intact. Do not put the Zeus JSON in this public GitHub repository or a browser bundle.
3. Sign in as owner using the existing configured credential, open `/storm-research`, and upload the original `storm-snapshot.json` from the private archived MRS Lead Workspace. The endpoint accepts only the known Zeus rollup format, 4 MB maximum, and at most 6,000 rows. Imports are atomic. Repeating the same file keeps stable IDs and does not overwrite existing rows. A changed observation or capture time returns `409 correction_review_required`; review the vendor correction rather than treating it as an unchanged retry. Transient failures can be retried unchanged.
4. Confirm 4,685 observations, 77 flagged suspect ZIP rows, zero customer leads created. Compare a few rows with the original file. An error or mismatched count is a blocker, not proof of success.

Flagged ZIPs are stored for audit but excluded from the visible research list. Remaining ZIPs still need geography validation. Source swath links are evidence pointers, not property exposure proof. The nine neighborhood reports and subsequent Verisk corrections are deliberately outside this initial importer; do not mix withdrawn or disputed rows into a candidate queue.

To create a real lead, obtain a specific property address, verify the storm exposure and roof evidence against original sources, and establish an actual customer contact/inquiry or an authorized outreach workflow. Search for duplicates first, then use the existing New lead form. No automated promotion is implemented.

## Verification boundary

The prior parser check against the archived file found 4,685 observations and 77 flagged ZIPs. That historical count is a target for import verification, not proof that production contains these records. Automated checks cover owner/staff/anonymous access, oversized and malformed uploads, atomic rollback, unchanged retries, corrections and concurrent imports against an isolated PostgreSQL database and the built Next.js app. These do not establish live Zeus property access or production import. Keep the old mailbox-wide automation disabled. No Zeus credential is used or stored by this feature. Missing vendor status remains preliminary; evidence links are limited to known Zeus domains and its observed GeoJSON CDN.
