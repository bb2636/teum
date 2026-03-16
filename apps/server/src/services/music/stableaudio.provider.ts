import { MusicProvider } from './music.provider';
import { logger } from '../../config/logger';

/**
 * Stable Audio Provider Implementation
 * 
 * Handles Stable Audio API interactions for music generation.
 * Supports both synchronous and asynchronous generation modes.
 */
export class StableAudioProvider implements MusicProvider {
  private apiKey: string | null = null;
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.STABLE_AUDIO_API_KEY || null;
    this.baseUrl = process.env.STABLE_AUDIO_BASE_URL || 'https://api.stability.ai/v2beta/audio-generation';
    this.enabled = process.env.AI_MUSIC_ENABLED === 'true' && !!this.apiKey;

    if (this.enabled) {
      logger.info('Stable Audio provider initialized');
    } else {
      logger.warn('Stable Audio provider disabled - missing API key or feature flag');
    }
  }

  /**
   * Generate music - supports both sync and async modes
   * If the API returns a job ID, the caller should poll for status
   */
  async generateMusic(input: {
    prompt: string;
    durationSeconds?: number;
  }): Promise<{
    provider: string;
    providerJobId?: string;
    audioUrl?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    raw?: unknown;
  }> {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Stable Audio provider is not enabled');
    }

    try {
      const duration = input.durationSeconds || 30; // Default 30 seconds

      // Submit generation request
      const response = await fetch(`${this.baseUrl}/text-to-music`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: input.prompt,
          duration: duration,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Stable Audio API error', {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Stable Audio API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as Record<string, unknown>;

      // Handle different response types:
      // 1. Synchronous: Direct audio URL
      // 2. Asynchronous: Job ID for polling
      const audioUrl = (data.audio_url || data.url || data.audioUrl) as string | undefined;
      const jobId = (data.job_id || data.id || data.jobId) as string | undefined;
      const status = (data.status || (audioUrl ? 'completed' : 'pending')) as string;

      if (!audioUrl && !jobId) {
        throw new Error('No audio URL or job ID in Stable Audio response');
      }

      return {
        provider: 'stable_audio',
        providerJobId: jobId,
        audioUrl: audioUrl,
        status: status as 'pending' | 'processing' | 'completed' | 'failed',
        raw: data,
      };
    } catch (error) {
      logger.error('Stable Audio generation failed', { error });
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to generate music with Stable Audio');
    }
  }

  /**
   * Poll for job status (for async generation)
   * @param jobId Provider job ID
   * @returns Job status and audio URL if completed
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    audioUrl?: string;
    error?: string;
    raw?: unknown;
  }> {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Stable Audio provider is not enabled');
    }

    try {
      const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Stable Audio job status check failed', {
          jobId,
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to check job status: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;

      return {
        status: (data.status || 'pending') as 'pending' | 'processing' | 'completed' | 'failed',
        audioUrl: (data.audio_url || data.url || data.audioUrl) as string | undefined,
        error: (data.error || data.error_message) as string | undefined,
        raw: data,
      };
    } catch (error) {
      logger.error('Stable Audio job status check failed', { jobId, error });
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to check Stable Audio job status');
    }
  }

  /**
   * Register webhook for job completion notification
   * @param jobId Provider job ID
   * @param webhookUrl Webhook URL to receive notifications
   */
  async registerWebhook(jobId: string, webhookUrl: string): Promise<void> {
    if (!this.enabled || !this.apiKey) {
      throw new Error('Stable Audio provider is not enabled');
    }

    try {
      const response = await fetch(`${this.baseUrl}/jobs/${jobId}/webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhook_url: webhookUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Failed to register webhook', {
          jobId,
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to register webhook: ${response.status}`);
      }

      logger.info('Webhook registered successfully', { jobId, webhookUrl });
    } catch (error) {
      logger.error('Webhook registration failed', { jobId, webhookUrl, error });
      // Don't throw - webhook is optional, polling can be used as fallback
    }
  }
}

export const stableAudioProvider = new StableAudioProvider();
