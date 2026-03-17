# API 키 발급 가이드

## OpenAI API 키 발급

### 1. OpenAI 계정 생성
1. [OpenAI Platform](https://platform.openai.com/) 접속
2. "Sign up" 클릭하여 계정 생성 (또는 "Log in"으로 기존 계정 로그인)

### 2. API 키 생성
1. 로그인 후 우측 상단 프로필 아이콘 클릭
2. "View API keys" 선택
3. "Create new secret key" 클릭
4. 키 이름 입력 (예: "teum-dev")
5. 생성된 키를 복사 (한 번만 표시되므로 안전한 곳에 저장)

### 3. 사용량 및 결제 설정
1. "Billing" 메뉴에서 결제 정보 추가
2. 사용량 제한 설정 (선택사항)
3. 모델별 가격 확인:
   - `gpt-4o-mini`: $0.15 / 1M input tokens, $0.60 / 1M output tokens
   - `gpt-4o`: $2.50 / 1M input tokens, $10.00 / 1M output tokens

### 4. 환경 변수 설정
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL_TEXT=gpt-4o-mini
AI_ENCOURAGEMENT_ENABLED=true
```

**참고:**
- 무료 크레딧: 신규 계정에 $5 크레딧 제공 (제한적)
- 사용량 모니터링: Dashboard에서 실시간 사용량 확인 가능
- Rate Limits: 계정 등급에 따라 분당 요청 수 제한

---

## Mureka API 키 발급

### 1. Mureka 계정 생성
1. [Mureka Platform](https://platform.mureka.ai/) 접속
2. "Sign In" 클릭 후 회원가입
3. 이메일 인증 완료

### 2. API 키 생성
1. 로그인 후 대시보드에서 "API Keys" 탭 선택
2. API 키 생성 후 복사 (비밀 유지 필요)

### 3. 환경 변수 설정
```env
MUREKA_API_KEY=여기에_Mureka_API_키_입력
AI_MUSIC_ENABLED=true
```

**참고:**
- API 문서: [Mureka API Platform](https://platform.mureka.ai/docs/)
- Quickstart: [Quickstart 가이드](https://platform.mureka.ai/docs/en/quickstart.html)
- 서버: `https://api.mureka.ai` (Song Generation, Task Query 등)

---

## 개발 환경 설정

### 1. .env 파일 생성
```bash
# apps/server 디렉토리에서
cp .env.example .env
```

### 2. .env 파일 편집
```env
# OpenAI
OPENAI_API_KEY=여기에_OpenAI_키_입력
OPENAI_MODEL_TEXT=gpt-4o-mini
AI_ENCOURAGEMENT_ENABLED=true

# Mureka (음악 생성)
MUREKA_API_KEY=여기에_Mureka_API_키_입력
AI_MUSIC_ENABLED=true

# 결제 연동 전: 구독하기 버튼 시 PG 호출 없이 바로 성공 처리 (선택)
# PAYMENT_MOCK_SUCCESS=true
```

### 3. 서버 재시작
```bash
pnpm --filter server dev
```

---

## 테스트 방법

### 1. 응원 메시지 테스트
1. 일기 작성/수정
2. 서버 로그에서 "Generating encouragement message" 확인
3. 데이터베이스 `ai_feedback` 테이블 확인
4. 일기 조회 시 `aiMessage` 필드 확인

### 2. 음악 생성 테스트
1. 정확히 7개의 일기 선택
2. `POST /api/music/generate` 엔드포인트 호출
3. 서버 로그에서 진행 상황 확인
4. `music_jobs` 테이블에서 결과 확인

---

## 비용 최적화 팁

### OpenAI
- 개발 환경: `gpt-4o-mini` 사용 (저렴)
- 프로덕션: 필요에 따라 `gpt-4o` 사용
- 응원 메시지: 짧은 프롬프트로 토큰 절약
- 캐싱: 동일한 일기 내용에 대한 중복 요청 방지

### Mureka
- 음악 생성: 가사(lyrics) + 스타일(prompt)로 생성
- 사용량 모니터링: 대시보드에서 확인
- 비동기: task_id 반환 후 `/v1/song/query/{task_id}` 폴링

---

## 문제 해결

### OpenAI API 오류
- **401 Unauthorized**: API 키 확인
- **429 Rate Limit**: 요청 빈도 줄이기 또는 더 높은 등급으로 업그레이드
- **500 Internal Error**: OpenAI 서버 문제, 재시도

### Mureka API 오류
- **401 Unauthorized**: API 키 확인 (Authorization: Bearer MUREKA_API_KEY)
- **400 Bad Request**: 요청 body(lyrics, prompt, model) 확인
- **500 Internal Error**: API 문서 및 trace_id로 문의

### 로그 확인
```bash
# 서버 로그에서 확인
# "OpenAI provider initialized" - 정상
# "OpenAI provider disabled" - API 키 없음
```
