# Teum - Personal Diary & Emotional Tracking Platform

## Project Overview

Teum is a mobile-optimized web application where users can write personal diaries, organize them into folders, track emotions on a calendar view, and generate AI-powered music tracks based on their diary content.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand
- **Backend**: Node.js + Express, TypeScript, Drizzle ORM
- **Database**: PostgreSQL (외부 Neon DB)
- **Package Manager**: pnpm (monorepo with workspaces)

## Project Structure

```
teum/
├── apps/
│   ├── web/          # React frontend (Vite, port 5000)
│   └── server/       # Express backend (port 3001)
├── packages/         # Shared packages (reserved)
├── package.json      # Root workspace config
└── pnpm-workspace.yaml
```

## Development

- **Frontend**: runs on port 5000 (workflow: "Start application")
- **Backend**: runs on port 3001 (workflow: "Backend")
- API requests from frontend are proxied from `/api` to `http://localhost:3001`

## Data Caching Strategy

- 모든 주요 쿼리에 `staleTime: Infinity` 적용 — 탭 이동 시 캐시 데이터를 즉시 표시하고 네트워크 요청 없음
- 데이터 갱신은 mutation의 `onSuccess`에서 `invalidateQueries()`로 처리 (CQRS 패턴)
- 각 mutation은 관련된 모든 쿼리 키를 정확히 invalidate해야 함 (예: 일기 삭제 시 `['diaries']`, `['diaries', 'calendar']`, `['folders']` 모두 invalidate)
- 사용자 프로필 쿼리 키: `['user', 'me']` — 결제/구독 훅에서도 동일 키 사용 필수

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `JWT_SECRET` - JWT signing secret for auth
- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` - Replit AI Integrations for OpenAI access (primary)
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` - Legacy fallback for OpenAI API access
- `MUREKA_API_KEY` - For AI music generation
- `CORS_ORIGIN` / `FRONTEND_URL` - Frontend URL for CORS (defaults to localhost:3000)
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID (server)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth Client ID (frontend)
- `VITE_APPLE_CLIENT_ID` - Apple Sign In Service ID (frontend)
- `VITE_APPLE_REDIRECT_URI` - Apple Sign In redirect URI (frontend)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase 서비스 계정 JSON (서버 푸시 알림 발송용; Replit Secrets에만 저장)
- `NICEPAY_MERCHANT_ID` - NicePay 상점 ID (clientId); 샌드박스=`S2_...`, 운영=`R2_...`
- `NICEPAY_API_SECRET` - NicePay API Secret Key
- `NICEPAY_TEST_MODE` - `TRUE`면 sandbox API 사용; `S2_` 키와 반드시 함께 사용
- `PAYMENT_MOCK_SUCCESS` - `true`면 실제 NicePay 호출 없이 DB만 저장 (테스트용)
- `BACKEND_URL` - NicePay returnUrl 생성용 백엔드 URL (미설정 시 FRONTEND_URL 사용)
- `SOLAPI_API_KEY` - 솔라피 API Key (SMS 문자 발송)
- `SOLAPI_API_SECRET` - 솔라피 API Secret
- `SOLAPI_SENDER_NUMBER` - 솔라피 발신번호 (하이픈 없이, 예: 01012345678)
- `RESEND_API_KEY` - Resend API Key (이메일 발송)
- `RESEND_FROM_EMAIL` - Resend 발신 이메일 주소 (미설정 시 `onboarding@resend.dev`)

## Key Features

1. **Diary Management**: Rich text entries organized into folders; floating format toolbar (bold/italic/underline/list/color); toolbar follows keyboard on mobile
2. **Calendar View**: Track entries and emotions on a calendar; same-folder entries grouped with count display
3. **AI Feedback**: OpenAI-generated encouraging messages (content 변경 시에만 재생성); AI 일기 요약 (2-3문장, 담담한 톤); "AI와 대화하기" 버튼 (개발 중)
4. **AI Music**: Mureka API generates custom music from diary content; 가사 생성 시 일기 원문 재구성 (직접 인용 금지); 부정적 내용도 희망적으로 승화; 음악 상세 페이지에서 곡 정보 확인 및 다운로드; 실제 오디오 메타데이터에서 곡 길이 표시; on quota/rate-limit failure, saves AI-generated lyrics with `lyrics_only` status
5. **Free User Restrictions**: 무료유저 폴더 최대 2개 제한 (초과 시 구독 유도 팝업); 4번째 일기부터 광고 시청 후 저장 (AdModal 5초 카운트다운)
6. **Gamification**: Daily random questions to prompt writing
7. **Admin Panel**: Manage users, diaries, questions, and legal terms
8. **Payments**: NicePay JS SDK 연동 (신용/체크카드, 계좌이체, 휴대폰 결제); 결제 세션 DB 영구 저장(`payment_sessions` 테이블, 30분 TTL 자동 정리); `PAYMENT_MOCK_SUCCESS=true`로 테스트 모드 지원; 결제 실패 페이지(`/payment/fail`); 결제 성공 후 가이드 페이지(`/payment/success`)
9. **Push Notifications**: Firebase FCM을 통한 푸시 알림 (음악 완성, 문의 답변 시 자동 발송)
10. **SMS (Solapi)**: 회원가입/비밀번호 재설정 시 전화번호 인증 문자 발송; HMAC-SHA256 인증; 인증번호 5분 유효, 5회 오류 시 1시간 잠금
11. **Email (Resend)**: 회원가입/비밀번호 재설정 시 이메일 인증번호 발송; 비밀번호 재설정 링크 이메일; teum 브랜드 HTML 템플릿; RESEND_API_KEY 미설정 시 nodemailer 폴백
12. **Android APK**: Capacitor 래핑; 배포 서버 URL로 직접 로드; CORS/쿠키 Capacitor 호환

## Internationalization (i18n)

- **Languages**: Korean (ko), English (en) — 국가 선택에 따라 전환 (KR→한국어, US/IN/CA/GB→영어)
- **Architecture**: `LanguageContext` (React Context) → `useT()` hook → `t('key')` function
- **Files**: `apps/web/src/lib/i18n.ts` (ko/en translation data), `apps/web/src/contexts/LanguageContext.tsx`, `apps/web/src/hooks/useTranslation.ts`
- **Language Detection**: 프로필 편집에서 국가 선택 즉시 언어 전환 (저장 전에도 즉시 반영)
- **Applied Pages**: SplashPage, LoginPage, HomePage, MyPage, ProfileEditPage, SupportPage, BottomTabBar
- **Rules**: Never import `setLanguageFromCountry` directly from `i18n.ts` — always use the Context version via `useLanguage()`

## Auth Session Management

- **Login cache safety**: All login hooks (`useLogin`, `useGoogleLogin`, `useAppleLogin`) clear query cache via `queryClient.getQueryCache().clear()` in `onMutate` (before API call) and `onSuccess` (after API call) to prevent cross-account data leaking
- **Server-side**: Login endpoints (`/auth/login`, `/auth/google/login`, `/auth/apple/login`) clear existing cookies before setting new ones
- **Logout**: `useLogout` clears both query and mutation caches via `queryClient.clear()` before navigating to splash

## UI Animations

Custom CSS animations defined in `apps/web/src/styles/globals.css`:
- **Page fade-in**: `animate-page-in` — subtle fade + slide-up on route changes (keyed on `location.pathname` in `providers.tsx`)
- **Tab bounce**: `animate-tab-bounce` — active tab icon bounces on navigation (all tabs including profile)
- **Calendar cell tap**: `calendar-cell-tap` — scale-down on `:active` for date cells
- **Menu item tap**: `menu-item-tap` — press feedback on MyPage menu buttons
- **Staggered slide-up**: `animate-slide-up` with per-item `animationDelay` on music cards
- All animations respect `prefers-reduced-motion: reduce`

## Database

Uses Drizzle ORM with PostgreSQL. Run migrations with:
```
pnpm --filter server db:migrate
```

## User Account Management

- **Soft Delete (탈퇴)**: `softDeleteUser` sets `deletedAt` + `isActive = false`; data retained for 1 year
- **Re-registration Block**: 탈퇴 후 1년간 동일 이메일 재가입 차단; 1년 경과 시 데이터 자동 삭제 후 재가입 허용
- **Auto Purge**: `node-cron` 스케줄러가 매일 03:00에 1년 경과 탈퇴 유저 데이터 완전 삭제 (`apps/server/src/jobs/cleanup-withdrawn-users.ts`); DB cascade로 관련 데이터 일괄 삭제
- **Admin User List**: Shows all users including withdrawn; `status` field: `active` / `suspended` / `withdrawn`; withdrawn users have disabled status dropdown
- **Admin Subscription Cancel**: `/api/payments/admin/subscriptions/cancel` 관리자 전용 구독 취소 엔드포인트
- **Subscription Grace Period**: Cancelled subscriptions remain active until `endDate`; `getEffectiveSubscription` helper in `usePayment.ts`

## Social Login (OAuth)

- **Google Login**: Google Identity Services (GSI) - ID token 방식; 서버에서 `google-auth-library`로 토큰 검증; 신규 유저는 `/social-onboarding`으로 리다이렉트
- **Apple Login**: Apple Sign In JS SDK - ID token 디코딩; 이메일 숨김(privaterelay) 시 직접 이메일 입력 + 이메일 인증 필요
- **Social Onboarding** (`/social-onboarding`): 소셜 로그인 후 신규 유저 추가 정보 입력 (닉네임, 이름, 생년월일, 약관 동의)
- **Auth Accounts**: `auth_accounts` 테이블에 provider별 계정 연결 (email/google/apple)
- **Endpoints**: `POST /api/auth/google/login`, `POST /api/auth/apple/login`, `POST /api/auth/social/onboarding`

## Capacitor (Android/iOS)

- **Config**: `apps/web/capacitor.config.ts` - appId: `com.teum.app`
- **Server URL**: APK는 `server.url: 'https://teum.replit.app'`으로 배포 서버에서 직접 콘텐츠 로드 (로컬 dist 사용 안 함)
- **PWA Manifest**: `apps/web/public/manifest.json`
- **CORS**: Capacitor origin (`capacitor://localhost`, `https://localhost`) 허용; 비허용 origin은 차단
- **쿠키**: 프로덕션 환경에서 `sameSite: 'none'` + `secure: true` (Capacitor WebView 호환)
- **Push Notifications**: Firebase Cloud Messaging (FCM) 사용
  - Android: `google-services.json` + Firebase BoM 34.11.0 + firebase-messaging (Gradle)
  - 프론트: `@capacitor/push-notifications` → 권한 요청 → 리스너 등록 → `register()` 순서
  - 서버: `firebase-admin` SDK → `pushNotificationService.sendToUser()`
  - 디바이스 토큰 등록: `POST /api/push/register` (token, platform)
  - 디바이스 토큰 해제: `POST /api/push/unregister`
  - 트리거: 관리자 문의 답변 시, 음악 생성 완료 시 자동 발송
  - DB: `device_tokens` 테이블 (userId, token, platform)
- **Camera**: `@capacitor/camera` 사용, 네이티브에서는 Capacitor Camera, 웹에서는 file input 자동 감지
- **필요 환경변수**: `FIREBASE_SERVICE_ACCOUNT` (Firebase 서비스 계정 JSON — Replit Secrets에만 저장, .replit 파일에 절대 포함 금지)
- **Android 빌드**: 로컬에서 `git pull` → `pnpm install` → `pnpm --filter web build` → `npx cap sync android` → Android Studio 빌드

## Deployment

Configured for autoscale deployment:
- Build: `pnpm --filter web build`
- Run: `pnpm start` (내부적으로 `tsx`로 서버 TypeScript 소스를 직접 실행)

프로덕션에서 Express 서버가 프론트엔드 빌드 파일(`apps/web/dist`)도 함께 서빙합니다.
