import { musicOrchestratorService } from './music-orchestrator.service';
import { musicQueueService } from './music-queue.service';
import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../config/logger';

/**
 * Music Service
 * 
 * Business logic layer for music generation.
 * Supports both immediate and queued processing.
 */
export class MusicService {
  private useQueue: boolean;

  constructor() {
    // Use queue if enabled via environment variable
    this.useQueue = process.env.MUSIC_QUEUE_ENABLED === 'true';
    
    if (this.useQueue) {
      // Start queue worker
      const intervalMs = parseInt(process.env.MUSIC_QUEUE_INTERVAL_MS || '5000', 10);
      musicQueueService.startWorker(intervalMs);
      logger.info('Music queue enabled', { intervalMs });
    }
  }

  async generateMusic(userId: string, diaryIds: string[]) {
    if (this.useQueue) {
      // Queue the job - it will be processed by the worker
      // For now, still process immediately but mark as queued
      // In production, this would just create the job and return
      return musicOrchestratorService.generateMusic(userId, diaryIds);
    } else {
      // Process immediately (current behavior)
      return musicOrchestratorService.generateMusic(userId, diaryIds);
    }
  }

  async getJob(userId: string, jobId: string) {
    logger.info('Getting music job', { userId, jobId });

    const [job] = await db
      .select()
      .from(musicJobs)
      .where(and(eq(musicJobs.id, jobId), eq(musicJobs.userId, userId)))
      .limit(1);

    if (!job) {
      throw new Error('Music job not found');
    }

    return {
      jobId: job.id,
      status: job.status,
      overallEmotion: job.overallEmotion || undefined,
      mood: job.mood || undefined,
      keywords: (job.keywords as string[]) || undefined,
      lyricalTheme: job.lyricalTheme || undefined,
      lyrics: job.lyrics || undefined,
      musicPrompt: job.musicPrompt || undefined,
      audioUrl: job.audioUrl || undefined,
      errorMessage: job.errorMessage || undefined,
      providerJobId: job.providerJobId || undefined,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || undefined,
    };
  }
}

export const musicService = new MusicService();
