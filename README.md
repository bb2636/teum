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
- **Music Generation**: Mureka API ([platform.mureka.ai](https://platform.mureka.ai/))
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

**참고:**
- OpenAI API는 결제 정보 연결이 필요합니다 (무료 크레딧 한도 초과 시)
- gpt-4o-mini 가격: 입력 $0.15/1M 토큰, 출력 $0.60/1M 토큰
- 일기 100건/일 기준 약 $0.10-0.20/일 예상 (내용 길이에 따라 다름)

### 음악 생성 (Music Generation)

**구독 필수**: 활성 구독 사용자만 음악 생성 가능. **월 5곡**, 1곡당 **최대 2분** 제한.

**동작 방식:**
1. 사용자가 **장르**를 선택하고, 일기 **전체/폴더별**에서 **7개** 선택 후 음악 생성 요청
2. GPT가 7개 일기를 종합 분석하여:
   - 노래 제목 (한국어 10자 이내, 영어 20자 이내)
   - 전체 감정, 분위기, 키워드, 가사 테마, 완성된 가사
   - 음악 생성 프롬프트 (영어, 약 2분·자연 마무리 포함)
3. Mureka API 호출 시 **선택한 장르**를 프롬프트 앞에 반영하고, "natural fade-out, complete phrases, no abrupt cut" 추가해 끊김 방지
4. 결과를 `music_jobs`에 저장 (재생 길이 최대 120초로 제한)

**장르 목록:**  
- 뮤레카 공식 장르 API가 없어, 서비스에서 스타일 목록을 `GET /api/music/genres`로 제공 (팝, 발라드, 록, 인디, 재즈 등 30여 종). 목록은 [MUREKA_SETUP.md](apps/server/MUREKA_SETUP.md) 및 `apps/server/src/services/music/mureka-styles.ts`에서 관리.

**API 엔드포인트:**
```
GET  /api/music/genres         # 장르/스타일 목록 (뮤레카 스타일 태그 + 한글 라벨)
GET  /api/music/jobs           # 내 음악 목록 + 월간 한도(monthlyUsed/monthlyLimit) + 다음 결제일(nextPaymentDate)
POST /api/music/generate       # 음악 생성 (diaryIds 7개 + genreTag 필수, 구독·한도 검사)
GET  /api/music/jobs/:id       # 음악 작업 상태·상세 (제목 한/영, 가사, 재생시간, sourceDiaryIds 등)
```

**음악 목록 및 상세 화면:**
- **내 음악 섹션**: 완성된 음악 카드에 노래 제목, 재생 시간, 해당 곡의 바탕이 된 일기 목록(최대 3개) 표시
  - 각 일기 항목: 썸네일 이미지, 일기 첫 줄, 날짜
  - 카드 클릭 시 음악 상세 페이지로 이동
- **음악 상세 페이지**: 멜론 스타일 UI로 다음 정보 표시
  - 노래 제목 (한국어/영어)
  - 곡 길이 (MM:SS 형식)
  - 가사
  - 이 곡의 바탕이 된 일기 목록 (전체 7개)
    - 각 일기 항목 클릭 시 해당 일기 상세 페이지로 이동
    - 일기 썸네일, 첫 줄, 날짜 표시

**POST /api/music/generate**  
- Body: `{ "diaryIds": ["uuid1", ..., "uuid7"], "genreTag": "pop" }`  
- `genreTag`: 장르 태그 (예: pop, ballad, jazz). `GET /api/music/genres` 응답의 `tag` 값 사용  
- 구독 없음 → 403 `SUBSCRIPTION_REQUIRED`  
- 월 5곡 초과 → 403 `MONTHLY_LIMIT_EXCEEDED`

**환경 변수:**
- `MUREKA_API_KEY`: Mureka API 키 ([발급 방법](apps/server/API_KEYS_SETUP.md#mureka-api-키-발급))
- `AI_MUSIC_ENABLED`: 음악 생성 활성화 (기본값: true)
- `MUSIC_QUEUE_ENABLED`: 큐 사용 시 true (기본값: false)
- `MUSIC_QUEUE_INTERVAL_MS`: 큐 폴링 간격 (기본값: 5000)
- `WEBHOOK_BASE_URL`: 웹훅 수신 URL (선택)

**참고:**
- Mureka API는 결제 정보 연결이 필요합니다 (무료 크레딧 한도 초과 시)
- 가격 정보는 [Mureka 대시보드](https://platform.mureka.ai/)에서 확인하세요

**가이드:**
- [API 키·환경 변수](apps/server/API_KEYS_SETUP.md)
- [Mureka API 사용법](apps/server/MUREKA_SETUP.md) (인증, POST/GET 요청, 곡 길이·끊김 방지)

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
POST /api/auth/email/request-for-password-reset  # 비밀번호 찾기용 이메일 인증 요청
Body: {
  "email": "user@example.com"
}

POST /api/auth/email/confirm                     # 이메일 인증 확인
Body: {
  "email": "user@example.com",
  "code": "123456"
}

POST /api/password-reset/request                 # 비밀번호 재설정 요청 (인증 완료 후)
Body: {
  "email": "user@example.com"
}

POST /api/password-reset/reset                  # 비밀번호 재설정
Body: {
  "token": "reset-token",
  "password": "new-password"
}
```

**동작 방식:**
1. 사용자가 이메일 입력
2. **이메일 존재 여부 확인**: DB에 존재하는 이메일인지 확인
   - 존재하지 않으면: "존재하지 않는 이메일입니다." 에러 반환
   - 존재하면: 이메일 인증번호 발송
3. 사용자가 인증번호 입력 및 확인
4. 인증 완료 후 비밀번호 재설정 요청
5. 서버에서 재설정 토큰 생성 (1시간 유효)
6. 개발 모드에서는 토큰을 응답에 포함 (프로덕션에서는 이메일 발송)
7. 토큰으로 새 비밀번호 설정

**이메일 인증:**
- 회원가입과 비밀번호 찾기의 이메일 인증 로직이 분리되어 있습니다
  - **회원가입용** (`/auth/email/request`): 이메일이 이미 존재하면 에러
  - **비밀번호 찾기용** (`/auth/email/request-for-password-reset`): 이메일이 존재하지 않으면 에러
- 인증번호는 10분간 유효
- 개발 모드에서는 인증번호를 응답에 포함

**이메일 발송:**
- 프로덕션 환경에서는 자동으로 이메일 발송
- 개발 환경에서는 `EMAIL_ENABLED=false`로 설정 시 토큰을 응답에 포함
- 환경 변수 설정: [이메일 설정 가이드](apps/server/EMAIL_SETUP.md)

**참고:**
- 토큰은 1시간 후 만료
- 한 번 사용된 토큰은 재사용 불가
- 비밀번호 재설정 요청 시 이메일이 존재하지 않으면 에러 반환

## 마이페이지

사용자 프로필 관리 및 서비스 이용 내역을 확인할 수 있습니다.

**기능:**
- 프로필 편집 (닉네임, 이름, 전화번호, 생년월일, 국가)
- 결제 내역 조회
- 구독 내역 조회
- 고객지원 1:1 문의 작성 및 조회 (문의 접수 시 확인 모달 표시)
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

관리자가 서비스 이용약관, 개인정보 처리방침, 정기결제/자동갱신, 환불/취소 정책을 관리할 수 있습니다.

**기능:**
- 서비스 이용약관/개인정보 처리방침/정기결제/자동갱신/환불/취소 정책 분리 관리
- 버전 관리 (v1.0, v1.1 등)
- 수동 저장 시 버전 증가
- 자동 저장 (10초 후 마지막 입력 기준, 버전 변경 없음)
- 최종 수정일 표시
- 결제 화면에서 약관 연동 (관리자가 입력한 약관 내용 표시)

**API 엔드포인트 (공개):**
```
GET /api/terms/service    # 서비스 이용약관 조회
GET /api/terms/privacy    # 개인정보 처리방침 조회
GET /api/terms/payment    # 정기결제/자동갱신 조회
GET /api/terms/refund     # 환불/취소 정책 조회
```

**API 엔드포인트 (관리자):**
```
GET /api/terms/admin/service    # 서비스 이용약관 조회
GET /api/terms/admin/privacy    # 개인정보 처리방침 조회
GET /api/terms/admin/payment    # 정기결제/자동갱신 조회
GET /api/terms/admin/refund     # 환불/취소 정책 조회
PUT /api/terms/admin/service    # 서비스 이용약관 수정
PUT /api/terms/admin/privacy    # 개인정보 처리방침 수정
PUT /api/terms/admin/payment    # 정기결제/자동갱신 수정
PUT /api/terms/admin/refund     # 환불/취소 정책 수정
```

**특징:**
- 약관 타입별 독립적인 버전 관리
- 수동 저장 시 버전 자동 증가 (v1.0 → v1.1)
- 자동 저장은 버전 변경 없이 내용만 업데이트
- 저장 시간 및 버전 정보 표시
- 결제 화면에서 약관 팝업 클릭 시 관리자가 입력한 약관 내용 표시

## API 엔드포인트 목록

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃
- `POST /api/auth/refresh` - 토큰 갱신
- `GET /api/auth/check-email` - 이메일 중복 확인 (회원가입용)
- `POST /api/auth/email/request` - 이메일 인증번호 요청 (회원가입용, 이메일이 이미 존재하면 에러)
- `POST /api/auth/email/request-for-password-reset` - 이메일 인증번호 요청 (비밀번호 찾기용, 이메일이 존재하지 않으면 에러)
- `POST /api/auth/email/confirm` - 이메일 인증번호 확인
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
- `GET /api/music/genres` - 장르/스타일 목록 (뮤레카 스타일 태그)
- `GET /api/music/jobs` - 내 음악 목록·월간 한도·다음 결제일 (각 job에 sourceDiaryIds 포함)
- `POST /api/music/generate` - 음악 생성 (diaryIds 7개 + genreTag 필수, 구독 필수, 월 5곡·1곡 최대 2분)
- `GET /api/music/jobs/:id` - 음악 작업 상태·상세 (제목 한/영, 가사, 재생시간, sourceDiaryIds 포함)
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
- `GET /api/terms/payment` - 정기결제/자동갱신 (공개)
- `GET /api/terms/refund` - 환불/취소 정책 (공개)
- `GET /api/terms/admin/service` - 서비스 이용약관 조회 (관리자)
- `GET /api/terms/admin/privacy` - 개인정보 처리방침 조회 (관리자)
- `GET /api/terms/admin/payment` - 정기결제/자동갱신 조회 (관리자)
- `GET /api/terms/admin/refund` - 환불/취소 정책 조회 (관리자)
- `PUT /api/terms/admin/service` - 서비스 이용약관 수정 (관리자)
- `PUT /api/terms/admin/privacy` - 개인정보 처리방침 수정 (관리자)
- `PUT /api/terms/admin/payment` - 정기결제/자동갱신 수정 (관리자)
- `PUT /api/terms/admin/refund` - 환불/취소 정책 수정 (관리자)

### 비밀번호 재설정
- `POST /api/password-reset/request` - 재설정 요청 (이메일 존재 여부 확인 후 에러 반환 가능)
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
- `0005_add_question_order.sql` - 질문 순서 컬럼 추가 (컬럼명 `order`)
- `0012_questions_sort_order.sql` - 질문 순서 컬럼을 `sort_order`로 변경 (PostgreSQL 예약어 회피)
- `0006_create_terms.sql` - 약관 관리 테이블
- `0009_music_jobs_thumbnail_url.sql` - 음악 작업 썸네일 URL
- `0010_music_jobs_duration_and_title.sql` - 재생 길이(초), 노래 제목(한국어)
- `0011_music_jobs_song_title_en.sql` - 노래 제목(영어)

**성능 인덱스:**
- 사용자, 일기, 음악 작업, 질문 이력, 고객지원, 결제 등 주요 쿼리 필드에 인덱스 추가
- 복합 인덱스로 조회 성능 향상

## 주요 기능

### 사용자 기능
- ✅ 회원가입/로그인 (이메일, 휴대폰 인증)
- ✅ 비밀번호 재설정 (이메일 기반 토큰)
- ✅ 폴더 단위 일기 관리
- ✅ 캘린더 뷰 (월별 조회, 날짜 클릭 시 해당 날짜 일기 목록 바텀 시트·슬라이드, 일기 목록 표시 시 하단 탭 바 자동 숨김, 카드에 날짜·첫 줄 표시, 월 선택 모달)
- ✅ 자유작성 일기 (리치 텍스트 에디터)
  - 텍스트 스타일 (제목, 머리말, 부머리말, 본문, 모노 스타)
  - 텍스트 포맷 (볼드, 이탤릭, 밑줄, 취소선)
  - 리스트 포맷 (번호 목록, 글머리표)
  - 텍스트 색상 변경 (70색 팔레트)
  - 배경 이미지 지원
- ✅ 질문기록 (랜덤 질문 3개, 최근 7일 중복 제외)
- ✅ 이미지 업로드 (일기 첨부)
- ✅ AI 응원 메시지 (자동 생성)
- ✅ 음악 생성 (구독 필수, 월 5곡·1곡 최대 2분, 장르 선택 + 7개 일기 선택)
- ✅ 음악 목록·상세 (노래 제목 한/영, 재생시간, 가사, 다음 결제일 표시)
- ✅ 음악이 없을 때 music_logo.png 이미지 표시
- ✅ 마이페이지
  - 프로필 편집
  - 결제 내역 조회
  - 구독 내역 조회
  - 고객지원 1:1 문의
  - 약관 보기
- ✅ 구독 결제 플로우
  - **안내페이지**: 플랜 혜택 소개, 가격 정보, 구독 시작 버튼
  - **구독하기 팝업**: 구독 시작 확인 모달
  - **구독결제 페이지**: 결제 정보, 결제 수단 선택, 다음 결제일 표시
  - **약관 동의 바텀시트**: 서비스 이용약관, 정기결제/자동갱신, 환불/취소 정책 동의
  - **결제 확인 모달**: 최종 결제 확인
  - **결제 성공 페이지**: 구독 시작 안내 및 음악 생성하기 버튼

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
  - 정기결제/자동갱신 관리
  - 환불/취소 정책 관리
  - 버전 관리 (수동 저장 시 버전 증가)
  - 자동 저장 (10초 후 자동 저장, 버전 변경 없음)
  - 결제 화면 약관 연동

### 결제 기능
- ✅ Nice Payments 연동
- ✅ 구독 관리
- ✅ 결제 내역 관리
- ✅ 구독 결제 플로우 (안내페이지 → 구독하기 팝업 → 결제 페이지 → 약관 동의 → 결제 확인 → 성공 페이지)
- ✅ 다음 결제일 자동 계산 및 표시

## 테스트

### 테스트 실행

```bash
# 단위 테스트 실행
pnpm --filter server test

# 테스트 UI 실행
pnpm --filter server test:ui

# 커버리지 리포트 생성
pnpm --filter server test:coverage

# API 연결 테스트
pnpm --filter server test:openai  # OpenAI API 연결 테스트
pnpm --filter server test:mureka  # Mureka API 연결 테스트
```

### 테스트 커버리지

현재 다음 서비스에 대한 단위 테스트가 포함되어 있습니다:
- `EncouragementService` - AI 응원 메시지 생성
- `MusicOrchestratorService` - 음악 생성 오케스트레이션
- `generateMusicSchema` - 음악 생성 입력 검증

**향후 개선:**
- API 엔드포인트 통합 테스트
- E2E 테스트 추가

## 주요 플로우

### 일기 작성 → AI 응원 메시지 생성

1. **일기 작성/수정** (`DiaryWritePage`)
   - 자유형식: `contentEditable`로 리치 텍스트 편집, HTML → 평문 변환
   - 질문기록: 랜덤 질문 3개 선택, 답변 입력
   - 이미지 업로드 및 폴더 선택

2. **일기 저장** (`diary.service.ts`)
   - 일기 데이터베이스 저장
   - 질문기록: 답변 저장 및 질문 사용 이력 기록
   - 이미지 URL 저장

3. **AI 응원 메시지 생성** (비동기, non-blocking)
   - `encouragementService.generateAndSaveEncouragement` 호출
   - `openai.provider.ts`: GPT-4o-mini로 일기 내용 분석
   - 자유형식: `content` 분석
   - 질문기록: 각 질문-답변 쌍 분석
   - 생성된 메시지를 `ai_feedback` 테이블에 저장
   - 실패해도 일기 저장은 정상 완료

### 음악 생성 플로우

1. **음악 생성 요청** (`MusicHomePage`)
   - 구독 상태 확인
   - 월간 한도 확인 (5곡)
   - 장르 선택 + 일기 7개 선택

2. **구독/한도 검사** (`music.service.ts`)
   - 활성 구독 확인
   - 이번 달 완료된 음악 개수 확인
   - 한도 초과 시 `MONTHLY_LIMIT_EXCEEDED` 에러

3. **음악 생성 오케스트레이션** (`music-orchestrator.service.ts`)
   - `music_jobs` 테이블에 작업 생성 (status: `queued`)
   - 일기 7개 로드 및 소유권 확인
   - 질문기록: 답변 데이터 포함

4. **GPT 분석** (`lyric-analysis.service.ts`)
   - `openai.provider.ts`: 7개 일기 종합 분석
   - 노래 제목 (한국어 10자, 영어 20자)
   - 전체 감정, 분위기, 키워드
   - 가사 테마 및 완성된 가사
   - 음악 생성 프롬프트 (영어)

5. **Mureka API 호출** (`mureka.provider.ts`)
   - 선택한 장르를 프롬프트 앞에 추가
   - "up to 2 minutes, natural fade-out, complete phrases" 추가
   - `POST /v1/song/generate` 호출
   - `task_id` 반환 (비동기)

6. **분석 결과 저장**
   - GPT 분석 결과를 `music_jobs`에 저장
   - `providerJobId` 저장
   - status: `processing`

7. **폴링** (`music-polling.service.ts`)
   - `GET /v1/song/query/{task_id}` 주기적 호출
   - 프론트엔드: `useMusicJob`에서 2초마다 자동 폴링
   - 백엔드: `musicPollingService.pollJob` (선택적)
   - 완료 시 `audioUrl`, `thumbnailUrl` 저장
   - `durationSeconds`: 최대 120초로 제한
   - status: `completed`

## 최근 업데이트

### 구독 결제 플로우 개선 (2024)
- **안내페이지** (`PaymentIntroPage`)
  - 플랜 혜택 소개 (일기 무제한, AI 가사 생성, 음악 생성)
  - 가격 정보 및 구독 시작 버튼
  - Mureka 로고 표시
- **구독하기 팝업** (`SubscriptionStartModal`)
  - 구독 시작 확인 모달
  - 취소/구독하기 버튼
- **구독결제 페이지** (`PaymentPage`)
  - 플랜 혜택 카드 (Mureka 로고 포함)
  - 결제 정보 섹션 (플랜, 금액, 다음 결제일 자동 계산)
  - 결제 수단 선택 (신용/체크카드, 간편결제, 계좌이체)
  - 카드사 선택 드롭다운 (신용/체크카드 선택 시)
  - 하단 고정 버튼 (안내 문구 포함)
- **약관 동의 바텀시트** (`PaymentTermsSheet`)
  - 전체 동의 체크박스
  - 필수 약관 3개 (서비스 이용약관, 정기결제/자동갱신, 환불/해지 정책)
  - 약관 상세 보기 링크
- **결제 확인 모달** (`PaymentConfirmModal`)
  - 최종 결제 확인
  - 취소/결제하기 버튼
- **결제 성공 페이지** (`PaymentSuccessPage`)
  - 구독 시작 안내 메시지
  - 홈으로 링크
  - 음악 생성하기 버튼
- **다음 결제일 연동**
  - 현재 날짜 + 1개월로 자동 계산
  - YYYY.MM.DD 형식으로 표시

### 고객지원 기능 개선 (2024)
- **문의 접수 시 모달 표시**
  - 웹 팝업(alert) 대신 확인 버튼만 있는 모달 사용
  - 성공/실패 모달로 통일된 UI 제공
  - 다른 모달과 일관된 디자인 적용

### 비밀번호 찾기 기능 개선 (2024)
- **이메일 인증 로직 분리**
  - 회원가입과 비밀번호 찾기의 이메일 인증 API 분리
  - 회원가입용: `/auth/email/request` - 이메일이 이미 존재하면 에러
  - 비밀번호 찾기용: `/auth/email/request-for-password-reset` - 이메일이 존재하지 않으면 에러
- **이메일 존재 여부 확인**
  - 비밀번호 찾기에서 이메일 입력 시 DB에 존재하는 이메일인지 확인
  - 존재하지 않는 이메일 입력 시 "존재하지 않는 이메일입니다." 에러 메시지 표시
  - 존재하는 이메일인 경우에만 이메일 인증 진행
- **비밀번호 재설정 요청 개선**
  - 비밀번호 재설정 요청 시 이메일이 존재하지 않으면 에러 반환
  - 보안상 이유로 항상 성공을 반환하던 기존 로직에서 개선

### UI/UX 개선 (2024)
- **음악 생성 페이지**
  - 음악이 없을 때 music_logo.png 이미지 표시

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
  - 서비스 이용약관/개인정보 처리방침/정기결제/자동갱신/환불/취소 정책 분리 관리
  - 약관 타입별 카드 선택 (활성 상태 강조)
  - 최종 수정일 표시
  - 버전 관리 (v1.0, v1.1 등)
  - 수동 저장 시 버전 증가
  - 자동 저장 기능 (10초 후 마지막 입력 기준)
  - 자동 저장 시 버전 변경 없음, 저장 시간만 업데이트
  - 결제 화면에서 약관 연동 (관리자가 입력한 약관 내용 표시)
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
- 캘린더 UI 개선 (전체 화면, 날짜별 일기 슬라이드, 슬라이드 시 하단 탭 바 숨김, 카드에 날짜·첫 줄 표시, 월 선택 모달, 스와이프 네비게이션)
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
