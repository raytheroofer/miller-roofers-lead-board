# MRS operating system

Miller Roofing Solutions LLC / Mrs Roofers, Jacksonville FL.

This is the canonical operating system for the company. Later builds follow these lanes. They do not invent another hub.

There is one code project: this repo, [miller-roofers-lead-board](https://github.com/raytheroofer/miller-roofers-lead-board), live at [https://mrs-leaderboard.vercel.app](https://mrs-leaderboard.vercel.app). Phase 1 of the app is specified in [STRUCTURE-v2.md](STRUCTURE-v2.md). Everything else that was tried lives in Google Drive as an earlier attempt. The failure mode is not missing software. It is too many systems of record.

## What was already built

- **Gen 1 (2025–mid 2026).** Spreadsheet command centers, Supplement Desk, Manus task trackers, Twilio A2P, AppSheet folders. Useful process, no system of record.
- **Gen 2–3 (July 2026).** Airtable “MRS Command Center” (13 tables, 18-stage jobs, 18 lead sources) plus a private `MRS_Command_Center` repo, Zapier Roofr events that were enabled but not wired, and an AI work ledger. The July 29 audit already said the company runs hub-and-spoke, not an ERP, and Airtable must not fight Roofr. [Architecture audit](https://docs.google.com/document/d/1LlH0gzlkim5YiFB2oVNPlryrZXN-lpqmdnNDptnDMJg/edit).
- **Gen 4 (Sep 12–19).** Owner Control Center sheet, then an AppSheet pilot (recovery copy saved 2026-09-22). Drive OS plans v1 / v2 / v2.1 were rejected because they invented a second job number (`MRS-YYYY-NNN`).
- **Gen 5 (locked 2026-09-18/19, this repo).** MRS Leaderboard, Phase 1 track-only. Postgres on Vercel. `FEATURE_TWILIO_LIVE` and `FEATURE_ROOFR_WRITE` stay false.

Open git work that is not this document: draft PR #3 replaces the shared password with per-user invites. PR #1 is an older auth fix. The `codex/paid-lead-routing-2026-09-24` branch has no extra commits. This document does not merge those branches.

## Locked rules

These win over every draft. Sources: [How We Run Now (Ray lock 2026-09-19)](https://docs.google.com/document/d/17WX8rJOpFSIVLAoJPG9N4lED3EUdNO4J9z_k3gX-NmU/edit) and the [paid Remodel Favor lead funnel SOP](https://docs.google.com/document/d/1UBOUrfkJEEhvB1CatEniTr4kxBLS35cvm_FaGYvePd0/edit).

- Roofr is the job book. The only job ID is the Roofr number.
- Drive is the file cabinet. Production folders are named with the bare Roofr number, and only after the job is sold. Opportunities do not get a job folder.
- QuickBooks is money. CompanyCam is photos after the appointment or contract. XBuild is supplement line items, not the job list.
- Cap-out inside the job folder is commission gross profit. Ray approves a fixed amount before anyone is paid. The Codex commissions preview folder stays read-only.
- Paid Remodel Favor leads rotate Raymond, then Austin Maddox, then Cody Boyd. Everything else is assigned by hand. Chris Bell stays out of the rotation.
- Appointments are booked on the Roofr calendar. Do not create a second Google Calendar event as the primary booking.
- Zeus is parked. A&G is a Florida-permit cross-check, not a job census.
- No Twilio send, no Roofr write, no nurture bot, and no commission autopay until Ray explicitly unlocks that one item.

## Tool lanes

```text
LSA / Remodel Favor / website / Facebook / referral
        |
        v
  MRS Leaderboard          (lead board only)
        |
        | manual until Ray says yes
        v
      Roofr                (job book, estimates, proposals, calendar, job number)
        |
        | sold only
        +--> Drive folder named {Roofr number}
        |         |
        |         +--> cap-out sheet --> Ray approves a fixed amount --> QuickBooks
        +--> CompanyCam (photos)
        +--> XBuild (supplement lines)
```

Each tool has one job:

| Tool | Job | Not its job |
| --- | --- | --- |
| MRS Leaderboard (this app) | The only lead board. Stages: `capture` → `qualify` → `assign` → `contact` → `appointment_set` → `inspection` → `proposal` → `negotiate` → `won` / `lost_nurture`. Hand-logged calls and texts. Stored webhook payloads. Round-robin only for the paid pool in `src/lib/rr.ts`. | Job book. Commission system. Dialer. SMS sender. |
| Roofr | Estimates, proposals, job stage, calendar, and the job number. | File cabinet. Books. |
| Google Drive | Contracts, permits, cap-outs, PDFs. Path: `05 - Projects & Jobs / Active Jobs / {Roofr number}`. | CRM. Second job-number system. |
| CompanyCam | Job photos after the appointment or contract. | Storm finder. Lead source. |
| XBuild | Supplement line items, linked from the Roofr job. | Job census. |
| QuickBooks + cap-out SOP | Payment only after the owner signs a fixed amount. Checkboxes never send money. | Lead tracking. |
| Google LSA, Remodel Favor (`app.digitalfavor.io`), website, Facebook, referrals | Lead sources that land on the Leaderboard. LSA is answered in 5 minutes. The Sep 24 LSA checklist was not fully verified, so do not treat that email as approval. | CRMs. |
| GoHighLevel | Webhook inbox only (`POST /api/webhooks/ghl` stores the payload). It was absent from the July stack. | A second CRM. |
| Login | The invite-and-password design on draft PR #3 is the intended replacement. Main still uses a shared `AUTH_PASSWORD`. | — |

Related money docs, still owner-review unless Ray stamps them: [cap-out commission plan v2](https://docs.google.com/document/d/15eXlJa2u_BJL_to9_-aDdSfZfUYUp3tgr4IufP8W2_Q/edit) and [Cap-Out to Payment SOP v1](https://docs.google.com/document/d/1GDjmKA8hBo4IR9s16T7c3rFMWvw8uknKgk3xKjtrsSs/edit).

## Frozen — do not extend

Link to a record if it still matters. Stop adding rows, folders, or automations.

- Airtable MRS Command Center
- AppSheet, and the Owner Control Center used as a daily CRM
- Parallel sheets: Lead Log, Master Job Tracker, AI Lead Recovery, Supplement Desk tracker, Internal Lead Tracker
- Rejected Drive trees and any new `MRS-YYYY-NNN` numbering
- A Supabase or Airtable ERP beside this app’s Postgres
- Live Twilio, live Roofr writes, nurture bots, and commission autopay until Ray explicitly unlocks that one item
- The Codex commissions preview folder (read-only forever)
- Zeus

Drive cleanup still follows the 2026-09-19 lock: no mass deletes, no mass renames of historical folders, and no second job ID. The temporary Drive map is not a live SOP: [MRS Drive Map — TEMP 2026-09-19](https://drive.google.com/file/d/1H54El3Kw6b_IsmpWzZ5QODEFpzwDZgtk/view).
