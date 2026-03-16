# 성능 최적화 가이드

## 데이터베이스 인덱스

### 자동 인덱스

`0004_add_performance_indexes.sql` 마이그레이션을 통해 주요 쿼리 필드에 인덱스가 자동으로 추가됩니다.

### 수동 인덱스 추가

특정 쿼리 패턴에 맞춰 추가 인덱스가 필요한 경우:

```sql
-- 예시: 특정 날짜 범위 조회 최적화
CREATE INDEX IF NOT EXISTS "diaries_date_range_idx" 
ON "diaries" ("user_id", "date") 
WHERE "deleted_at" IS NULL AND "date" >= CURRENT_DATE - INTERVAL '30 days';
```

## 음악 생성 큐 시스템

### 활성화 방법

`.env` 파일에 다음 설정 추가:

```env
MUSIC_QUEUE_ENABLED=true
MUSIC_QUEUE_INTERVAL_MS=5000
```

### 동작 방식

1. 음악 생성 요청이 들어오면 `queued` 상태로 작업 생성
2. 백그라운드 워커가 주기적으로 큐를 확인
3. 가장 오래된 작업부터 순차적으로 처리
4. 동시 처리 수 제한으로 서버 부하 분산

### 모니터링

```typescript
import { musicQueueService } from './services/music/music-queue.service';

// 큐 통계 조회
const stats = await musicQueueService.getQueueStats();
console.log(stats);
// { queued: 5, processing: 2, completed: 100, failed: 1 }
```

## CDN 스토리지

### 설정

`.env` 파일에 다음 설정 추가:

```env
STORAGE_ADAPTER=cdn
CDN_URL=https://cdn.example.com
CDN_BUCKET_NAME=teum-uploads
CDN_ACCESS_KEY_ID=your_access_key
CDN_SECRET_ACCESS_KEY=your_secret_key
```

### 지원 CDN

현재는 플레이스홀더 구현입니다. 다음 CDN 중 하나를 선택하여 구현하세요:

- **AWS S3**: `@aws-sdk/client-s3` 사용
- **Cloudflare R2**: `@aws-sdk/client-s3` 사용 (S3 호환 API)
- **Cloudinary**: `cloudinary` SDK 사용
- **Imgur**: Imgur API 사용

### 구현 예시 (AWS S3)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async upload(file: Buffer, filename: string, mimeType: string): Promise<string> {
  const client = new S3Client({
    region: this.region,
    credentials: {
      accessKeyId: this.accessKeyId!,
      secretAccessKey: this.secretAccessKey!,
    },
  });

  await client.send(new PutObjectCommand({
    Bucket: this.bucketName,
    Key: filename,
    Body: file,
    ContentType: mimeType,
  }));

  return `https://${this.bucketName}.s3.amazonaws.com/${filename}`;
}
```

## 비동기 작업 폴링

### 자동 폴링

음악 생성 작업이 비동기로 처리되는 경우, `MusicPollingService`가 자동으로 상태를 확인합니다.

### 수동 폴링

```typescript
import { musicPollingService } from './services/music/music-polling.service';

// 특정 작업 폴링
const isComplete = await musicPollingService.pollJob(jobId);

// 모든 대기 중인 작업 폴링
await musicPollingService.pollAllPendingJobs();
```

### 웹훅 설정

프로덕션 환경에서는 웹훅을 사용하여 즉시 알림을 받을 수 있습니다:

```env
WEBHOOK_BASE_URL=https://api.teum.com
```

프로바이더가 작업 완료 시 `POST /api/music/webhook/:jobId`로 알림을 보냅니다.

## 쿼리 최적화

### N+1 문제 방지

Drizzle ORM의 관계 로딩을 활용:

```typescript
// ❌ 나쁜 예: N+1 쿼리
const diaries = await db.select().from(diaries);
for (const diary of diaries) {
  const folder = await db.query.folders.findFirst({
    where: eq(folders.id, diary.folderId),
  });
}

// ✅ 좋은 예: 관계 로딩
const diaries = await db.query.diaries.findMany({
  with: {
    folder: true,
  },
});
```

### 페이지네이션

대량 데이터 조회 시 페이지네이션 사용:

```typescript
const page = 1;
const limit = 20;
const offset = (page - 1) * limit;

const diaries = await db
  .select()
  .from(diaries)
  .where(eq(diaries.userId, userId))
  .limit(limit)
  .offset(offset);
```

## 캐싱 전략

### 프론트엔드 캐싱

TanStack Query를 사용한 자동 캐싱:

```typescript
const { data } = useQuery({
  queryKey: ['diaries', userId],
  queryFn: () => fetchDiaries(userId),
  staleTime: 5 * 60 * 1000, // 5분
});
```

### 백엔드 캐싱 (향후)

Redis 등을 사용한 서버 사이드 캐싱 고려:

```typescript
// 예시: Redis 캐싱
import { redis } from './config/redis';

async function getCachedData(key: string) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetchFromDatabase();
  await redis.setex(key, 300, JSON.stringify(data)); // 5분 TTL
  return data;
}
```

## 모니터링

### 로깅

구조화된 로깅 사용:

```typescript
import { logger } from './config/logger';

logger.info('Music generation started', {
  jobId,
  userId,
  diaryCount: diaryIds.length,
});
```

### 성능 측정

```typescript
const startTime = Date.now();
await processMusicGeneration();
const duration = Date.now() - startTime;

logger.info('Music generation completed', {
  jobId,
  duration,
});
```
