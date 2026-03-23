import { musicOrchestratorService } from './music-orchestrator.service';
import { musicQueueService } from './music-queue.service';
import { paymentService } from '../payment.service';
import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { logger } from '../../config/logger';

/** 월간 음악 생성 한도 (구독 플랜) */
export const MUSIC_MONTHLY_LIMIT = 5;

/**
 * Music Service
 *
 * Business logic layer for music generation.
 * 구독 필수, 월 5곡·1곡당 최대 2분 제한.
 */
export class MusicService {
  private useQueue: boolean;

  constructor() {
    this.useQueue = process.env.MUSIC_QUEUE_ENABLED === 'true';
    if (this.useQueue) {
      const intervalMs = parseInt(process.env.MUSIC_QUEUE_INTERVAL_MS || '5000', 10);
      musicQueueService.startWorker(intervalMs);
      logger.info('Music queue enabled', { intervalMs });
    }
  }

  private async hasActiveSubscription(userId: string): Promise<boolean> {
    const activeSub = await paymentService.getActiveSubscription(userId);
    return activeSub !== null;
  }

  private async getMonthlyUsage(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const rows = await db
      .select({ id: musicJobs.id })
      .from(musicJobs)
      .where(
        and(
          eq(musicJobs.userId, userId),
          eq(musicJobs.status, 'completed'),
          gte(musicJobs.completedAt ?? musicJobs.createdAt, startOfMonth),
          lt(musicJobs.completedAt ?? musicJobs.createdAt, startOfNextMonth)
        )
      );
    return rows.length;
  }

  async getJobs(userId: string) {
    const jobs = await db
      .select({
        id: musicJobs.id,
        status: musicJobs.status,
        lyricalTheme: musicJobs.lyricalTheme,
        lyrics: musicJobs.lyrics,
        audioUrl: musicJobs.audioUrl,
        thumbnailUrl: musicJobs.thumbnailUrl,
        sourceDiaryIds: musicJobs.sourceDiaryIds,
        createdAt: musicJobs.createdAt,
        completedAt: musicJobs.completedAt,
        durationSeconds: musicJobs.durationSeconds,
        songTitle: musicJobs.songTitle,
        songTitleEn: musicJobs.songTitleEn,
      })
      .from(musicJobs)
      .where(eq(musicJobs.userId, userId))
      .orderBy(desc(musicJobs.createdAt));

    const monthlyUsed = await this.getMonthlyUsage(userId);
    const hasSubscription = await this.hasActiveSubscription(userId);
    const activeSub = await paymentService.getActiveSubscription(userId);
    const nextPaymentDate = activeSub?.endDate
      ? new Date(activeSub.endDate).toISOString()
      : undefined;

    return {
      jobs: jobs.map((j) => ({
        jobId: j.id,
        status: j.status,
        title: (j.songTitle ?? j.lyricalTheme) ?? undefined,
        titleEn: j.songTitleEn ?? undefined,
        lyrics: j.lyrics ?? undefined,
        audioUrl: j.audioUrl ?? undefined,
        thumbnailUrl: j.thumbnailUrl ?? undefined,
        sourceDiaryIds: (j.sourceDiaryIds as string[]) ?? [],
        durationSeconds: j.durationSeconds != null ? Math.min(j.durationSeconds, 120) : undefined,
        createdAt: j.createdAt.toISOString(),
        completedAt: j.completedAt?.toISOString() ?? undefined,
      })),
      monthlyUsed,
      monthlyLimit: MUSIC_MONTHLY_LIMIT,
      hasSubscription,
      nextPaymentDate,
    };
  }

  async generateMusic(userId: string, diaryIds: string[], genreTag?: string) {
    const hasSubscription = await this.hasActiveSubscription(userId);
    if (!hasSubscription) {
      throw new Error('SUBSCRIPTION_REQUIRED'); // 구독이 필요합니다
    }

    const monthlyUsed = await this.getMonthlyUsage(userId);
    if (monthlyUsed >= MUSIC_MONTHLY_LIMIT) {
      throw new Error('MONTHLY_LIMIT_EXCEEDED'); // 이번 달 생성 한도(5곡)를 모두 사용했습니다
    }

    if (this.useQueue) {
      return musicOrchestratorService.generateMusic(userId, diaryIds, genreTag);
    }
    return musicOrchestratorService.generateMusic(userId, diaryIds, genreTag);
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
      thumbnailUrl: job.thumbnailUrl || undefined,
      errorMessage: job.errorMessage || undefined,
      providerJobId: job.providerJobId || undefined,
      durationSeconds: job.durationSeconds != null ? Math.min(job.durationSeconds, 120) : undefined,
      title: (job.songTitle ?? job.lyricalTheme) || undefined,
      titleEn: job.songTitleEn ?? undefined,
      sourceDiaryIds: (job.sourceDiaryIds as string[]) || [],
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || undefined,
    };
  }
}

export const musicService = new MusicService();
