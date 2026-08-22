# AIDO Daily Sync

DRW Prime imports the AIDO patient directory and the previous complete income
date through AIDO's authenticated API. The scheduled GitHub workflow starts at
19:00 UTC (02:00 WIB) and retries failed requests. Successful scheduled calls
also drain up to three pending dates, oldest first.

## Required configuration

Configure these only in the application secret store:

```env
AIDO_EMAIL=
AIDO_PASSWORD=
AIDO_HOSPITAL_ID=
AIDO_HOSPITAL_GROUP_ID=
AIDO_SYNC_SECRET=
AIDO_SYNC_CUTOVER_DATE=YYYY-MM-DD
AIDO_SYNC_CANONICAL_SPENDING=false
AIDO_SYNC_IMPORT_REVENUE=true
AIDO_SYNC_RECONCILE_MISSING=false
```

Optional settings:

```env
AIDO_BASE_URL=https://klinika.aido.id
AIDO_TIMEOUT_MS=30000
```

`AIDO_BASE_URL` is restricted to the approved HTTPS AIDO origin. The AIDO
account must be dedicated to this integration, read-only, and limited to the
configured hospital's patient directory and income report.

Configure this in the GitHub repository:

- Secret `AIDO_SYNC_SECRET`, identical to the application secret.

Never commit AIDO credentials, report exports, patient identifiers, or API
responses. Sync audit rows store aggregate counts and error codes only.

## Activation

1. Deploy the database migration and application with
   `AIDO_SYNC_CANONICAL_SPENDING=false` and
   `AIDO_SYNC_IMPORT_REVENUE=true`. This imports the complete AIDO income ledger
   and patients without awarding loyalty points or creating spending records.
2. Run a dry-run for a representative closed date with the protected endpoint
   or the workflow dispatch action.
3. Confirm `invalidRows` and `patientConflicts` are zero, and aim for
   `incomesUnmatched=0`. Validate transaction count and total value directly
   against AIDO in a secure environment. Income rows remain in the ledger even
   when a member match is pending, so unmatched income is still included in
   omzet. With canonical spending disabled, such a run is marked
   `COMPLETED_REVIEW` so the daily revenue schedule does not stall.
4. Confirm AIDO transaction IDs are stable and unique, pagination totals are
   exact, payment timestamps use the expected timezone, and removed or voided
   transactions disappear from the same complete report snapshot.
5. Set `AIDO_SYNC_CUTOVER_DATE` to the first date managed exclusively by AIDO.
   Manual spending remains available only for dates before this boundary.
6. Set `AIDO_SYNC_CANONICAL_SPENDING=true`, run the cutover date manually, and
   verify aggregate counts before relying on the schedule.
7. Set `AIDO_SYNC_RECONCILE_MISSING=true` only after confirming the income
   report is a complete hospital/date snapshot and its void/refund semantics.
   This removes stale ledger rows as well as stale loyalty projections.

Do not remove or move the cutover date after production imports exist. To stop
the integration, disable the workflow and set canonical sync to false; manual
post-cutover spending intentionally remains blocked to prevent duplicates.

## Failure behavior

- Malformed pages, missing totals, duplicate source IDs, invalid rows, and
  patient identity conflicts fail the workflow. Unmatched income is a review
  condition while canonical spending is disabled, not a reason to drop omzet or
  stall later dates.
- Invalid source rows are rejected before writes.
- A partial run is idempotently retried for the same oldest pending date.
- Missing AIDO transactions are removed and their aggregates reversed only
  after a complete, conflict-free source snapshot. Ledger rows are always the
  omzet source; `SpendingRecord` is only the matched-member loyalty projection.
- A database lease is renewed while pages and records are processed. Every
  aggregate transaction verifies ownership before writing.

The authenticated AIDO response contract must still be verified before the
canonical flag is enabled. Internal endpoints discovered from the web client
are not a substitute for a vendor-supported API contract.
