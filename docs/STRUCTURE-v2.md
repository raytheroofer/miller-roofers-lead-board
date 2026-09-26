# MRS Lead Funnel + Cursor Web Tracker — Structure v2

Company operating system: [OPERATING-SYSTEM.md](OPERATING-SYSTEM.md). This file is the Phase 1 punch list for the lead board only. It does not replace Roofr, Drive, QuickBooks, or the cap-out.

Copied from the 2026-09-18 locked spec. Phase 1 of this repo implements section 4 (track only).

| Field | Value |
|-------|--------|
| **Owner** | Firstmate (orchestration) |
| **Build partner / specs** | Lead Gen |
| **Date** | 2026-09-18 |
| **Status** | Phase 1 implemented as track-only. No Twilio/Roofr mutations until Ray says yes. |

## Goal
Generate leads → chase them → set appointments → track everything in one web app. Bots call/text/follow up in Phase 2+.

**Spine:** MRS Lead Log sheet + Roofr opportunity + RR **Raymond → Austin Maddox → Cody Boyd** only + book in **Roofr calendar** after intake. Digests → Firstmate.

## Funnel stages

`capture` → `qualify` → `assign` → `contact` → `appointment_set` → `inspection` → `proposal` → `negotiate` → `won` / `lost_nurture`

## Phase 1 punch list (done in this repo)

1. Next.js App Router + TypeScript + env skeleton
2. Auth: Ray / Austin / Cody allowlist + Firstmate service login (password; optional Google)
3. Lead CRUD + Kanban/table bound to stage enum
4. Activity log (`actor` bot|human)
5. Manual forms: log call / log SMS / set appointment
6. RR assign API + AssignmentEvent audit (Ray→Austin→Cody only)
7. CSV import
8. Seed Jacksonville sample (Lead Log shaped)
9. Webhook stubs store-only: website, twilio, lsa, ghl, remodel_favor
10. Read-only Roofr link fields
11. Calendar display only — SoR = Roofr calendar
12. Twilio stubs behind feature flag OFF
13. Vercel notes + README
