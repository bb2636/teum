import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { murekaProvider } from './mureka.provider';
import { logger } from '../../config/logger';
import { pushNotificationService } from '../push-notification.service';

/**
 * Music Polling Service
 * 
 * Handles polling for async music generation jobs.
 * This service should be run as a background worker/cron job.
 */
export class MusicPollingService {
  /**
   * Poll a single music job for completion
   * @param jobId Internal job ID
   * @returns true if job is completed or failed, false if still processing
   */
  async pollJob(jobId: string): Promise<boolean> {
    const [job] = await db
      .select()
      .from(musicJobs)
      .where(eq(musicJobs.id, jobId))
      .limit(1);

    if (!job) {
      logger.warn('Job not found for polling', { jobId });
      return true; // Job doesn't exist, consider it done
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return true; // Already done
    }

    if (!job.providerJobId) {
      logger.warn('No provider job ID for polling', { jobId });
      return true; // Can't poll without provider job ID
    }

    try {
      const mode = job.provider === 'mureka_bgm' ? 'bgm' as const : job.provider === 'mureka' ? 'song' as const : 'bgm' as const;
      const status = await murekaProvider.getJobStatus(job.providerJobId, mode);

      if (status.status === 'completed' && status.audioUrl) {
        let duration: number | undefined = status.durationSeconds ?? undefined;
        if (!duration) {
          duration = (await this.getAudioDuration(status.audioUrl)) ?? undefined;
        }

        await db
          .update(musicJobs)
          .set({
            status: 'completed',
            audioUrl: status.audioUrl,
            thumbnailUrl: status.thumbnailUrl ?? null,
            completedAt: new Date(),
            durationSeconds: duration || 120,
          })
          .where(eq(musicJobs.id, jobId));

        logger.info('Music job completed via polling', { jobId, providerJobId: job.providerJobId });

        pushNotificationService.sendToUser(job.userId, {
          title: '음악이 완성되었습니다! 🎵',
          body: job.songTitle || '새로운 트랙이 준비되었습니다',
          data: { type: 'music_completed', jobId },
        }).catch((err) => {
          logger.error('Failed to send music completion push', { jobId, error: err });
        });

        return true;
      } else if (status.status === 'failed') {
        // Job failed
        await db
          .update(musicJobs)
          .set({
            status: 'failed',
            errorMessage: status.error || 'Music generation failed',
          })
          .where(eq(musicJobs.id, jobId));

        logger.error('Music job failed via polling', {
          jobId,
          providerJobId: job.providerJobId,
          error: status.error,
        });
        return true;
      }

      // Still processing
      return false;
    } catch (error) {
      logger.error('Error polling music job', {
        jobId,
        providerJobId: job.providerJobId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't mark as failed on polling error - might be temporary
      return false;
    }
  }

  private isAllowedAudioUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return false;
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false;
      if (host.endsWith('.internal') || host.endsWith('.local')) return false;
      return true;
    } catch {
      return false;
    }
  }

  private findMp3FrameBitrate(buffer: Buffer, startOffset: number): number | null {
    const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
    const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

    for (let i = startOffset; i < buffer.length - 4; i++) {
      if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
        const versionBits = (buffer[i + 1] >> 3) & 0x03;
        const layerBits = (buffer[i + 1] >> 1) & 0x03;
        const bitrateIndex = (buffer[i + 2] >> 4) & 0x0f;
        if (bitrateIndex === 0 || bitrateIndex === 0x0f) continue;
        if (layerBits === 0x01) {
          const bitrates = (versionBits === 0x03) ? MPEG1_L3_BITRATES : MPEG2_L3_BITRATES;
          return bitrates[bitrateIndex] || null;
        }
        if (layerBits === 0x00) continue;
        return MPEG1_L3_BITRATES[bitrateIndex] || null;
      }
    }
    return null;
  }

  private async getAudioDuration(audioUrl: string): Promise<number | null> {
    if (!this.isAllowedAudioUrl(audioUrl)) {
      logger.warn('Audio URL blocked by allowlist', { audioUrl: audioUrl.substring(0, 80) });
      return null;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(audioUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-65535' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const buffer = Buffer.from(await response.arrayBuffer());

      let frameStart = 0;
      if (buffer.length > 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
        const size =
          ((buffer[6] & 0x7f) << 21) |
          ((buffer[7] & 0x7f) << 14) |
          ((buffer[8] & 0x7f) << 7) |
          (buffer[9] & 0x7f);
        frameStart = 10 + size;
      }

      const bitrate = this.findMp3FrameBitrate(buffer, frameStart);
      if (bitrate) {
        const totalSize = parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10)
          || parseInt(response.headers.get('content-length') || '0', 10);
        if (totalSize > 0) {
          const durationSec = Math.round((totalSize * 8) / (bitrate * 1000));
          if (durationSec > 0 && durationSec < 600) {
            logger.info('Audio duration from MP3 header', { durationSec, bitrate });
            return durationSec;
          }
        }
      }

      const headController = new AbortController();
      const headTimeout = setTimeout(() => headController.abort(), 5000);
      const fullResponse = await fetch(audioUrl, { method: 'HEAD', signal: headController.signal });
      clearTimeout(headTimeout);
      const contentLength = parseInt(fullResponse.headers.get('content-length') || '0', 10);
      if (contentLength > 0) {
        const durationSec = Math.round((contentLength * 8) / (128 * 1000));
        if (durationSec > 0 && durationSec < 600) {
          logger.info('Audio duration estimated from content-length', { durationSec });
          return durationSec;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get audio duration', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  /**
   * Poll all pending/processing jobs
   * Should be called periodically (e.g., every 10 seconds)
   */
  async pollAllPendingJobs(): Promise<void> {
    const pendingJobs = await db
      .select()
      .from(musicJobs)
      .where(
        and(
          eq(musicJobs.status, 'processing'),
          // Only poll jobs older than 5 seconds (avoid immediate polling)
          // This is a simple check - in production, use a proper timestamp comparison
        )
      );

    logger.info('Polling pending music jobs', { count: pendingJobs.length });

    for (const job of pendingJobs) {
      if (job.providerJobId) {
        await this.pollJob(job.id);
        // Small delay between polls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
}

export const musicPollingService = new MusicPollingService();
