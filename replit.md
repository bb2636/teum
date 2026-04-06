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
- 가사 생성 시 일기 원문 재구성 (직접 인용 금지), 한국어 쉼표 맞춤법 준수
- 부정적 내용도 희망적으로 승화
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

### 6. Payments (NicePay)
- NicePay JS SDK 연동 (신용/체크카드)
- **빌링키(Billing Key) 기반 자동결제**:
  - `POST /api/payments/billing/init` → NicePay `subscribe` method로 빌링키 등록
  - `POST /api/payments/nicepay/billing-return` → 빌링키 승인 + 첫 결제 자동 처리
  - `billing_keys` 테이블에 빌링키 저장 (bid, cardCode, cardName, cardNo, status)
  - 자동 갱신 스케줄러: 매시간 만료된 구독 확인 → 빌링키로 자동 결제 → 새 구독 생성
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

### 7. Push Notifications (Firebase FCM)
- 음악 생성 완료, 관리자 문의 답변 시 자동 발송
- `@capacitor/push-notifications` (프론트) + `firebase-admin` SDK (서버)
- 디바이스 토큰 등록/해제: `POST /api/push/register`, `POST /api/push/unregister`
- DB: `device_tokens` 테이블 (userId, token, platform)

### 8. SMS Verification (Solapi)
- 회원가입/비밀번호 재설정 시 전화번호 인증 문자 발송
- HMAC-SHA256 인증, 인증번호 5분 유효, 5회 오류 시 1시간 잠금

### 9. Email (Resend)
- 회원가입/비밀번호 재설정 시 이메일 인증번호 발송
- teum 브랜드 HTML 템플릿
- `RESEND_API_KEY` 미설정 시 nodemailer 폴백

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

## Security Features

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
- `gcTime: 1000*60*30` (30분, queryClient 기본) / 개별 훅은 `1000*60*60` (1시간)
- 서버: 모든 `/api/` 응답에 `Cache-Control: no-store` 설정 (WebView HTTP 캐시 방지)
- 데이터 갱신은 mutation의 `onSuccess`에서 `invalidateQueries()`로 처리 (CQRS 패턴)
- 사용자 프로필 쿼리 키: `['user', 'me']` — 결제/구독 훅에서도 동일 키 사용 필수
- 계정 전환 시: `forceFullCacheClear()` → `cancelQueries()` + `clear()` + `removeQueries()` + `localStorage.clear()`
- `onUserChanged(userId)`: `/users/me` 응답 시 이전 userId와 다르면 자동 캐시 전체 초기화

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
- `BACKEND_URL` - NicePay returnUrl 생성용 백엔드 URL
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
