# teum - 기록이 곧, 당신만의 트랙이 됩니다

감정 기록 서비스로, 폴더 단위로 일기를 작성하고, 캘린더에서 기록을 관리하며, 선택한 일기들을 기반으로 음악을 생성할 수 있습니다.

## 기술 스택

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **State Management**: Zustand + TanStack Query
- **UI**: Tailwind CSS + shadcn/ui
- **Forms**: React Hook Form + Zod
- **AI**: OpenAI API (GPT-4o-mini)
- **Music Generation**: Stable Audio API
- **Payment**: Nice Payments (나이스페이먼츠)
- **Package Manager**: pnpm

## AI 기능

### 일기 응원 메시지 (Encouragement Message)

일기를 작성하거나 수정하면, GPT가 일기 내용을 읽고 따뜻하고 공감적인 응원 메시지를 자동으로 생성합니다.

**동작 방식:**
1. 사용자가 일기를 저장하면, 일기가 먼저 데이터베이스에 저장됩니다
2. 백그라운드에서 OpenAI API를 호출하여 응원 메시지를 생성합니다
3. 생성된 메시지는 `ai_feedback` 테이블에 저장되고, `diaries.ai_message` 필드에도 업데이트됩니다
4. AI 생성이 실패해도 일기 저장은 정상적으로 완료됩니다 (non-blocking)

**특징:**
- 요약이 아닌 감정적 공감 메시지
- 한 문장으로 간결하게 작성
- 따뜻하고 차분한 톤
- 한국어 출력

**환경 변수:**
- `OPENAI_API_KEY`: OpenAI API 키 ([발급 방법](apps/server/API_KEYS_SETUP.md#openai-api-키-발급))
- `OPENAI_MODEL_TEXT`: 사용할 모델 (기본값: gpt-4o-mini)
- `AI_ENCOURAGEMENT_ENABLED`: 기능 활성화 여부 (기본값: true)

### 음악 생성 (Music Generation)

사용자가 정확히 7개의 일기를 선택하면, AI가 일기들을 분석하여 음악을 생성합니다.

**동작 방식:**
1. 사용자가 7개의 일기를 선택하고 음악 생성 요청
2. GPT가 7개 일기를 종합 분석하여:
   - 전체 감정 (overall_emotion)
   - 분위기 (mood)
   - 키워드 (keywords)
   - 가사 테마 (lyrical_theme)
   - 완성된 가사 (lyrics)
   - 음악 생성 프롬프트 (music_prompt) - 영어
3. Stable Audio API를 호출하여 실제 음악 생성
4. 결과를 `music_jobs` 테이블에 저장하고 반환

**API 엔드포인트:**
```
POST /api/music/generate
Body: {
  "diaryIds": ["uuid1", "uuid2", ..., "uuid7"]
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "completed",
    "overallEmotion": "nostalgic healing",
    "mood": "warm, reflective, slightly hopeful",
    "keywords": ["growth", "memory", "healing"],
    "lyricalTheme": "회복과 성장의 이야기",
    "lyrics": "완성된 가사...",
    "musicPrompt": "warm reflective piano pop...",
    "audioUrl": "https://..."
  }
}
```

**환경 변수:**
- `STABLE_AUDIO_API_KEY`: Stable Audio API 키 ([발급 방법](apps/server/API_KEYS_SETUP.md#stable-audio-api-키-발급))
- `STABLE_AUDIO_BASE_URL`: Stable Audio API 베이스 URL
- `AI_MUSIC_ENABLED`: 기능 활성화 여부 (기본값: true)

**상세 가이드:** [API 키 발급 가이드](apps/server/API_KEYS_SETUP.md)

**음악 작업 상태 조회:**
```
GET /api/music/jobs/:id
```

**비동기 작업 처리:**
- Stable Audio API가 비동기 작업을 반환하는 경우 자동으로 폴링
- 웹훅 지원: `POST /api/music/webhook/:jobId` (프로덕션 환경에서 사용)
- 작업 상태는 실시간으로 폴링하여 확인 가능

**큐 시스템 (선택적):**
- 환경 변수 `MUSIC_QUEUE_ENABLED=true`로 활성화 가능
- 백그라운드에서 순차적으로 음악 생성 작업 처리
- 대량 요청 시 서버 부하 분산

**환경 변수 (추가):**
- `MUSIC_QUEUE_ENABLED`: 큐 시스템 활성화 (기본값: false)
- `MUSIC_QUEUE_INTERVAL_MS`: 큐 폴링 간격 (기본값: 5000ms)
- `WEBHOOK_BASE_URL`: 웹훅 수신 URL (비동기 작업 완료 알림용)

**참고:**
- Stable Audio API의 실제 응답 구조에 따라 구현이 조정될 수 있음
- 동기/비동기 모드 모두 지원

## 질문기록 기능

관리자가 등록한 질문 중에서 사용자별로 최근 7일간 사용하지 않은 질문을 랜덤으로 3개 제공합니다.

**동작 방식:**
1. 사용자가 질문기록 작성 시 자동으로 랜덤 질문 3개 조회
2. 최근 7일간 사용한 질문은 자동으로 제외
3. 질문이 부족한 경우 모든 활성 질문에서 선택
4. 일기 저장 시 질문 사용 이력 자동 기록

**API 엔드포인트:**
```
GET /api/questions/random?count=3
```

**관리자 질문 관리 API:**
```
GET    /api/questions          # 모든 질문 조회
GET    /api/questions/:id      # 특정 질문 조회
POST   /api/questions          # 질문 생성
PUT    /api/questions/:id      # 질문 수정
DELETE /api/questions/:id     # 질문 삭제
PUT    /api/questions/order    # 질문 순서 변경
```

**특징:**
- 질문 세트 없이 독립적인 질문 관리
- 사용자별 질문 사용 이력 추적 (`user_question_history`)
- 중복 방지: 최근 7일간 사용한 질문 제외
- 관리자 권한 필요 (질문 생성/수정/삭제)
- 질문 순서 변경 지원 (드래그 앤 드롭, 길게 누르기)
- 순서대로 상위 3개 질문이 사용자에게 표시됨

## 이미지 업로드

일기 작성 시 이미지를 첨부할 수 있습니다.

**API 엔드포인트:**
```
POST /api/upload/image
Content-Type: multipart/form-data
Body: {
  image: File
}
```

**제한사항:**
- 파일 크기: 최대 5MB
- 파일 타입: 이미지 파일만 허용
- 인증: 로그인 필요

**스토리지 어댑터:**
- 기본: 메모리 스토리지 (개발용)
- CDN: 환경 변수 `STORAGE_ADAPTER=cdn`으로 전환 가능
  - `CDN_URL`: CDN 베이스 URL
  - `CDN_BUCKET_NAME`: 버킷 이름
  - `CDN_ACCESS_KEY_ID`: 접근 키
  - `CDN_SECRET_ACCESS_KEY`: 시크릿 키

## 비밀번호 재설정

이메일 기반 토큰을 사용한 비밀번호 재설정 기능입니다.

**API 엔드포인트:**
```
POST /api/password-reset/request
Body: {
  "email": "user@example.com"
}

POST /api/password-reset/reset
Body: {
  "token": "reset-token",
  "password": "new-password"
}
```

**동작 방식:**
1. 사용자가 이메일 입력
2. 서버에서 재설정 토큰 생성 (1시간 유효)
3. 개발 모드에서는 토큰을 응답에 포함 (프로덕션에서는 이메일 발송)
4. 토큰으로 새 비밀번호 설정

**이메일 발송:**
- 프로덕션 환경에서는 자동으로 이메일 발송
- 개발 환경에서는 `EMAIL_ENABLED=false`로 설정 시 토큰을 응답에 포함
- 환경 변수 설정: [이메일 설정 가이드](apps/server/EMAIL_SETUP.md)

**참고:**
- 토큰은 1시간 후 만료
- 한 번 사용된 토큰은 재사용 불가

## 마이페이지

사용자 프로필 관리 및 서비스 이용 내역을 확인할 수 있습니다.

**기능:**
- 프로필 편집 (닉네임, 이름, 전화번호, 생년월일, 국가)
- 결제 내역 조회
- 구독 내역 조회
- 고객지원 1:1 문의 작성 및 조회
- 서비스 이용약관 및 개인정보 처리방침 보기

**API 엔드포인트:**
```
GET  /api/users/me              # 현재 사용자 정보
PUT  /api/users/profile         # 프로필 수정
GET  /api/payments              # 결제 내역
GET  /api/payments/subscriptions # 구독 내역
POST /api/support               # 문의 작성
GET  /api/support               # 문의 목록
GET  /api/support/:id           # 문의 상세
GET  /api/terms/service         # 서비스 이용약관
GET  /api/terms/privacy         # 개인정보 처리방침
```

## 약관 관리

관리자가 서비스 이용약관과 개인정보 처리방침을 관리할 수 있습니다.

**기능:**
- 서비스 이용약관/개인정보 처리방침 분리 관리
- 버전 관리 (v1.0, v1.1 등)
- 수동 저장 시 버전 증가
- 자동 저장 (10초 후 마지막 입력 기준, 버전 변경 없음)
- 최종 수정일 표시

**API 엔드포인트 (관리자):**
```
GET /api/terms/admin/service    # 서비스 이용약관 조회
GET /api/terms/admin/privacy    # 개인정보 처리방침 조회
PUT /api/terms/admin/service    # 서비스 이용약관 수정
PUT /api/terms/admin/privacy    # 개인정보 처리방침 수정
```

**특징:**
- 약관 타입별 독립적인 버전 관리
- 수동 저장 시 버전 자동 증가 (v1.0 → v1.1)
- 자동 저장은 버전 변경 없이 내용만 업데이트
- 저장 시간 및 버전 정보 표시

## API 엔드포인트 목록

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `POST /api/auth/refresh` - 토큰 갱신
- `POST /api/auth/verify-phone` - 휴대폰 인증번호 확인

### 사용자
- `GET /api/users/me` - 현재 사용자 정보
- `PUT /api/users/profile` - 프로필 수정
- `DELETE /api/users/account` - 계정 삭제
- `GET /api/users/check-nickname` - 닉네임 중복 확인
- `GET /api/users/all` - 모든 사용자 조회 (관리자)
- `GET /api/users/:userId/payments` - 사용자 결제 내역 (관리자)
- `GET /api/users/:userId/subscriptions` - 사용자 구독 내역 (관리자)
- `DELETE /api/users/:userId` - 사용자 삭제 (관리자)

### 일기
- `GET /api/diaries` - 일기 목록
- `GET /api/diaries/:id` - 일기 상세
- `POST /api/diaries` - 일기 생성
- `PATCH /api/diaries/:id` - 일기 수정
- `DELETE /api/diaries/:id` - 일기 삭제
- `GET /api/diaries/calendar` - 캘린더 일기 조회
- `GET /api/diaries/all` - 모든 일기 조회 (관리자)

### 폴더
- `GET /api/folders` - 폴더 목록
- `POST /api/folders` - 폴더 생성
- `PATCH /api/folders/:id` - 폴더 수정
- `DELETE /api/folders/:id` - 폴더 삭제

### 질문
- `GET /api/questions/random` - 랜덤 질문 조회 (사용자)
- `GET /api/questions` - 모든 질문 조회 (관리자)
- `GET /api/questions/:id` - 질문 상세 (관리자)
- `POST /api/questions` - 질문 생성 (관리자)
- `PUT /api/questions/:id` - 질문 수정 (관리자)
- `DELETE /api/questions/:id` - 질문 삭제 (관리자)
- `PUT /api/questions/order` - 질문 순서 변경 (관리자)

### 업로드
- `POST /api/upload/image` - 이미지 업로드

### 음악
- `POST /api/music/generate` - 음악 생성
- `GET /api/music/jobs/:id` - 음악 작업 상태 조회
- `POST /api/music/webhook/:jobId` - 음악 생성 완료 웹훅 (프로바이더용)

### 결제
- `POST /api/payments/process` - 결제 처리
- `GET /api/payments` - 결제 내역
- `GET /api/payments/subscriptions` - 구독 내역

### 고객지원
- `POST /api/support` - 문의 작성 (사용자)
- `GET /api/support` - 문의 목록 (사용자)
- `GET /api/support/:id` - 문의 상세 (사용자)
- `GET /api/support/admin/all` - 모든 문의 목록 (관리자)
- `GET /api/support/admin/:id` - 문의 상세 (관리자)
- `PUT /api/support/admin/:id/answer` - 문의 답변 등록 (관리자)

### 약관
- `GET /api/terms/service` - 서비스 이용약관 (공개)
- `GET /api/terms/privacy` - 개인정보 처리방침 (공개)
- `GET /api/terms/admin/service` - 서비스 이용약관 조회 (관리자)
- `GET /api/terms/admin/privacy` - 개인정보 처리방침 조회 (관리자)
- `PUT /api/terms/admin/service` - 서비스 이용약관 수정 (관리자)
- `PUT /api/terms/admin/privacy` - 개인정보 처리방침 수정 (관리자)

### 비밀번호 재설정
- `POST /api/password-reset/request` - 재설정 요청
- `POST /api/password-reset/reset` - 비밀번호 재설정

## 프로젝트 구조

```
teum/
├── apps/
│   ├── web/          # React 프론트엔드
│   └── server/       # Express 백엔드
│       ├── src/
│       │   ├── controllers/  # 컨트롤러
│       │   ├── services/     # 비즈니스 로직
│       │   ├── repositories/ # 데이터 접근
│       │   ├── routes/       # 라우트 정의
│       │   ├── db/           # 데이터베이스 스키마
│       │   └── middleware/   # 미들웨어
│       └── drizzle/          # 마이그레이션 파일
├── packages/
│   ├── ui/           # 공유 UI 컴포넌트
│   ├── config/       # 공유 설정
│   └── types/         # 공유 타입
└── pnpm-workspace.yaml
```

## 시작하기

### 사전 요구사항

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL (또는 NeonDB)

### 설치

```bash
# 의존성 설치
pnpm install
```

### 환경 변수 설정

```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env

# .env 파일을 편집하여 필요한 값 설정
```

### 개발 서버 실행

```bash
# 프론트엔드와 백엔드 동시 실행
pnpm dev

# 또는 개별 실행
pnpm dev:web      # 프론트엔드만 (http://localhost:3000)
pnpm dev:server   # 백엔드만 (http://localhost:4000)
```

## 데이터베이스

### 마이그레이션

```bash
# 마이그레이션 생성
pnpm --filter server db:generate

# 마이그레이션 실행
pnpm --filter server db:migrate

# 스키마 푸시 (개발용)
pnpm --filter server db:push

# 시드 데이터 삽입
pnpm --filter server db:seed
```

### 시드 데이터

시드 스크립트는 다음 테스트 계정을 생성합니다:
- **Admin**: `admin@teum.com` / `admin1234`
- **Test User**: `test@test.com` / `test1234`

### 마이그레이션 파일

주요 마이그레이션:
- `0000_oval_malice.sql` - 초기 스키마
- `0001_update_ai_feedback.sql` - AI 피드백 테이블 업데이트
- `0002_create_password_reset_tokens.sql` - 비밀번호 재설정 토큰 테이블
- `0003_create_questions_and_history.sql` - 질문 및 사용 이력 테이블
- `0004_add_performance_indexes.sql` - 성능 최적화 인덱스 추가
- `0005_add_question_order.sql` - 질문 순서 컬럼 추가
- `0006_create_terms.sql` - 약관 관리 테이블

**성능 인덱스:**
- 사용자, 일기, 음악 작업, 질문 이력, 고객지원, 결제 등 주요 쿼리 필드에 인덱스 추가
- 복합 인덱스로 조회 성능 향상

## 주요 기능

### 사용자 기능
- ✅ 회원가입/로그인 (이메일, 휴대폰 인증)
- ✅ 비밀번호 재설정 (이메일 기반 토큰)
- ✅ 폴더 단위 일기 관리
- ✅ 캘린더 뷰 (월별 조회, 날짜별 일기 슬라이드, 월 선택 모달)
- ✅ 자유작성 일기 (리치 텍스트 에디터)
  - 텍스트 스타일 (제목, 머리말, 부머리말, 본문, 모노 스타)
  - 텍스트 포맷 (볼드, 이탤릭, 밑줄, 취소선)
  - 리스트 포맷 (번호 목록, 글머리표)
  - 텍스트 색상 변경 (70색 팔레트)
  - 배경 이미지 지원
- ✅ 질문기록 (랜덤 질문 3개, 최근 7일 중복 제외)
- ✅ 이미지 업로드 (일기 첨부)
- ✅ AI 응원 메시지 (자동 생성)
- ✅ 음악 생성 (7개 일기 기반)
- ✅ 음악 작업 상태 조회 및 결과 확인
- ✅ 마이페이지
  - 프로필 편집
  - 결제 내역 조회
  - 구독 내역 조회
  - 고객지원 1:1 문의
  - 약관 보기

### UI/UX 기능
- ✅ 스플래시 화면
- ✅ 반응형 모바일 디자인
- ✅ Pretendard 폰트 적용
- ✅ 하단 탭 바 (홈, 캘린더, 음악 생성, 프로필)
- ✅ 폴더별 일기 필터링
- ✅ 일기 작성 시 폴더 선택/생성
- ✅ 일기 작성 중 나가기 확인 모달
- ✅ 스크롤/줌 방지 (모바일 최적화)

### 관리자 기능
- ✅ 질문 관리
  - 질문 생성, 수정, 삭제
  - 질문 순서 변경 (드래그 앤 드롭, 길게 누르기)
  - 순서대로 상위 3개 질문이 사용자에게 표시
- ✅ 사용자 관리
  - 전체 사용자 목록 조회
  - 사용자 상세 정보 (프로필, 결제 내역, 구독 내역)
  - 사용자 상태 변경 (활성화/정지)
  - 사용자 삭제 (소프트 삭제)
- ✅ 일기 관리
  - 전체 일기 목록 조회
  - 일기 타입별 필터링 (전체, 자유형식, 문답형식)
  - 일기 상세 조회
- ✅ 고객센터 관리
  - 문의 목록 조회 (전체, 답변 대기, 답변 완료)
  - 문의 상세 조회
  - 문의 답변 등록 (자동 상태 변경)
- ✅ 약관 관리
  - 서비스 이용약관 관리
  - 개인정보 처리방침 관리
  - 버전 관리 (수동 저장 시 버전 증가)
  - 자동 저장 (10초 후 자동 저장, 버전 변경 없음)

### 결제 기능
- ✅ Nice Payments 연동
- ✅ 구독 관리
- ✅ 결제 내역 관리

## 테스트

### 테스트 실행

```bash
# 단위 테스트 실행
pnpm --filter server test

# 테스트 UI 실행
pnpm --filter server test:ui

# 커버리지 리포트 생성
pnpm --filter server test:coverage
```

### 테스트 커버리지

현재 다음 서비스에 대한 단위 테스트가 포함되어 있습니다:
- `EncouragementService` - AI 응원 메시지 생성
- `MusicOrchestratorService` - 음악 생성 오케스트레이션
- `generateMusicSchema` - 음악 생성 입력 검증

**향후 개선:**
- API 엔드포인트 통합 테스트
- E2E 테스트 추가

## 최근 업데이트

### 관리자 기능 개선 (2024)
- **질문 관리 탭**
  - 질문 목록 조회 (순서, 내용, 생성일)
  - 질문 생성/수정/삭제 (팝업 모달)
  - 질문 순서 변경 (드래그 앤 드롭, 길게 누르기 활성화)
  - 순서대로 상위 3개 질문이 사용자에게 표시
- **고객센터 탭**
  - 문의 목록 필터링 (전체, 답변 대기, 답변 완료)
  - 문의 상세 조회 (팝업 모달)
  - 관리자 답변 등록
  - 답변 등록 시 자동으로 상태 변경 (답변 완료)
  - 답변 전송 확인 및 완료 알림 팝업
- **약관 관리 탭**
  - 서비스 이용약관/개인정보 처리방침 분리 관리
  - 약관 타입별 카드 선택 (활성 상태 강조)
  - 최종 수정일 표시
  - 버전 관리 (v1.0, v1.1 등)
  - 수동 저장 시 버전 증가
  - 자동 저장 기능 (10초 후 마지막 입력 기준)
  - 자동 저장 시 버전 변경 없음, 저장 시간만 업데이트
- **사용자 관리 개선**
  - 사용자 목록에서 관리자 계정 필터링
  - 사용자 행 클릭 시 상세 정보 표시
  - 계정 상태 드롭다운 (활성됨/정지됨)
  - 사용자 삭제 확인 팝업 (이메일 표시)
- **일기 관리**
  - 일기 타입별 필터링 (전체, 자유형식, 문답형식)
  - 일기 카드 그리드 레이아웃
  - 일기 상세 조회 (팝업 모달)

### UI/UX 개선 (2024)
- 스플래시 화면 구현
- 로그인/회원가입 페이지 UI 개선 (버튼 상태별 스타일, 유효성 검사 에러 표시)
- 홈 화면 UI 개선 (로고, 폴더 목록, 빈 상태 이미지)
- 캘린더 UI 개선 (전체 화면, 날짜별 일기 슬라이드, 월 선택 모달, 스와이프 네비게이션)
- 일기 작성 페이지 리치 텍스트 에디터 구현
  - 포맷 메뉴 (슬라이드업 애니메이션)
  - 색상 선택기 (70색 팔레트, 자연스러운 그라데이션)
  - 텍스트 스타일 및 포맷 옵션
  - 선택한 텍스트에만 포맷 적용 (한글 문서 스타일)
  - 폰트 크기 조절 (10px-48px)
- 하단 탭 바 구현 (활성 탭 강조, 프로필 이미지 표시)
- Pretendard 폰트 적용
- 모바일 반응형 최적화 (스크롤/줌 방지)
- 관리자 페이지 웹 레이아웃 (모바일 스타일 제거)

### 성능 최적화
- 데이터베이스 인덱스 추가 (주요 쿼리 필드)
- 음악 생성 큐 시스템 (선택적 활성화)
- CDN 스토리지 어댑터 지원

## 라이선스

MIT
