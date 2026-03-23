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
- **Re-registration Block**: `findByEmailIncludingDeleted` checks all users including withdrawn; signup, email check, and email verification all reject withdrawn emails with "탈퇴한 계정" message
- **Admin User List**: Shows all users including withdrawn; `status` field: `active` / `suspended` / `withdrawn`; withdrawn users have disabled status dropdown
- **Subscription Grace Period**: Cancelled subscriptions remain active until `endDate`; `getEffectiveSubscription` helper in `usePayment.ts`

## Deployment

Configured for autoscale deployment:
- Build: `pnpm --filter web build`
- Run: `pnpm start` (내부적으로 `tsx`로 서버 TypeScript 소스를 직접 실행)

프로덕션에서 Express 서버가 프론트엔드 빌드 파일(`apps/web/dist`)도 함께 서빙합니다.
