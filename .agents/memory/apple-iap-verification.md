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
