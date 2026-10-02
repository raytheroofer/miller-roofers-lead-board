# Restricted lead intake

This implementation provides the receiving side for five sources. Deploying it does **not** create a provider workflow or prove that a feed works. Each source defaults off. `/sources` is an owner-only status page with accepted delivery counts and last-received time. It never displays secrets, request headers or raw envelopes.

The retired `/api/webhooks` routes remain retired. Do not reconnect Circleback, Drive, entire email messages or meeting transcripts to them. This app does not require Google Drive access.

## Bring up one source at a time

1. Confirm owner access uses a private `OWNER_PASSWORD` of at least 16 characters, different from legacy/shared credentials. Keep `OWNER_ONLY=true`. Confirm Cody's separate sign-in before enabling Remodel Favor; a configured distinct `CODY_PASSWORD` is required by that feed.
2. In the existing Vercel project, set a different cryptographically random 32-byte lowercase hexadecimal key for each selected source. Keep keys in server environment variables and the sending service's secret store. Never expose them in browser code, URLs, logs, chat or source control. Do not reuse the login or Auth.js secret. Use production-only scope for production keys; use a disposable database and separate credentials for preview tests.
3. Configure the sender to POST the small JSON object below to the matching path, with `Content-Type: application/json` and `Authorization: Bearer <that source's key>`. The sender must select fields explicitly; do not send its full event payload. Preserve its stable record ID and original timestamp on retries.
4. List the selected source in `LEAD_INTAKE_SOURCES` (comma separated), redeploy, and send one lead whose name begins `SYSTEM CHECK —`. Check the demo board for the record and assignment. Resend unchanged; expect HTTP 200 with the same lead ID, one receipt and one assignment. Source counts include these tests; Today and the working board exclude them.
5. Compare the first genuine new lead against its original provider, including contact method, source, received time and owner. Verify its follow-up appears in Today. Do not bulk-import old sold jobs, storm lists or historical leads as part of activation.
6. Enable the sender's failure alerts and retry policy. Reconcile the provider's new-lead list against the board daily. A receipt count alone cannot prove completeness.

| Path after `/api/intake/` | Key variable | Result |
| --- | --- | --- |
| `remodel-favor` | `INTAKE_REMODEL_FAVOR_KEY` | Paid leads only; owner-managed pool (Raymond → Cody by default) and immediate review due |
| `website` | `INTAKE_WEBSITE_KEY` | Unassigned, review due immediately |
| `roofr-instant-estimator` | `INTAKE_ROOFR_KEY` | Distinct Roofr source, unassigned, review due immediately |
| `lsa` | `INTAKE_LSA_KEY` | Google LSA source, unassigned, review due immediately |
| `fb-lead` | `INTAKE_FACEBOOK_KEY` | Facebook Lead source, unassigned, review due immediately |

The receiver fixes the source and routing from the authenticated path. A sender cannot choose a rep, stage, arbitrary source, job ID or financial field. Storm/permit alerts are not accepted as customer leads without qualification and a contact method. Referral and other leads remain available through New lead with manual assignment.

The owner manages the pool at `/routing`. Paused members remain available for manual work; historical assignments are not moved. When everyone is paused, intake still saves the lead and its receipt, leaves it unassigned and schedules immediate review. Replaying that delivery after the pool resumes still returns the original record, without advancing the rotation. A new assignee starts paused and receives no sign-in or invitation. Old unused pool flags do not change the default rotation until the owner explicitly saves a setting. Completing, changing or removing private owner-password setup revokes older owner sessions, including when returning to legacy/shared mode. This session-binding upgrade requires a fresh owner sign-in.

## JSON version 1

```json
{
  "schemaVersion": 1,
  "recordId": "example-provider-lead-001",
  "name": "SYSTEM CHECK — example customer",
  "receivedAt": "2026-09-22T17:41:00-04:00",
  "phone": "+19045550100",
  "email": "example@example.invalid",
  "address": "100 Example Street, Jacksonville, FL",
  "zip": "32201",
  "request": "Roof replacement estimate requested"
}
```

- Required: `schemaVersion: 1`, `recordId`, `name`, `receivedAt`. At least one of `phone` or `email` is required, except Google LSA can instead supply an approved original lead URL.
- `recordId`: the stable provider lead ID, 1–128 letters/digits/dots/colons/dashes/underscores, starting with a letter or digit. Use one account per source key. Namespace IDs by account if an authorized provider combines multiple company accounts; never use the customer's phone or name as the ID.
- `name`: 1–160 characters; `phone`: up to 32; `phoneExtension`: up to 10 digits and requires a phone; `email`: up to 254; `address`: up to 300; `zip`: US ZIP or ZIP+4; `request`: one short line, up to 500.
- `receivedAt`: original timestamp including a timezone. Never set it to the retry time. Inputs normalize to UTC. A timestamp more than five minutes ahead is rejected. Explicitly review historical backfills instead of enabling one unintentionally.
- `sourceUrl`: optional, up to 1,000 characters. Only HTTPS Google LSA lead detail URLs with an integer `lid` and approved numeric/locale query fields, or Roofr Instant Estimator URLs without tracking query fields. No Drive/document links or generic external URLs. The original LSA URL ID may differ from its displayed lead ID; preserve each in its corresponding field.
- Phone numbers normalize to international format. Put extensions in `phoneExtension`, never discard them. LSA relay/callback numbers must be verified in the original lead before contact; they are not proof of a permanent customer number.
- Optional fields may be omitted or null. Unknown fields, nested objects, control characters, document links in text and requests over 8 KB are rejected. HTML is not interpreted.

## Sender field mappings

**Roofr Instant Estimator**: trigger `Lead Created`; map `id` → `recordId`, `lead_name` → `name`, `created_at` → `receivedAt`, `lead_phone` → `phone`, `lead_email` → `email`, `address` → `address`, `address_postal_code` → `zip`. Map only a short, reviewed roofing request to `request`; omit long notes instead of forwarding an entire account/export. An example returned by a trigger test is not a verified live event. Do not use this source for signed proposals or completed jobs.

**Remodel Favor / provider automation**: use the actual new paid-lead trigger and a filter that positively identifies paid Remodel Favor leads. Map the provider lead/contact ID and original creation timestamp, contact fields and short requested service. Exclude self-generated, referral and old leads. Do not publish a second rotation in the sender: the board's atomic round-robin is the assignment authority for this intake. Confirm any existing vendor rotation before activation to avoid conflicting owners.

**Website**: send from the website's trusted server or provider automation after the contact form is saved and assigned a stable submission ID. Never place the intake key in a public form or frontend. Browser CORS or obscurity is not authentication. Retain the source record for retries and reconciliation.

**Google LSA**: map a verified lead notification or provider lead record, not every Google email. Notifications can lack a phone/email; use the original approved LSA lead URL in that case. Do not guess a customer's permanent phone from an LSA routing number. Preserve any extension. Replying to an email, calling or sending SMS remains a human action.

## Delivery outcomes and recovery

| HTTP | Sender action |
| --- | --- |
| 201 | Saved. Store `leadId`; delivery complete. |
| 200 | Exact normalized repeat. Same record; delivery complete. |
| 400 / 413 / 415 / 422 | Fix the mapping/format/size; review before replay. No raw payload was saved. |
| 401 | Check the source-specific credential. Do not try another source's key. |
| 404 | Check the source path. Reads are deliberately unavailable. |
| 409 | Same provider ID arrived with changed details. Review the existing lead in the board. Do not generate a new ID to bypass the conflict. |
| 503 / network timeout | Delivery unconfirmed. Retry unchanged with the same ID; check whether the source is off or blocked in `/sources`. |

Recommended sender backoff: 1, 5, 15 and 60 minutes, then visible failure review. Do not silently discard failures or create a new ID for each attempt. The board does not yet persist a failure queue: undelivered events remain in the sending provider. Keep its delivery history and failure alerts enabled.

Same-source idempotency uses deterministic `Lead` and `Activity` primary keys. The receipt holds only source, provider record ID, original received time, a fingerprint and an approved source link. Raw input and authorization headers are not stored. Lead creation, receipt, assignment/cursor and immediate review action commit in one serializable transaction. Changed provider data returns 409, and replay does not overwrite subsequent staff edits. No migration is required. Keep receipts when changing or backing up lead records.

Different-source records with the same customer are not automatically merged. Search phone, email and address before contact. This intentionally avoids merging unrelated people using a shared/relay number; a reviewed cross-source matching workflow is still future work.

To pause: remove the source from `LEAD_INTAKE_SOURCES` and redeploy. To revoke/rotate: replace that source's key in the protected server environment and sender, then redeploy and test; old keys are rejected. Existing leads and receipts stay intact. Review old deployments and provider retries during a credential incident.

## Remaining activation work

Provider account access, active sender workflows, production credential setup and the first genuine end-to-end deliveries must be verified separately. There is no automatic customer messaging, Roofr job creation, Drive sync or staff notification in this release. Lead assignees and paid-lead pool membership are owner-managed; authentication access remains separate. The receiving API, source status and routing controls are components of the requested multi-source system, not evidence that the entire system is operational.

Use Duplicate review before contacting an inquiry that may have arrived through multiple sources. It suggests shared phone/email or matching address-and-ZIP pairs and saves staff decisions with a reason. It does not merge or remove provider deliveries, change assignments or consume a rotation turn. The immutable per-source delivery receipt remains authoritative for retries. Related records still require a coordinated next action; a review decision does not complete or cancel their existing follow-ups. The UI states matching limits and warns if its 5,000-pair bound is reached.


## Facebook activation boundary

Use a separately scoped Facebook sender for the MRS Page and explicitly selected lead forms. Map the stable Meta lead ID, original creation timestamp, name and selected contact fields into the same lead-only contract. Omit raw field_data, form questions, disclaimers, attachments, Page tokens and ad data. Keep consent evidence in Meta. The receiver does not accept Meta webhook envelopes directly, retrieve leads from Meta, subscribe the Page or authorize outreach.

Facebook defaults off and requires its own INTAKE_FACEBOOK_KEY, private owner setup and explicit fb-lead enablement. It never uses the paid Remodel Favor rotation. Verify a real provider SYSTEM CHECK delivery, unchanged replay and first genuine lead before declaring the integration live. A working Facebook Page connection does not prove leads_retrieval or a functioning sender.
