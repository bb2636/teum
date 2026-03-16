import { db } from '../../db';
import { musicJobs } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { stableAudioProvider } from './stableaudio.provider';
import { logger } from '../../config/logger';

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
      // Poll provider for job status
      const status = await stableAudioProvider.getJobStatus(job.providerJobId);

      if (status.status === 'completed' && status.audioUrl) {
        // Job completed, update database
        await db
          .update(musicJobs)
          .set({
            status: 'completed',
            audioUrl: status.audioUrl,
            completedAt: new Date(),
          })
          .where(eq(musicJobs.id, jobId));

        logger.info('Music job completed via polling', { jobId, providerJobId: job.providerJobId });
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
