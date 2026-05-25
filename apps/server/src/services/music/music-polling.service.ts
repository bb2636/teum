import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { murekaProvider } from './mureka.provider';
import { logger } from '../../config/logger';

/**
 * Music Polling Service
 *
 * Event-driven: polls only jobs explicitly registered via registerJob().
 * When no jobs are active, no DB queries are made and no timer runs.
 *
 * Lifecycle:
 *   generateMusic  → registerJob(jobId)   → timer starts if needed
 *   job done/fail  → unregisterJob(jobId) → timer stops if set is empty
 *   server restart → recoverPendingJobs() → re-registers in-flight jobs (1 query)
 */
export class MusicPollingService {
  private readonly POLL_INTERVAL_MS = 60_000;

  private activeJobIds = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;

  private dbCircuitOpen = false;
  private dbCircuitOpenUntil = 0;

  private isDbQuotaError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('compute time quota') || msg.includes('exceeded the compute');
  }

  registerJob(jobId: string): void {
    this.activeJobIds.add(jobId);
    this.ensurePollerRunning();
    logger.info('Music job registered for polling', { jobId, activeJobs: this.activeJobIds.size });
  }

  unregisterJob(jobId: string): void {
    this.activeJobIds.delete(jobId);
    if (this.activeJobIds.size === 0) {
      this.stopPoller();
    }
  }

  /**
   * Called once on server startup to re-register any jobs that were
   * in-flight before a restart. Makes exactly ONE DB query.
   */
  async recoverPendingJobs(): Promise<void> {
    try {
      const pending = await db
        .select({ id: musicJobs.id })
        .from(musicJobs)
        .where(eq(musicJobs.status, 'processing'));

      for (const { id } of pending) {
        this.activeJobIds.add(id);
      }

      if (this.activeJobIds.size > 0) {
        this.ensurePollerRunning();
        logger.info('Recovered in-flight music jobs', { count: this.activeJobIds.size });
      }
    } catch (err) {
      logger.warn('Could not recover pending music jobs on startup', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private ensurePollerRunning(): void {
    if (this.pollTimer !== null || this.activeJobIds.size === 0) return;
    this.pollTimer = setInterval(() => this.pollActiveJobs(), this.POLL_INTERVAL_MS);
    logger.info('Music poller started', { activeJobs: this.activeJobIds.size, intervalMs: this.POLL_INTERVAL_MS });
  }

  private stopPoller(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      logger.info('Music poller stopped (no active jobs)');
    }
  }

  private async pollActiveJobs(): Promise<void> {
    if (this.activeJobIds.size === 0) {
      this.stopPoller();
      return;
    }

    if (this.dbCircuitOpen) {
      if (Date.now() < this.dbCircuitOpenUntil) return;
      this.dbCircuitOpen = false;
      logger.info('Music polling circuit breaker reset, resuming');
    }

    const ids = [...this.activeJobIds];
    for (const jobId of ids) {
      try {
        const done = await this.pollJob(jobId);
        if (done) {
          this.unregisterJob(jobId);
        }
      } catch (err) {
        if (this.isDbQuotaError(err)) {
          this.dbCircuitOpen = true;
          this.dbCircuitOpenUntil = Date.now() + 30 * 60 * 1000;
          logger.warn(
            { backoffUntil: new Date(this.dbCircuitOpenUntil).toISOString() },
            'Music polling: DB quota exceeded, circuit open for 30 min'
          );
          break;
        }
        logger.error('Music polling error for job', {
          jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (this.activeJobIds.size === 0) {
      this.stopPoller();
    }
  }

  /**
   * Poll a single music job for completion.
   * Used by: pollActiveJobs (background), getJob endpoint (on-demand), webhook handler.
   * @returns true if job is done (completed or failed), false if still processing
   */
  async pollJob(jobId: string): Promise<boolean> {
    const [job] = await db
      .select()
      .from(musicJobs)
      .where(eq(musicJobs.id, jobId))
      .limit(1);

    if (!job) {
      logger.warn('Job not found for polling', { jobId });
      return true;
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return true;
    }

    if (!job.providerJobId) {
      logger.warn('No provider job ID for polling', { jobId });
      return true;
    }

    try {
      const mode =
        job.provider === 'mureka_bgm' ? ('bgm' as const) :
        job.provider === 'mureka'     ? ('song' as const) : ('bgm' as const);

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

        logger.info('Music job completed', { jobId, providerJobId: job.providerJobId });
        return true;
      }

      if (status.status === 'failed') {
        await db
          .update(musicJobs)
          .set({
            status: 'failed',
            errorMessage: status.error || 'Music generation failed',
          })
          .where(eq(musicJobs.id, jobId));

        logger.error('Music job failed', {
          jobId,
          providerJobId: job.providerJobId,
          error: status.error,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error polling music job', {
        jobId,
        providerJobId: job.providerJobId,
        error: error instanceof Error ? error.message : String(error),
      });
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
        const totalSize =
          parseInt(response.headers.get('content-range')?.split('/')[1] || '0', 10) ||
          parseInt(response.headers.get('content-length') || '0', 10);
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
      logger.warn('Failed to get audio duration', {
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }
  }
}

export const musicPollingService = new MusicPollingService();
