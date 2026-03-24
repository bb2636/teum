import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq, and, count } from 'drizzle-orm';
import { musicOrchestratorService } from './music-orchestrator.service';
import { logger } from '../../config/logger';

/**
 * Music Queue Service
 * 
 * Handles queuing and processing of music generation jobs.
 * In production, this should be replaced with a proper queue system (Bull, BullMQ, etc.)
 */
export class MusicQueueService {
  private running = false;
  private jobInProgress = false;
  private intervalId: NodeJS.Timeout | null = null;

  startWorker(intervalMs: number = 5000): void {
    if (this.running) {
      logger.warn('Music queue worker is already running');
      return;
    }

    this.running = true;
    logger.info('Music queue worker started', { intervalMs });

    this.intervalId = setInterval(async () => {
      if (this.jobInProgress) return;
      await this.processNextJob();
    }, intervalMs);
  }

  /**
   * Stop the queue worker
   */
  stopWorker(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    logger.info('Music queue worker stopped');
  }

  /**
   * Process the next queued job
   */
  private async processNextJob(): Promise<void> {
    this.jobInProgress = true;
    try {
      const [job] = await db
        .select()
        .from(musicJobs)
        .where(eq(musicJobs.status, 'queued'))
        .orderBy(musicJobs.createdAt)
        .limit(1);

      if (!job) {
        return;
      }

      logger.info('Processing music generation job', { jobId: job.id });

      await db
        .update(musicJobs)
        .set({ status: 'processing' })
        .where(eq(musicJobs.id, job.id));

      await musicOrchestratorService.generateMusic(job.userId, job.sourceDiaryIds as string[]);
    } catch (error) {
      logger.error('Error processing music job', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.jobInProgress = false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const [queuedResult] = await db
      .select({ count: count() })
      .from(musicJobs)
      .where(eq(musicJobs.status, 'queued'));

    const [processingResult] = await db
      .select({ count: count() })
      .from(musicJobs)
      .where(eq(musicJobs.status, 'processing'));

    const [completedResult] = await db
      .select({ count: count() })
      .from(musicJobs)
      .where(eq(musicJobs.status, 'completed'));

    const [failedResult] = await db
      .select({ count: count() })
      .from(musicJobs)
      .where(eq(musicJobs.status, 'failed'));

    return {
      queued: Number(queuedResult?.count || 0),
      processing: Number(processingResult?.count || 0),
      completed: Number(completedResult?.count || 0),
      failed: Number(failedResult?.count || 0),
    };
  }
}

export const musicQueueService = new MusicQueueService();
