import { logger } from '../../config/logger';

const MUREKA_BASE = 'https://api.mureka.ai';

/**
 * Mureka API 응답 타입
 * @see https://platform.mureka.ai/docs/en/quickstart.html
 */
interface MurekaGenerateResponse {
  id?: string;
  created_at?: number;
  model?: string;
  status?: string;
  trace_id?: string;
  error?: { message?: string };
}

interface MurekaQueryResponse {
  id?: string;
  status?: string;
  result_url?: string;
  result?: { url?: string; cover_url?: string; thumbnail_url?: string; duration?: number };
  audio_url?: string;
  cover_url?: string;
  thumbnail_url?: string;
  cover?: string;
  duration?: number;
  choices?: Array<{ url?: string; cover_url?: string; duration?: number }>;
  error?: { message?: string };
}

/**
 * Mureka Provider
 * 뮤레카 API(https://platform.mureka.ai)를 사용한 음악 생성.
 * POST /v1/song/generate → task_id 반환, GET /v1/song/query/{task_id}로 상태 조회.
 */
export class MurekaProvider {
  private apiKey: string | null = null;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.MUREKA_API_KEY || null;
    const musicEnabled = process.env.AI_MUSIC_ENABLED === 'true';
    this.enabled = musicEnabled && !!this.apiKey;

    logger.info('Mureka provider initialization', {
      hasApiKey: !!this.apiKey,
      apiKeyPrefix: this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'none',
      musicEnabled,
      enabled: this.enabled,
    });

    if (this.enabled) {
      logger.info('Mureka provider initialized successfully');
    } else {
      logger.warn('Mureka provider disabled', {
        reason: !this.apiKey ? 'missing API key' : 'feature flag disabled',
        musicEnabled,
        hasApiKey: !!this.apiKey,
      });
    }
  }

  /**
   * 음악 생성 요청 (비동기). task_id 반환.
   * mode: 'bgm' → /v1/instrumental/generate (비용 절감, 가사 없는 BGM)
   * mode: 'song' → /v1/song/generate (가사 포함 노래)
   */
  async generateMusic(input: {
    prompt: string;
    durationSeconds?: number;
    lyrics?: string;
    mode?: 'bgm' | 'song';
  }): Promise<{
    provider: string;
    providerJobId?: string;
    audioUrl?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    raw?: unknown;
  }> {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Mureka provider is not enabled');
    }

    const mode = input.mode || 'bgm';

    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (mode === 'bgm') {
        endpoint = `${MUREKA_BASE}/v1/instrumental/generate`;
        body = {
          model: 'auto',
          prompt: input.prompt.trim() || 'pop, emotional, reflective',
        };
      } else {
        endpoint = `${MUREKA_BASE}/v1/song/generate`;
        const lyrics =
          input.lyrics?.trim() ||
          '[Verse]\nInstrumental melody based on the mood and theme.';
        body = {
          lyrics,
          model: 'auto',
          prompt: input.prompt.trim() || 'pop, emotional, reflective',
        };
      }

      logger.info('Mureka generate request', { mode, endpoint });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as MurekaGenerateResponse;

      if (!response.ok) {
        const msg = data.error?.message || response.statusText;
        logger.error('Mureka API error', { status: response.status, error: msg });
        
        // 429 에러 (quota 초과)를 명확한 에러 코드로 변환
        if (response.status === 429) {
          const error = new Error(`Mureka API quota exceeded: ${msg}`) as Error & { code?: string; statusCode?: number };
          error.code = 'MUREKA_QUOTA_EXCEEDED';
          error.statusCode = 429;
          throw error;
        }
        
        const error = new Error(`Mureka API error: ${response.status} - ${msg}`) as Error & { code?: string; statusCode?: number };
        error.statusCode = response.status;
        throw error;
      }

      const taskId = data.id;
      if (!taskId) {
        throw new Error('No task id in Mureka response');
      }

      return {
        provider: mode === 'bgm' ? 'mureka_bgm' : 'mureka',
        providerJobId: String(taskId),
        status: 'processing',
        raw: data,
      };
    } catch (error) {
      logger.error('Mureka generation failed', { error });
      if (error instanceof Error) throw error;
      throw new Error('Failed to generate music with Mureka');
    }
  }

  /**
   * 작업 상태 조회 (폴링용)
   * mode: 'bgm' → /v1/instrumental/query, 'song' → /v1/song/query
   */
  async getJobStatus(jobId: string, mode: 'bgm' | 'song' = 'bgm'): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    audioUrl?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    error?: string;
    raw?: unknown;
  }> {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Mureka provider is not enabled');
    }

    try {
      const queryPath = mode === 'bgm' ? 'instrumental' : 'song';
      const response = await fetch(`${MUREKA_BASE}/v1/${queryPath}/query/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = (await response.json()) as MurekaQueryResponse;

      if (!response.ok) {
        const msg = data.error?.message || response.statusText;
        logger.error('Mureka query failed', { jobId, status: response.status, error: msg });
        throw new Error(`Mureka query failed: ${response.status}`);
      }

      const status = this.normalizeStatus(data.status);
      const firstChoice = data.choices?.[0];
      const audioUrl =
        data.result_url ?? data.result?.url ?? data.audio_url ?? firstChoice?.url;
      const thumbnailUrl =
        data.cover_url ??
        data.thumbnail_url ??
        data.cover ??
        data.result?.cover_url ??
        data.result?.thumbnail_url ??
        firstChoice?.cover_url;
      const durationSeconds =
        data.duration ?? data.result?.duration ?? firstChoice?.duration;

      return {
        status,
        audioUrl: audioUrl || undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        durationSeconds: durationSeconds ? Math.round(durationSeconds) : undefined,
        error: data.error?.message,
        raw: data,
      };
    } catch (error) {
      logger.error('Mureka getJobStatus failed', { jobId, error });
      if (error instanceof Error) throw error;
      throw new Error('Failed to check Mureka job status');
    }
  }

  private normalizeStatus(s?: string): 'pending' | 'processing' | 'completed' | 'failed' {
    if (!s) return 'pending';
    const lower = s.toLowerCase();
    if (lower === 'completed' || lower === 'success' || lower === 'succeeded' || lower === 'done') return 'completed';
    if (lower === 'failed' || lower === 'error') return 'failed';
    if (lower === 'processing' || lower === 'preparing' || lower === 'running') return 'processing';
    return 'pending';
  }
}

export const murekaProvider = new MurekaProvider();
