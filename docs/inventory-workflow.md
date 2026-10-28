# Medicine inventory workflow

Medicine List manages catalogue details, reorder alerts, optional target stock, and photos. Quantities and expiry dates belong to batches. The inventory unit is locked after batch history exists.

## Stock counts and alerts

- **Available:** remaining units in unexpired batches that are not quarantined. The expiry date itself remains usable through that clinic day (Asia/Manila).
- **Physical:** all units still recorded in batches, including expired and quarantined units awaiting resolution.
- **Expired:** remaining units past their expiry date.
- **Quarantined count:** remaining unexpired units on hold. Expired held units appear in the expired count, avoiding double-counting.
- **Low stock:** available quantity is greater than zero and at or below the medicine’s reorder level. Zero available units means Out of Stock. The Low Stock tab and alert total include both conditions.
- **Target stock:** optional desired available balance after replenishment. Suggested replenishment is target minus available, floored at zero. This is not a maximum or a purchasing order.

## Batch actions

Receive Stock creates a batch or tops up the same manufacturer lot with the same expiry date. Record the manufacturer lot printed on the packaging when available. The system generates a separate internal batch reference. Existing internal references are preserved; historical manufacturer lots are not guessed.

Dispense selects a specific available batch. Expired, quarantined, and disposed stock cannot be dispensed. Concurrent writes lock the medicine and batch to prevent negative balances and conflicting same-lot receipts.

Quarantine holds a batch without changing its physical balance. Release requires a reason and cannot make expired stock usable. Both actions remain in batch history.

Record Disposal accepts partial or full quantities after actual physical disposal under the clinic’s procedure. The form requires acknowledgment and a reason/reference. Partial disposal keeps the remainder visible; completed disposal leaves the batch and ledger in history.

Count Adjustment records a signed difference from a verified physical count, with an explanation. New deliveries use Receive Stock. Earlier entries are never edited.

Reverse Entry corrects an erroneous receipt, dispensing entry, or count adjustment once by appending a linked opposite movement. It requires sufficient remaining balance. Legacy entries, completed disposal, and entries on fully disposed batches cannot be reversed. Record real physical transactions as new movements.

## History and archiving

Every new quantity movement preserves direction, purpose, before/after batch balance, timestamp, staff name, medicine identity, and batch identity. Quarantine/release events have their own append-only history. Legacy entries retain their original direction and note; missing reasons and balances remain unclassified.

Batches & History includes depleted and disposed batches using the All batches / history filter. Stock Movement includes archived medicines. A medicine can be archived only when its physical balance is zero; archiving preserves its batches and movements. Restore returns it to the active catalogue.

## Photos with no paid service

Search product photo opens browser image search using the medicine’s brand, generic name, strength, and dosage form. Staff verify the packaging and upload a permitted image, or take a photo directly. There is no image-search API key, card requirement, or subscription. Manual upload keeps the existing JPG/PNG/WebP and 5 MB limits.

## Verification

Run frontend/backend lint, build, and tests, plus `npm run sync:types:check`. Against a disposable migrated database, run `supabase/tests/inventory_lifecycle.sql`; synthetic records roll back. It covers lot matching, availability and reorder boundaries, expiry/quarantine dispensing guards, partial disposal, correction rules, immutable history, unit protection, and archiving. Never reset or seed production to apply this migration.
