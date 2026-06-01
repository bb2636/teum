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

# Two-replit caveat
Build/deploy + prod DB run on a SEPARATE replit. This dev replit can't reach prod
DB/logs and its code may lag the build replit. Apply fixes on the build replit.
