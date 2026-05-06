# Teum - Personal Diary & Emotional Tracking Platform

## Run & Operate

To run the application locally, ensure you have `pnpm` installed.

- **Root dependencies**: `pnpm install`
- **Frontend build**: `pnpm --filter web build`
- **Start application**: `pnpm start` (runs both frontend on port 5000 and backend on port 3001)
- **Capacitor sync (Android)**: `npx cap sync android` (after frontend build)

**Required Environment Variables**:
- `DATABASE_URL`
- `JWT_SECRET`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` (or `OPENAI_API_KEY`, `OPENAI_BASE_URL` as fallback)
- `MUREKA_API_KEY`
- `CORS_ORIGIN`, `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`
- `APPLE_CLIENT_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID`, `APPLE_PRIVATE_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (Replit Secrets only)
- `NICEPAY_MERCHANT_ID`, `NICEPAY_API_SECRET`, `NICEPAY_TEST_MODE`, `PAYMENT_MOCK_SUCCESS`
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`
- `BACKEND_URL`
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `BILLING_ENCRYPTION_KEY` (for billing key encryption)
- `MUREKA_WEBHOOK_SECRET` (for music webhook authentication)
- `CDN_URL`, `CDN_BUCKET_NAME`, `CDN_ENDPOINT`, `CDN_ACCESS_KEY_ID`, `CDN_SECRET_ACCESS_KEY`, `CDN_REGION`

## Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend**: Node.js, Express, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (Neon DB)
- **Mobile**: Capacitor (Android)
- **Package Manager**: pnpm (monorepo)
- **Build Tool**: Vite

## Where things live

- **Frontend application**: `apps/web/`
  - **Android Capacitor project**: `apps/web/android/`
  - **i18n files**: `apps/web/src/lib/i18n.ts`, `apps/web/src/contexts/LanguageContext.tsx`, `apps/web/src/hooks/useTranslation.ts`
  - **Country codes**: `apps/web/src/lib/countryCodes.ts`
- **Backend application**: `apps/server/`
  - **Controllers**: `apps/server/src/controllers/`
  - **Services**: `apps/server/src/services/` (auth, ai, music, push, sms, email, payment)
  - **Middleware**: `apps/server/src/middleware/` (auth, rate-limiter, csrf)
  - **CRON jobs**: `apps/server/src/jobs/`
  - **Encryption utilities**: `apps/server/src/utils/encryption.ts`
  - **CDN storage adapter**: `apps/server/src/utils/cdn.ts`
  - **Signed URL utility**: `apps/server/src/utils/signed-url.ts`
- **Root workspace config**: `package.json`, `pnpm-workspace.yaml`
- **Capacitor configuration**: `apps/web/capacitor.config.ts`

## Architecture decisions

- **Monorepo with pnpm**: Facilitates shared code (though `packages/` is currently reserved) and streamlined development.
- **Client-side routing with lazy loading**: `React.lazy` for all page components except Splash/Login to optimize initial load.
- **Hybrid mobile development with Capacitor**: Utilizes web codebase for Android app, with native integrations as needed (AdMob, push notifications, camera, browser, filesystem).
- **Dual payment system (NicePay + PayPal)**: Caters to both domestic (KRW) and international (USD) users with distinct integration paths for subscriptions and refunds.
- **Refund-safe subscription logic**: Robust webhook processing with idempotency, status management (`refunded` status immediately revokes access), audit logs, and email notifications for refunds and disputes.
- **Robust security features**: Includes AES-256-GCM for sensitive data (billing keys), HMAC-SHA256 for webhook signatures and signed URLs, DOMPurify for XSS protection, CSRF protection, and token versioning for concurrent login prevention.
- **No global `placeholderData: keepPreviousData` for React Query v5**: Avoided due to conflicts with `InfiniteQuery` (`pages.length` TypeError).

## Product

- **Diary Management**: Rich text diary entries, organized into folders.
- **Emotion Tracking**: Calendar view to track emotions and diary entries.
- **AI Feedback & Summary**: OpenAI-generated encouraging messages and diary summaries.
- **AI Music Generation**: Custom music tracks based on diary content, with localized lyrics generation.
- **Payment & Subscriptions**: Subscription options via NicePay (KRW) and PayPal (USD) with dynamic exchange rates and auto-renewal.
- **Ad Monetization**: Interstitial ads for free users on Android.
- **Push Notifications**: For music generation completion and support replies.
- **SMS & Email Verification**: Phone number and email verification for user authentication.
- **Social Login**: Google and Apple OAuth integration (server-side redirect).
- **Gamification**: Daily random writing prompts.
- **Admin Panel**: Management of users, diaries, questions, and legal terms.
- **User Account Management**: Soft delete with re-registration blocking and auto-purge for withdrawn accounts.

## User preferences

_Populate as you build_

## Gotchas

- **React Query v5 `placeholderData`**: Do not use `placeholderData: keepPreviousData` globally with `InfiniteQuery`. Use `prefetchInfiniteQuery` instead of `prefetchQuery` for `InfiniteQuery` keys.
- **Capacitor CORS**: Ensure `capacitor://localhost` and `https://localhost` are allowed origins.
- **Billing Key Encryption Key**: `BILLING_ENCRYPTION_KEY` must be a dedicated key, not reused from `JWT_SECRET`.
- **Music Webhook Secret**: `MUREKA_WEBHOOK_SECRET` is mandatory for webhook authentication.
- **Safe Area**: Apply `paddingTop: 'max(Npx, env(safe-area-inset-top, Npx))'` at the top-level content wrapper of each page for safe area handling on mobile.
- **Email Notification Logging**: All email sending functions should explicitly `catch(err => logger.error(...))` to record failures.
- **Session clear on login**: All login hooks must clear the query cache via `queryClient.getQueryCache().clear()`.

## Pointers

- **Drizzle ORM Documentation**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **React Query Documentation**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **Capacitor Documentation**: [https://capacitorjs.com/docs](https://capacitorjs.com/docs)
- **Tailwind CSS Documentation**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **OpenAI API Documentation**: [https://platform.openai.com/docs/api-reference](https://platform.openai.com/docs/api-reference)
- **PayPal API Documentation**: [https://developer.paypal.com/docs/api/overview/](https://developer.paypal.com/docs/api/overview/)
- **NicePay API Documentation**: _(Assumed internal documentation)_
- **Firebase FCM Documentation**: [https://firebase.google.com/docs/cloud-messaging](https://firebase.google.com/docs/cloud-messaging)
- **Solapi Documentation**: _(Assumed internal documentation)_
- **Resend Documentation**: [https://resend.com/docs](https://resend.com/docs)