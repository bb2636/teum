# Mureka API 사용법

뮤레카(Mureka) API로 일기 기반 가사·프롬프트를 전달해 AI 음악을 생성합니다.

- 공식 문서: https://platform.mureka.ai/docs
- Base URL: `https://api.mureka.ai`

---

## 1. 인증

모든 요청에 API 키를 Bearer 토큰으로 넣습니다.

```http
Authorization: Bearer {MUREKA_API_KEY}
```

`.env` 예시:

```env
MUREKA_API_KEY=여기에_발급받은_키_입력
AI_MUSIC_ENABLED=true
```

---

## 2. 음악 생성 (비동기)

**POST** `/v1/song/generate`

가사와 스타일 프롬프트를 보내면 작업 ID가 반환되고, 실제 오디오는 비동기로 생성됩니다.

### Request Body (JSON)

| 필드     | 타입   | 필수 | 설명 |
|----------|--------|------|------|
| `lyrics` | string | O    | 가사 전체 (한국어/영어 등). 없으면 instrumental용 기본 문구 사용 |
| `model`  | string | -    | `"auto"` 권장 (자동 선택) |
| `prompt` | string | O    | 스타일 설명 (영어). 장르, 분위기, 템포, 악기, 자연스러운 마무리 등 |

### 예시

```json
{
  "lyrics": "[Verse 1]\n오늘 하루도...\n\n[Chorus]\n...",
  "model": "auto",
  "prompt": "warm reflective piano pop, soft vocal, nostalgic yet hopeful, slow tempo, natural fade-out ending, complete phrases, no abrupt cut, up to 2 minutes"
}
```

### Response (200)

```json
{
  "id": "task_id_문자열",
  "created_at": 1234567890,
  "model": "auto",
  "status": "processing",
  "trace_id": "..."
}
```

- `id`: 이후 **상태 조회**에 사용하는 `task_id`입니다.

### 곡 길이 및 끊김 방지

- Mureka는 **요청 시 duration 파라미터를 지원하지 않습니다.** 곡 길이는 가사·프롬프트에 따라 결정됩니다.
- **최대 2분**·**끊기지 않는 느낌**을 위해 `prompt`에 다음을 포함하는 것을 권장합니다:
  - `up to 2 minutes total length`
  - `natural fade-out ending`
  - `complete musical phrases, no abrupt cut or mid-phrase ending`
- 서비스에서는 `musicPrompt`(AI 생성) 뒤에 위 문구를 이어 붙여 Mureka로 전달합니다.

---

## 3. 작업 상태 조회 (폴링)

**GET** `/v1/song/query/{task_id}`

생성 요청 후 받은 `task_id`로 완료 여부·오디오 URL을 조회합니다.

### 예시

```http
GET https://api.mureka.ai/v1/song/query/abc123-task-id
Authorization: Bearer {MUREKA_API_KEY}
```

### Response (200)

- 진행 중: `status` 가 `"processing"` 등
- 완료: `status` 가 `"completed"` / `"success"` / `"done"` 이고, 오디오 URL 포함

응답 필드 예시 (문서·버전에 따라 다를 수 있음):

- `status`: 작업 상태
- `result_url` / `result.url` / `audio_url`: 생성된 오디오 URL
- `cover_url` / `thumbnail_url` / `result.cover_url`: 커버/썸네일 URL
- `error.message`: 실패 시 에러 메시지

서비스에서는 이 엔드포인트를 **폴링**해서 `completed`가 되면 `audioUrl`을 DB에 저장하고, 재생 길이는 **최대 2분(120초)** 으로 제한해 저장합니다.

---

## 4. 장르/스타일 목록

- 뮤레카 공식 API에는 장르 목록 조회 API가 없습니다.
- 서비스에서는 **스타일 목록**을 `apps/server/src/services/music/mureka-styles.ts`에 정의해 두고, **GET /api/music/genres**로 제공합니다.
- 사용자가 선택한 장르 태그는 음악 생성 시 `prompt` 앞에 붙여 전달합니다 (`{genreTag}, {musicPrompt}, ...`).

## 5. 서비스 연동 요약

| 단계 | 처리 |
|------|------|
| 1 | 사용자가 일기 7개 + 장르 선택 → GPT 분석 → `lyrics`, `musicPrompt` 생성 |
| 2 | `prompt` = 선택 장르 + `musicPrompt` + 2분·자연 마무리 문구 → **POST /v1/song/generate** 호출 |
| 3 | 반환된 `id`로 **GET /v1/song/query/{id}** 주기적 폴링 |
| 4 | `status === completed` 이면 `audioUrl` 저장, `duration_seconds`는 120으로 고정(최대 2분) |

에러 시 `status === 'failed'` 및 `error.message` 확인하면 됩니다.
