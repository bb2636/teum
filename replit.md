# Teum - Personal Diary & Emotional Tracking Platform

## Project Overview

Teum is a mobile-optimized web application where users can write personal diaries, organize them into folders, track emotions on a calendar view, and generate AI-powered music tracks based on their diary content. Supports Korean/English internationalization and Android native app via Capacitor.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend**: Node.js + Express, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (외부 Neon DB)
- **Mobile**: Capacitor (Android)
- **Package Manager**: pnpm (monorepo with workspaces)

## Project Structure

```
teum/
├── apps/
│   ├── web/          # React frontend (Vite, port 5000)
│   │   ├── android/  # Capacitor Android project
│   │   └── src/
│   └── server/       # Express backend (port 3001)
│       └── src/
│           ├── controllers/
│           ├── middleware/    # auth, rate-limiter
│           ├── repositories/
│           ├── services/     # auth, ai, music, push, sms, email
│           └── jobs/         # cron jobs (cleanup)
├── packages/         # Shared packages (reserved)
├── package.json      # Root workspace config
└── pnpm-workspace.yaml
```

## Development

- **Frontend**: runs on port 5000 (workflow: "Start application")
- **Backend**: runs on port 3001 (workflow: "Backend")
- API requests from frontend are proxied from `/api` to `http://localhost:3001`
- **코드 스플리팅**: `router.tsx`에서 `React.lazy`로 모든 페이지 컴포넌트 동적 임포트. SplashPage/LoginPage만 즉시 로드, 나머지는 네비게이션 시 로드.

## Key Features

### 1. Diary Management
- Rich text entries organized into folders
- Floating format toolbar (bold/italic/underline/list/color), follows keyboard on mobile
- Free users: max 2 folders, 4th diary onwards requires ad viewing

### 2. Calendar View
- Track entries and emotions on a calendar
- Same-folder entries grouped with count display

### 3. AI Feedback & Summary
- OpenAI-generated encouraging messages (content 변경 시에만 재생성)
- AI 일기 요약 (2-3문장, 담담한 톤)
- "AI와 대화하기" 버튼 (개발 중)

### 4. AI Music Generation
- Mureka API generates custom music from diary content
- 가사 생성 시 일기 원문 재구성 (직접 인용 금지), 쉼표 맞춤법 준수
- 부정적 내용도 희망적으로 승화
- **언어별 가사 생성**: 앱 언어설정(ko/en) + 일기 내용 언어를 모두 고려. 일기가 전부 한국어면 한국어 가사, 전부 영어면 영어 가사, 한영 혼합이면 비율에 맞춰 자연스럽게 한영 믹스 가사 생성. frontend `getCurrentLanguage()` → backend `language` 파라미터로 전달
- 음악 상세 페이지에서 곡 정보 확인 및 다운로드
- 실제 오디오 메타데이터에서 곡 길이 표시
- On quota/rate-limit failure, saves AI-generated lyrics with `lyrics_only` status

### 5. AdMob Ads (무료유저 광고)
- **Plugin**: `@capacitor-community/admob` v8
- **App ID**: `ca-app-pub-3503508648798732~4006393534`
- **Interstitial Ad Unit**: `ca-app-pub-3503508648798732/4090154015`
- **Config locations**: `AndroidManifest.xml` (meta-data), `capacitor.config.ts` (AdMob plugin), `AdModal.tsx` (ad unit ID)
- **Behavior**: Native (Android) → real AdMob interstitial; Web → 5초 countdown fallback UI
- **Trigger**: Free users see interstitial ad from 4th diary onwards before save

### 6. Payments (NicePay + PayPal)
- **듀얼 결제 시스템**: NicePay (한국 카드, KRW) + PayPal (해외, USD)
- NicePay JS SDK 연동 (신용/체크카드)
- **PayPal Subscriptions**: PayPal Subscriptions API v1 (자동 반복 결제)
  - `POST /api/payments/paypal/init` → Product/Plan 자동 생성(캐시) → PayPal 구독 생성 → approveUrl 반환
  - `GET /api/payments/paypal/return?subscription_id=...&oid=...` → 구독 상태 검증(ACTIVE/APPROVED) → DB 구독 생성
  - `GET /api/payments/paypal/cancel` → 취소 처리
  - 서버 `services/payment/paypal.provider.ts`: OAuth2 토큰 자동 갱신, Product/Plan 생성(캐시), 구독 생성/조회/취소
  - PayPal이 매월 자동 결제 처리 (서버 스케줄러 불필요)
  - `subscriptions.paypal_subscription_id` 컬럼에 PayPal 구독 ID 저장
  - 구독 취소 시 PayPal API로도 자동 취소
  - 세션 삭제는 DB 커밋 성공 후에만 수행
- **동적 환율 기반 가격**: 기준가 $3.99 USD → 실시간 환율 적용 → KRW 100원 단위 반올림
  - `GET /api/payments/plan-price` → `{ usd, krw, rate }` 반환 (인증 불필요)
  - 환율 소스: open.er-api.com (6시간 캐싱, 실패 시 fallback 1450)
  - 서버 `utils/currency.ts`: `getKRWPrice()`, `getExchangeInfo()`, `getBasePriceUSD()`
  - 프론트 `usePlanPrice()` 훅으로 동적 금액 표시
  - 서버 금액 검증: ±200원 허용 오차 (환율 변동 대비)
- **빌링키(Billing Key) 기반 자동결제** (NicePay):
  - `POST /api/payments/billing/init` → NicePay `subscribe` method로 빌링키 등록
  - `POST /api/payments/nicepay/billing-return` → 빌링키 승인 + 첫 결제 자동 처리
  - 빌링키 미반환 시(샌드박스) → `processDirectPaymentReturn`으로 직접 결제 처리
  - `billing_keys` 테이블에 빌링키 저장 (bid, cardCode, cardName, cardNo, status)
  - 자동 갱신 스케줄러: `index.ts`에서 매시간 `processAutoRenewals()` 호출 → 만료된 구독 확인 → 빌링키로 자동 결제 (최대 3회 재시도) → 새 구독 생성
  - 구독 취소 시 빌링키도 자동 해지 (NicePay API + DB)
- **재구독 본인인증**: 이전 구독 이력이 있으면(취소/만료) 빌링키 등록 전 서버에서 검증
  - `GET /api/payments/needs-verification` → 프론트에서 조건부 SMS 인증 모달
  - `identityVerified` 플래그를 서버에 전달 → 서버에서도 검증
- 결제 세션 DB 영구 저장 (`payment_sessions` 테이블, 30분 TTL 자동 정리)
- 금액은 서버 세션에서 관리 (콜백 금액 미사용, 조작 방지)
- `PAYMENT_MOCK_SUCCESS=true`로 테스트 모드 지원
- 결제 실패/성공 페이지 제공
- 관리자 구독 취소: `/api/payments/admin/subscriptions/cancel`
- 취소된 구독은 `endDate`까지 유효 (Grace Period)
- 프론트엔드 결제 방법 선택: 라디오 버튼으로 NicePay/PayPal 전환 (언어 기반 기본값)
- **환불 안전 구독 로직 (Refund-Safe Subscriptions)**:
  - `subscription_status` enum: `active`, `cancelled`, `expired`, `pending`, `refunded`
  - PayPal 웹훅: `POST /api/payments/paypal/webhook` — `PAYMENT.SALE.REFUNDED`, `PAYMENT.SALE.REVERSED`, `CUSTOMER.DISPUTE.CREATED` 처리
  - NicePay 웹훅: `POST /api/payments/nicepay/webhook` — 환불 콜백 처리
  - 환불 시: `subscription.status = 'refunded'`, `endDate = now()` → 즉시 접근 차단 (잔여 기간 무시)
  - `getActiveSubscription()`: `status === 'refunded'`는 매칭 불가 → 자동 deny
  - **멱등성**: `webhook_events` 테이블 (eventId UNIQUE) — 모든 이벤트 타입(REFUND/CANCEL/DISPUTE)에 중복 웹훅 처리 방지
  - **시그니처 검증**: PayPal API 서명 검증 (`PAYPAL_WEBHOOK_ID` 필수), NicePay는 `resultCode === '0000'` 검증 + DB tid 대조
  - **NicePay 멱등성 키**: `cancelNum || nicepay_{tid}` (Date.now() 폴백 제거로 안정적 키 보장)
  - `apps/server/src/services/payment/refund.service.ts` — 환불 처리 로직
  - Raw body 보존: `express.json({ verify })` — webhook 경로만 `req.rawBody` 저장
  - **환불 감사 로그**: `refund_logs` 테이블 (userId, paymentId, eventType, rawPayload, createdAt)
  - **환불 이메일 알림**: 유저에게 환불 완료 안내, 관리자에게 상세 정보 발송 (`ADMIN_EMAIL` 환경변수 필요)
  - **분쟁(dispute) 처리**: `CUSTOMER.DISPUTE.CREATED` → 로그 기록 + 관리자 이메일 알림 (자동 환불 미적용, 수동 확인 필요)

- **자동 갱신 (Auto-Renewal)**:
  - 1시간 주기 (`setInterval`), 동시 실행 방지 (`isProcessingRenewals` 가드)
  - NicePay: 현재 서버 환율 기준 금액으로 청구 (`getServerPlanAmount()`, 구독 당시 금액 아님)
  - PayPal: PayPal API에서 구독 상태 확인 후 `endDate` 연장 + `payments` 테이블에 결제 기록 저장
  - **유예기간 (Grace Period)**: 결제 실패 시 즉시 만료하지 않고 3일간 일 1회 재시도
    - `renewalFailCount` (실패 횟수), `nextRetryAt` (다음 재시도 시각) 컬럼으로 추적
    - 3회 초과 실패 시 `status = 'expired'`로 전환
  - 빌링키 없는 경우 즉시 만료

### 7. Push Notifications (Firebase FCM)
- 음악 생성 완료, 관리자 문의 답변 시 자동 발송
- `@capacitor/push-notifications` (프론트) + `firebase-admin` SDK (서버)
- 디바이스 토큰 등록/해제: `POST /api/push/register`, `POST /api/push/unregister`
- DB: `device_tokens` 테이블 (userId, token, platform)

### 8. SMS Verification (Solapi)
- 회원가입/비밀번호 재설정 시 전화번호 인증 문자 발송
- HMAC-SHA256 인증, 인증번호 5분 유효, 5회 오류 시 1시간 잠금

### 9. Email (Resend) — 다국어 지원
- 회원가입/비밀번호 재설정 시 이메일 인증번호 발송
- teum 브랜드 HTML 템플릿, HTML 이스케이프 적용
- `RESEND_API_KEY` 미설정 시 nodemailer 폴백
- **다국어 이메일**: 유저 프로필의 `language` 필드(ko/en)에 따라 이메일 제목/본문이 자동 전환
  - DB `user_profiles.language` 컬럼 (기본값 'ko')
  - 회원가입 시 프론트엔드에서 현재 언어 설정 서버에 전달
  - 프로필 편집에서 언어 변경 시 서버에 저장 → 이후 이메일 해당 언어로 발송
  - 첫 접속 시 브라우저 언어 자동 감지 (영어 브라우저 → 영어 UI)
- **이메일 알림 트리거 (7종)**: 모든 알림은 fire-and-forget (비동기, 실패해도 메인 로직 차단 안 함)
  - 회원가입 완료 (`sendSignupNotification`) → `auth.service.ts` signup/socialOnboarding
  - 회원 탈퇴 완료 (`sendWithdrawalNotification`) → `user.controller.ts` deleteAccount
  - 구독 시작 (`sendSubscriptionStartNotification`) → `payment.service.ts` chargeWithBillingKey/approveNicePayPayment/processPayment(mock)
  - 구독 해지 (`sendSubscriptionCancelNotification`) → `payment.service.ts` cancelSubscription
  - 프로필 변경 (`sendProfileUpdateNotification`) → `user.service.ts` updateProfile
  - 문의 접수 (`sendInquirySubmittedNotification`) → `support.service.ts` createInquiry
  - 문의 답변 (`sendInquiryAnsweredNotification`) → `support.service.ts` updateInquiryAnswer

### 10. Social Login (OAuth - 서버 리다이렉트 방식)
- **Google**: 서버측 OAuth 2.0 리다이렉트 플로우 (`/api/auth/google/url` → Google 로그인 → `/api/auth/google/callback`)
- **Apple**: 서버측 OAuth 리다이렉트 플로우 (`/api/auth/apple/url` → Apple 로그인 → `/api/auth/apple/callback`)
- **Capacitor 네이티브 (iOS/Android)**: `@capacitor/browser`의 `Browser.open()`으로 시스템 브라우저에서 OAuth 진행
  - WebView 감지: `Capacitor.isNativePlatform()` + User-Agent `wv` 패턴 이중 감지
  - `state=platform=mobile&nonce=<random>` 파라미터로 모바일 요청 식별 + CSRF 방어
  - 기존 유저: 서버에서 임시 토큰 생성 (in-memory Map, 5분 TTL) → HTML 딥링크 페이지 반환 (`sendMobileDeepLinkPage`) → `com.teum.app://auth-callback?token=xxx`
  - 신규 유저: HTML 딥링크 페이지 → `com.teum.app://auth-callback?isNewUser=true&...` 소셜 프로필 전달
  - Android: `AndroidManifest.xml`에 `com.teum.app` URL scheme intent-filter 등록
  - 딥링크 수신: `App.addListener('appUrlOpen')` + `App.getLaunchUrl()` cold start 처리
  - 브라우저 폴백: `Browser.addListener('browserFinished')` → `/api/auth/me` 인증 확인
  - 토큰 교환: `POST /api/auth/exchange-mobile-token` (rate limited, 1회용, 쿠키 설정)
- **웹**: 기존 서버 리다이렉트 + 쿠키 설정 방식 유지
- 신규 유저는 `/social-onboarding`으로 리다이렉트 (닉네임, 이름, 생년월일, 약관 동의)
- `auth_accounts` 테이블에 provider별 계정 연결 (email/google/apple)

### 11. Gamification
- Daily random questions to prompt writing

### 12. Admin Panel
- Manage users (active/suspended/withdrawn), diaries, questions, legal terms
- 관리자 구독 취소 기능

## Safe Area (Capacitor Mobile)
- `viewport-fit=cover` is set in `index.html`
- All page headers use inline style `paddingTop: 'max(Npx, env(safe-area-inset-top, Npx))'` to avoid status bar overlap on notched devices
- Tab pages (Home, Calendar, Music, My): 24px default
- Auth pages (Login, Signup, SocialOnboarding): 32px default
- Pattern: apply once at the top-level content wrapper per page; never double-stack with absolute-positioned elements

## Security Features

### Billing Key Encryption
- AES-256-GCM으로 빌링키(bid) 암호화 저장
- `apps/server/src/utils/encryption.ts` — encrypt/decrypt/isEncrypted 유틸리티
- 암호화 키: `BILLING_ENCRYPTION_KEY` (필수, 전용 키). JWT_SECRET 재사용 금지
- 복호화 시 현재 키 실패 → JWT_SECRET 레거시 키로 fallback (마이그레이션 지원, 경고 로그)
- 기존 평문 bid도 호환 (isEncrypted 감지 → 평문이면 그대로 반환)

### Server Stability
- **Graceful shutdown**: SIGTERM/SIGINT → HTTP 서버 close → DB 연결 해제 → 10초 타임아웃 후 강제 종료
- **Process error handlers**: `uncaughtException` → 로그 후 graceful shutdown, `unhandledRejection` → 로그만
- **이메일 알림 에러 로깅**: `.catch(() => {})` → `.catch(err => logger.error(...))`로 모든 이메일 발송 실패 기록
- **자동갱신 재시도**: 최대 3회 재시도 (5초 간격), 모든 시도 실패 시 구독 만료 처리
- **결제 로그 민감정보 제거**: NicePay 응답 전체 JSON 대신 필요한 필드(resultCode, resultMsg, tid 등)만 로깅
- **SMS 로그 마스킹**: 전화번호 앞3자리+****+뒤4자리만 로깅

### CDN Storage Adapter
- S3-compatible API (AWS S3 / Cloudflare R2) 구현
- AWS Signature V4 자체 구현 (외부 SDK 없이)
- 환경변수: `CDN_URL`, `CDN_BUCKET_NAME`, `CDN_ENDPOINT`, `CDN_ACCESS_KEY_ID`, `CDN_SECRET_ACCESS_KEY`, `CDN_REGION`
- upload/delete/get 메서드 지원

### Payment Amount Validation
- `PLAN_PRICES` 상수로 플랜별 정가 관리 (premium_monthly: 4900원)
- `initBillingKeyRegistration`, `initPayment` 양쪽에서 서버 측 금액 검증
- 클라이언트가 URL 파라미터로 전달한 금액이 정가와 불일치 시 결제 차단

### Billing Key Return Idempotency
- `processingBillingReturns` Set으로 동일 orderId 동시 처리 방지
- NicePay 콜백 중복 호출 시 이중 빌링키 등록/이중 결제 차단
- 세션 삭제 후 재호출 시에도 "세션 없음"으로 차단 (2중 보호)

### Music Webhook Authentication
- `MUREKA_WEBHOOK_SECRET` 필수 — 미설정 시 503 거부 (no bypass)
- HMAC-SHA256 서명 검증 (`x-webhook-signature` 헤더, `timingSafeEqual` + 길이 체크)
- Bearer/secret 헤더 fallback (역시 timing-safe 비교)

### Storage Access Control
- `/api/storage/*` 경로 인증 필수 (서명 토큰 또는 세션 쿠키)
- `apps/server/src/utils/signed-url.ts` — HMAC 기반 서명 URL 생성/검증
- 업로드 시 `signedUrl` 반환 (1년 유효), 기존 `url`도 함께 반환 (호환)
- 세션 쿠키 인증 시 tokenVersion 검증 포함 (세션 해지 시 즉시 차단)

### XSS Protection
- DOMPurify로 일기 콘텐츠 sanitize (허용 태그/속성 화이트리스트)
- CSS `style` 속성: 안전한 CSS 속성만 허용 (color, font-size 등), 그 외 제거
- `onerror`, `onload`, `onclick`, `onmouseover` 속성 금지 (FORBID_ATTR)

### CSRF Protection
- `apps/server/src/middleware/csrf.ts` — Origin/Referer 검증
- NicePay/PayPal 결제 콜백은 bypass (originalUrl + path 이중 체크)

### JWT Security
- `default_secret` fallback 제거 — `process.env.JWT_SECRET!` 필수

### Concurrent Login Prevention (중복 로그인 방지)
- `users.token_version` (integer, default 0) — 로그인마다 increment
- Refresh token에 `tokenVersion` 포함
- Access token 만료 → refresh 시 DB tokenVersion과 비교 → 불일치면 쿠키 삭제 + `SESSION_EXPIRED` 반환
- `tokenVersion` 미포함 토큰도 거부

### Rate Limiting
- **Login**: 10회/15분 (keyGenerator: email → IP fallback)
- **Signup**: 5회/1시간
- **Verification**: 5회/1시간 (keyGenerator: phone/email → IP fallback)
- **Password Reset**: 5회/1시간 (keyGenerator: email → IP fallback)
- **Global API**: 100회/1분
- **구현**: `apps/server/src/middleware/rate-limiter.ts` (express-rate-limit v8, `validate: false`, IPv6 `::ffff:` 정규화)

### Image Upload Error Handling
- 3곳 (DiaryWritePage, HomePage, FolderSelectModal)에서 업로드 실패 시 Toast 표시
- 실패 시 selectedFiles + selectedImages 정리
- Toast z-index z-[70]으로 모달 위 표시

### Login Session Safety
- All login hooks clear query cache via `queryClient.getQueryCache().clear()` in `onMutate` and `onSuccess`
- Server login endpoints clear existing cookies before setting new ones
- `useLogout` clears both query and mutation caches

## DB Performance Indexes
- Migration 0018: `token_version` index
- Migration 0019: 7개 인덱스 (folders, ai_feedback, diary_answers, auth_accounts, diaries, music_jobs)

## Data Caching Strategy

- `staleTime: 1000*60*5` (5분) — 탭 이동 시 5분 이내면 캐시 표시, 이후 재요청
- `gcTime: 1000*60*60*6` (6시간, queryClient 기본) / 개별 훅은 `1000*60*60` (1시간)
- **글로벌 `placeholderData` 사용 금지**: React Query v5에서 글로벌 `placeholderData: keepPreviousData`는 InfiniteQuery(`useDiaries`, `useMusicJobs`)와 충돌하여 `pages.length` TypeError 발생. 개별 훅에서 필요시만 설정할 것.
- **InfiniteQuery 키로 prefetchQuery 사용 금지**: `useInfiniteQuery` 키와 동일한 키로 `prefetchQuery`를 사용하면 캐시에 flat 데이터가 저장되어 `pages.length` 크래시 발생. 반드시 `prefetchInfiniteQuery` 사용할 것 (BottomTabBar 참조).
- 서버: 모든 `/api/` 응답에 `Cache-Control: no-store` 설정 (WebView HTTP 캐시 방지)
- 데이터 갱신은 mutation의 `onSuccess`에서 `invalidateQueries()`로 처리 (CQRS 패턴)
- 사용자 프로필 쿼리 키: `['user', 'me']` — 결제/구독 훅에서도 동일 키 사용 필수
- 계정 전환 시: `forceFullCacheClear()` → `cancelQueries()` + `clear()` + `removeQueries()` + `localStorage.clear()`
- `onUserChanged(userId)`: `/users/me` 응답 시 이전 userId와 다르면 자동 캐시 전체 초기화

## Pagination (Lazy Loading)

- **방식**: offset 기반 pagination, `limit+1` trick으로 `hasMore` 판별
- **페이지 크기**: diary=20개, music=20개
- **백엔드 응답 형식**: `{ diaries/jobs, hasMore, nextOffset }` + 음악은 `monthlyUsed/monthlyLimit/hasSubscription/nextPaymentDate` 포함
- **프론트엔드 훅**:
  - `useDiaries(folderId?)` — `useInfiniteQuery` 기반, 스크롤 목록 페이지용 (HomePage, DiaryListPage)
  - `useAllDiaries()` — `useQuery` 기반, 전체 목록이 필요한 페이지용 (MusicCreatePage, MusicHomePage, MusicJobPage, MusicListPage, FolderSelectModal)
  - `useMusicJobs()` — `useInfiniteQuery` 기반, 음악 목록 페이지용 (MusicHomePage, MusicListPage)
  - `useInfiniteScroll(props)` — IntersectionObserver 기반 공통 센티넬 훅
- **캘린더**: 월별 전체 fetch 유지 (`useCalendarDiaries`), 마커 표시용이므로 pagination 불필요
- **UI**: 자동 스크롤 센티넬 + "더보기" 폴백 버튼 (`common.loadMore`)

## Internationalization (i18n)

- **Languages**: Korean (ko), English (en) — 국가 선택에 따라 전환
- **Architecture**: `LanguageContext` → `useT()` hook → `t('key')` function
- **Files**: `apps/web/src/lib/i18n.ts`, `apps/web/src/contexts/LanguageContext.tsx`, `apps/web/src/hooks/useTranslation.ts`
- **Rules**: Never import `setLanguageFromCountry` directly from `i18n.ts` — always use Context version via `useLanguage()`

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret for auth
- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI Integrations for OpenAI
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` - Legacy fallback for OpenAI
- `MUREKA_API_KEY` - AI music generation
- `CORS_ORIGIN` / `FRONTEND_URL` - Frontend URL for CORS
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID (server)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID (frontend)
- `APPLE_CLIENT_ID` - Apple Sign In Service ID (서버, `app.teum.teum1`)
- `APPLE_KEY_ID` - Apple Sign In Key ID
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_PRIVATE_KEY` - Apple Sign In 비공개 키 (.p8 내용)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase 서비스 계정 JSON (Replit Secrets에만 저장)
- `NICEPAY_MERCHANT_ID` - NicePay 상점 ID; 샌드박스=`S2_...`, 운영=`R2_...`
- `NICEPAY_API_SECRET` - NicePay API Secret Key
- `NICEPAY_TEST_MODE` - `TRUE`면 sandbox API 사용
- `PAYMENT_MOCK_SUCCESS` - `true`면 실제 NicePay 호출 없이 DB만 저장 (테스트용)
- `PAYPAL_CLIENT_ID` - PayPal REST API Client ID
- `PAYPAL_CLIENT_SECRET` - PayPal REST API Secret
- `PAYPAL_MODE` - `live`면 운영 API, 미설정 시 sandbox
- `PAYPAL_WEBHOOK_ID` - PayPal 웹훅 ID (환불 이벤트 서명 검증용, PayPal Dashboard에서 생성)
- `BACKEND_URL` - NicePay/PayPal returnUrl 생성용 백엔드 URL
- `SOLAPI_API_KEY` - 솔라피 API Key (SMS)
- `SOLAPI_API_SECRET` - 솔라피 API Secret
- `SOLAPI_SENDER_NUMBER` - 솔라피 발신번호 (하이픈 없이)
- `RESEND_API_KEY` - Resend API Key (이메일)
- `RESEND_FROM_EMAIL` - Resend 발신 이메일 주소

## Capacitor (Android)

- **Config**: `apps/web/capacitor.config.ts` - appId: `com.teum.app`
- **Server URL**: APK는 `server.url: 'https://teum.replit.app'`으로 배포 서버에서 직접 로드
- **CORS**: Capacitor origin (`capacitor://localhost`, `https://localhost`) 허용
- **쿠키**: 프로덕션 환경에서 `sameSite: 'none'` + `secure: true`
- **Camera**: `@capacitor/camera` 사용, 네이티브/웹 자동 감지. Android manifest에 `CAMERA`, `READ_MEDIA_IMAGES` 권한 선언. iOS는 `capacitor.config.ts`에 `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` 설정. 카메라 사용 전 `checkPermissions()` → `requestPermissions()` 흐름으로 권한 확인.
- **Browser**: `@capacitor/browser` — OAuth 시 Chrome Custom Tab으로 인앱 브라우저 열기
- **Filesystem**: `@capacitor/filesystem` — 음악 다운로드 시 기기 Download/Documents 폴더에 직접 저장 (실패 시 URL 공유/복사 폴백)
- **Android 빌드**: 로컬에서 `git pull` → `pnpm install` → `pnpm --filter web build` → `npx cap sync android` → Android Studio 빌드

## UI Conventions

- **Brown buttons**: ALL use `rounded-full`. Main colors: `#4A2C1A` / `#665146`
- **Animations**: Page fade-in, tab bounce, calendar cell tap, menu item tap, staggered slide-up
- All animations respect `prefers-reduced-motion: reduce`

## User Account Management

- **Soft Delete (탈퇴)**: `softDeleteUser` sets `deletedAt` + `isActive = false`; data retained for 1 year
- **Re-registration Block**: 탈퇴 후 1년간 동일 이메일 재가입 차단; 1년 경과 시 데이터 자동 삭제 후 재가입 허용
- **Auto Purge**: `node-cron` 매일 03:00에 1년 경과 탈퇴 유저 완전 삭제

## Deployment

Configured for autoscale deployment:
- Build: `pnpm --filter web build`
- Run: `pnpm start`
- 프로덕션에서 Express 서버가 프론트엔드 빌드 파일(`apps/web/dist`)도 함께 서빙
