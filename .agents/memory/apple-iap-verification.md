---
name: Apple IAP server verification failures
description: Why a successful Apple purchase can leave zero subscription rows in the DB; how to confirm fast without an app rebuild.
---

# Symptom
User pays via Apple IAP, Apple shows an active subscription, but the app and admin
page both show "구독 전" (no subscription). Admin判定 = a `subscriptions` row with
`status='active'` exists for the user (`user.controller.ts getAllUsers`). Zero
subscribers in admin = **no active subscription rows exist at all** = the verify
INSERT never runs.

# Where the row gets created
First Apple subscription is created ONLY by the client `verify-receipt` →
`verifyAppleTransaction` path. The INSERT itself (subscription + payment in one tx)
is sound. The webhook `handleAppleNotification` does NOT create a first subscription
(returns `subscription_not_found`). So if verify-receipt never succeeds, nothing is
ever written.

# Failure is BEFORE the INSERT — two layers
1. **Client never calls verify-receipt** — original purchase flow can miss the
   `approved` replay. Recovery hook relies on `store.initialize()` which only
   replays UNFINISHED queued transactions; an already-owned active subscription is
   surfaced by `store.restorePurchases()`, NOT initialize. Recovery hook currently
   does NOT call restorePurchases — likely gap.
2. **Server Apple verification always fails** (systematic). `apple.provider.ts`
   `SignedDataVerifier` needs Apple Root CA certs loaded from an `apple-certs/` dir
   (`loadAppleRootCAs()`). **That dir is absent from the repo, not gitignored, and
   no script fetches it** → `rootCAs=[]` → `verifyAndDecodeTransaction` can't anchor
   the JWS cert chain → every transaction fails → `Apple verifyTransactionId failed
   in both envs` → no INSERT. Also requires `APPLE_ISSUER_ID` +
   `APPLE_IAP_KEY_ID`/`APPLE_KEY_ID` + `APPLE_IAP_PRIVATE_KEY`/`APPLE_PRIVATE_KEY`
   (missing → provider disabled → 503 `APPLE_NOT_CONFIGURED`), plus correct
   `APPLE_APP_ID_NUMERIC` (default 6762346897), `APPLE_BUNDLE_ID` (app.teum.com),
   `APPLE_ENV=production`.

# Fastest confirmation (no app rebuild)
Check the PRODUCTION server STARTUP log:
- `Apple provider initialized (dual env)` with `rootCertsLoaded: 0` → certs missing = smoking gun.
- `Apple provider: missing credentials` → creds missing.
On a purchase: `Apple verifyTransactionId failed in both envs` (server problem) vs.
no `POST /api/payments/apple/verify-receipt` at all (client problem → restorePurchases).

**Why this matters:** server-side cert/cred fix needs only a Replit redeploy, NO
costly Xcode/TestFlight rebuild. Confirm the layer before rebuilding anything.

# Resolution (this codebase)
Apple Root CA certs (Apple Inc Root, G2, G3 — G3 is the one that anchors App Store
Server JWS) committed to `apps/server/apple-certs/`; loader finds them in both dev
(`tsx`) and prod (`node dist`) via the `__dirname/../../../apple-certs` candidate.
Startup log now shows `rootCertsLoaded: 3`. Also corrected the hardcoded
`APPLE_APP_ID_NUMERIC` fallback to the real app Apple ID (was an unrelated number).

# Gotcha: pino logger arg order
`logger` is raw pino → call is `logger.info(mergeObj, msg)` (object FIRST). Several
apple.provider verify logs were written `(msg, obj)`, so ALL structured fields
(incl. `rootCertsLoaded`, failure `error`/`transactionId`) were silently dropped —
making prod diagnosis impossible. Always put the object first.

# Startup auto-recovery (restorePurchases on relaunch)
The iOS startup-recovery hook calls `store.initialize()` (replays only UNFINISHED
pending transactions) AND `store.restorePurchases()` (surfaces already-owned active
subs) so a purchased sub auto-reflects on app relaunch without the manual Restore
button.
**Rule 1:** before doing any StoreKit work, fetch `GET /payments/subscriptions` and
SKIP recovery entirely if an active (or cancelled-but-not-expired) sub already
exists in our DB. **Why:** `restorePurchases()` re-emits `approved` on EVERY call,
so without this guard every launch fires a needless verify-receipt + navigates to
/payment/success.
**Rule 2:** `_recovering`/`verifyingRef` only block CONCURRENT approved handling, not
SEQUENTIAL (initialize replay then restorePurchases can re-emit the same txid). Use a
module-level processed-transactionId Set (`_isTransactionProcessed`/`_markTransactionProcessed`
in useAppleIAP), marked only after successful verify+finish, shared by both the
purchase-flow and recovery handlers.

# Two-replit caveat
Build/deploy + prod DB run on a SEPARATE replit. This dev replit can't reach prod
DB/logs and its code may lag the build replit. Apply fixes on the build replit.

# Gotcha: APPLE_PRIVATE_KEY (.p8) PEM normalization
After certs were fixed, prod hit `secretOrPrivateKey must be an asymmetric key
when using ES256` — App Store Server API JWT signing failed. Cause: the .p8 key
env var can be stored in 4 shapes (real-newline multiline PEM; escaped `\n`;
single-line PEM with header+footer but NO newlines; raw base64, no header). The
old code only un-escaped `\n` and passed through anything containing `-----BEGIN`
as-is — so a single-line PEM stayed unparseable (`DECODER unsupported`).
**Rule:** normalize by stripping ALL PEM armor + whitespace down to the base64
body, re-wrap at 64 chars, re-emit `-----BEGIN PRIVATE KEY-----` PKCS#8 PEM
(`normalizeApplePrivateKey` in apple.provider.ts). Apple .p8 is always
unencrypted PKCS#8 EC P-256, so forcing that header is safe.
**Verify fast:** `crypto.createPrivateKey(pem)` should give
`asymmetricKeyType:'ec', namedCurve:'prime256v1'` and a 64-byte ieee-p1363
sha256 signature. Never print the key — only metadata.

# Gotcha: TestFlight = Sandbox, can't restore a PRODUCTION purchase
"복원할 구매 내역이 없습니다" on the restore screen in a TestFlight build is NOT a
bug when the original purchase was a real App Store (production) purchase. TestFlight
builds ALWAYS use the StoreKit Sandbox environment, so `restorePurchases()` only sees
sandbox purchases — a production (real-money) subscription is invisible there and the
8s no-`approved` timeout correctly yields `no_purchases`. The restore handler and the
shared `.approved()` listener (fires for both buy & restore) are sound — confirm them
before suspecting client code.
**How to validate correctly:**
- Test the SERVER fix end-to-end in TestFlight by making a NEW *sandbox* purchase
  (Settings→App Store→Sandbox Account) — fresh buy goes straight to verify-receipt;
  prod server tries Production then falls back to Sandbox, so it verifies.
- To restore an actual production purchase you must use the PRODUCTION App Store app
  (new build live), not TestFlight.
- Already-affected real users self-recover only once the new build (with restore +
  startup recovery) is LIVE on the App Store AND the server verify fix is deployed;
  then restore / relaunch auto-recovery succeeds.

# Root cause: product-ID migration orphaned legacy subscribers
The Apple IAP product ID was migrated over time: subscription01 → subscription02 →
subscription03 (current). Auto-renewable subs KEEP renewing under the product ID they
were first bought on, so users who subscribed before a switch are still renewing the
OLD id. The app registered ONLY the current id with StoreKit, so `restorePurchases()`/
startup recovery never surfaced legacy subscribers' transactions (StoreKit ignores
transactions for unregistered product IDs) → restore shows "복원할 구매 내역이 없습니다"
and their subscription is never recorded. Server `verifyAppleTransaction` also hard-
rejected any productId != current with INVALID_PRODUCT.
**Rule:** register ALL historic product IDs on the client (subscription01/02/03) and
ACCEPT all of them in server verify (allowlist: current `APPLE_PRODUCT_ID` +
`APPLE_LEGACY_PRODUCT_IDS`, default 'subscription01,subscription02'); keep NEW
purchases (precheck + order) limited to the current id only. Whenever the product ID
changes again, add the retired id to both the client register list and the server
legacy allowlist, or every existing subscriber gets orphaned.
**Important:** the client (register list) fix only reaches users once a NEW build is
LIVE on the App Store (TestFlight can't restore production purchases); the server
allowlist fix needs a prod redeploy. Both required for legacy subscribers to recover.

# Client gap: `approved` never re-fires for already-acknowledged subs
`store.restorePurchases()` only emits an `approved` event for transactions that are
NOT yet finished/acknowledged. An already-active auto-renewing subscription that was
finished in a prior session is present in `store.localReceipts` but emits NO
`approved` on restore → an `approved`-only restore/recovery handler hits its 8s
timeout and wrongly returns "복원할 구매 내역이 없습니다", so verify-receipt is never
called and the sub is never recorded.
**Rule:** never rely solely on `approved` for restore/startup-recovery. In parallel,
scan `store.localReceipts[].transactions[]` for a `transactionId` whose product is in
the registered (incl. legacy) IDs and POST it straight to verify-receipt. Make both
paths race and settle once; server is idempotent by originalTransactionId so a
duplicate verify between the two paths is safe. Access `localReceipts` defensively
(shape varies by plugin version) and degrade to null. The shared helper is
`findOwnedAppleTransactionId(store, productIds)`.
