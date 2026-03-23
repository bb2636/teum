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

## Key Features

1. **Diary Management**: Rich text entries organized into folders
2. **Calendar View**: Track entries and emotions on a calendar
3. **AI Feedback**: OpenAI-generated encouraging messages
4. **AI Music**: Mureka API generates custom music from diary content; on quota/rate-limit failure, saves AI-generated lyrics with `lyrics_only` status (Melon-style popup, download disabled, "담기" enabled)
5. **Gamification**: Daily random questions to prompt writing
6. **Admin Panel**: Manage users, diaries, questions, and legal terms
7. **Payments**: Nice Payments integration for subscriptions

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
- **PWA Manifest**: `apps/web/public/manifest.json`
- **Push Notifications**: Firebase Cloud Messaging (FCM) 사용
  - 서버: `firebase-admin` SDK → `pushNotificationService.sendToUser()`
  - 디바이스 토큰 등록: `POST /api/push/register` (token, platform)
  - 디바이스 토큰 해제: `POST /api/push/unregister`
  - 트리거: 관리자 문의 답변 시, 음악 생성 완료 시 자동 발송
  - DB: `device_tokens` 테이블 (userId, token, platform)
- **Camera**: `@capacitor/camera` 사용, 네이티브에서는 Capacitor Camera, 웹에서는 file input 자동 감지
- **필요 환경변수**: `FIREBASE_SERVICE_ACCOUNT` (Firebase 서비스 계정 JSON)
- **Android 빌드**: 로컬에서 `npx cap add android` → Android Studio로 빌드

## Deployment

Configured for autoscale deployment:
- Build: `pnpm --filter web build`
- Run: `pnpm start` (내부적으로 `tsx`로 서버 TypeScript 소스를 직접 실행)

프로덕션에서 Express 서버가 프론트엔드 빌드 파일(`apps/web/dist`)도 함께 서빙합니다.
