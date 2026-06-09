---
name: Apple IAP verify-receipt quirks
description: CdvPurchase v13 iOS "appstore.application" placeholder txId and the verify dedup-key rules for the Apple IAP restore/recovery flow.
---

# CdvPurchase v13 iOS — "appstore.application" placeholder

On iOS, CdvPurchase v13 can report `transaction.transactionId === "appstore.application"`
for an app-bundle receipt. This is NOT a real StoreKit transaction id and Apple's
App Store Server API (getTransactionHistory) rejects it.

**Workaround:** extract the base64 app receipt from `store.localReceipts` and POST it as
`{ receipt }` to `/payments/apple/verify-receipt`; the server's
`ReceiptUtility.extractTransactionIdFromAppReceipt()` derives the real txId. The route
accepts EITHER `{ transactionId }` OR `{ receipt }`.

**How to apply (all three IAP paths must handle the placeholder consistently):**
purchase `approved` handler, `restore()` receipt scan, and startup
`recoverOwnedFromReceipts`. In each: if txId is missing OR `=== "appstore.application"`,
fall back to the `{ receipt }` path.

# verify-receipt dedup / processed-marking rules

- **Never persist `"appstore.application"` (or any synthetic/static key) in the
  in-session "processed" set.** If you do, a later genuine event carrying that placeholder
  short-circuits to success without a server verify (silent data-integrity bug).
  Only mark/short-circuit `_processedTransactionIds` with a REAL transaction id.
- **Separate the in-flight dedup key from the processed-identity key.** Receipt-mode
  verify has no real txId yet, so it gets an in-flight key only (e.g. a hash of the
  receipt) and NO persistent processed marking.
- **In-flight dedup must share the actual result.** Use a `Map<key, Promise<boolean>>`
  and return the in-flight promise to concurrent callers — a Set+poll guard that returns
  a forced `false` to waiters causes false "restore failed" outcomes.

**Why:** discovered via the 6bc306 branch merge; took several review rounds because each
of these (placeholder in approved handlers, static processed key, forced-false waiter) is
a separate instance of the same short-circuit hazard.

# storeRef vs local store in approved handler

The `approved` listener is registered inside `doInit`, but `storeRef.current` is only
assigned AFTER `store.initialize(...)`. An initialize-replay `approved` event can fire
before that assignment, so read receipts via `storeRef.current ?? store` (the local
const), not `storeRef.current` alone, or the placeholder fallback breaks.
