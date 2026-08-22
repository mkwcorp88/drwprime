# AIDO Review 2026-08-21

This document records the sanitized production review summary for the AIDO sync
run on 2026-08-21. It intentionally excludes patient names, phone numbers,
medical record numbers, identity numbers, credentials, and raw API responses.

## Production Status

- Application release: `8273d58192d5116bf4c12e023a7ef955d4f486d3`
- Sync mode: `manual-browser`
- Canonical spending: disabled
- Reconciliation: disabled
- AIDO spending records created: `0`
- Loyalty points awarded from AIDO: `0`

## Imported Data

- AIDO patients fetched: `1727`
- AIDO patient links in DRW Prime: `1654`
- Patients requiring review: `73`
- AIDO income ledger records for 2026-08-21: `12`
- AIDO income ledger amount for 2026-08-21: `2812500`
- Income records matched to DRW Prime members: `0`
- Income records requiring review: `12`

## Review Result

No deterministic income auto-match was applied. The 12 income rows do not carry
a stable patient identifier or medical record number that can be safely mapped
to a DRW Prime member. Matching by patient name alone remains intentionally
blocked.

The 73 patient review rows are cases where AIDO patients could not be safely
linked automatically. Manual review is required before any merge or canonical
spending activation.

## Local Review Artifact

A detailed review artifact was generated at:

```text
/tmp/opencode/aido-review-2026-08-21.json
```

That file is not committed because it can contain patient identifiers and review
candidates. Keep it local and handle it as sensitive operational data.

## Next Steps

1. Review the 73 patient cases using the local artifact in a secure environment.
2. Ask AIDO/vendor for a stable patient identifier in the income report, or a
   supported relation from income transaction to patient MR/patient UUID.
3. Keep `AIDO_SYNC_CANONICAL_SPENDING=false` until income rows can be matched by
   stable identifiers.
4. Whitelist VPS IP `213.190.4.159` for AIDO access before relying on scheduled
   production sync.
