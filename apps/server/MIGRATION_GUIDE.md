# 데이터베이스 마이그레이션 가이드

## 현재 상황

`ai_feedback` 테이블이 기존 마이그레이션에 이미 존재하지만, 새로운 스키마와 구조가 다릅니다.

### 기존 구조
- `id`, `diary_id`, `message`, `created_at`

### 새로운 구조
- `id`, `user_id`, `diary_id`, `kind`, `prompt_version`, `input_excerpt`, `output_text`, `created_at`

## 마이그레이션 방법

### 방법 1: 수동 마이그레이션 실행 (권장)

`apps/server/drizzle/0001_update_ai_feedback.sql` 파일이 생성되어 있습니다. 이 파일을 직접 실행하거나, drizzle migrate를 사용하여 실행할 수 있습니다.

```bash
# 마이그레이션 실행
pnpm --filter server db:migrate
```

### 방법 2: drizzle-kit을 사용한 자동 생성

drizzle-kit이 대화형으로 물어볼 때:
- `user_id` 컬럼: **"+ user_id create column"** 선택 (새로 생성)
- 기타 컬럼들도 새로 생성하는 것으로 선택

```bash
# 마이그레이션 생성
pnpm --filter server db:generate

# 생성된 마이그레이션 확인 후 실행
pnpm --filter server db:migrate
```

### 방법 3: 기존 테이블 삭제 후 재생성 (개발 환경만)

⚠️ **주의**: 이 방법은 기존 데이터를 모두 삭제합니다. 개발 환경에서만 사용하세요.

```sql
-- 기존 테이블 삭제
DROP TABLE IF EXISTS "ai_feedback" CASCADE;

-- 새로 생성 (drizzle-kit generate 후)
```

## music_jobs 테이블

`music_jobs` 테이블은 새로 생성되는 테이블이므로 문제없이 마이그레이션이 진행됩니다.

## 성능 인덱스 마이그레이션

`0004_add_performance_indexes.sql` 파일은 주요 쿼리 성능 향상을 위한 인덱스를 추가합니다.

**포함된 인덱스:**
- 사용자: 이메일, 생성일
- 일기: 사용자 ID + 날짜, 폴더 ID, 날짜
- 음악 작업: 사용자 ID + 상태, 상태 + 생성일, 프로바이더 작업 ID
- 질문 이력: 사용자 ID + 생성일, 질문 ID
- 고객지원: 사용자 ID + 상태, 상태 + 생성일
- 결제: 사용자 ID + 상태, 생성일
- 구독: 사용자 ID + 상태, 상태 + 종료일
- 비밀번호 재설정 토큰: 토큰 + 사용 여부, 사용자 ID + 생성일

**실행 방법:**
```bash
# 마이그레이션 실행 (모든 마이그레이션 포함)
pnpm --filter server db:migrate
```

**주의사항:**
- 인덱스는 `IF NOT EXISTS`를 사용하므로 중복 실행해도 안전합니다
- 대용량 테이블의 경우 인덱스 생성에 시간이 걸릴 수 있습니다

## 마이그레이션 실행 후 확인

```bash
# 데이터베이스 연결 테스트
pnpm --filter server db:test

# 또는 직접 확인
psql $DATABASE_URL -c "\d ai_feedback"
psql $DATABASE_URL -c "\d music_jobs"
```

## 문제 해결

### "column already exists" 오류
기존 컬럼이 이미 존재하는 경우, 마이그레이션 파일에서 `IF NOT EXISTS`를 사용하거나 해당 ALTER 문을 제거하세요.

### "enum type already exists" 오류
ENUM 타입이 이미 존재하는 경우, 마이그레이션 파일의 ENUM 생성 부분을 수정하세요.

### 외래 키 제약 조건 오류
기존 데이터가 있는 경우, `user_id`를 먼저 채운 후 NOT NULL 제약을 추가해야 합니다.
