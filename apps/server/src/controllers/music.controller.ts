import { Request, Response, NextFunction } from 'express';
import { musicService } from '../services/music/music.service';
import { musicPollingService } from '../services/music/music-polling.service';
import { generateMusicSchema } from '../validations/music';

export class MusicController {
  async generateMusic(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const input = generateMusicSchema.parse(req.body);
      const result = await musicService.generateMusic(req.user.userId, input.diaryIds);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getJob(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Job ID is required',
          },
        });
      }

      // If job is still processing, try polling once
      const job = await musicService.getJob(req.user.userId, jobId);
      if (job.status === 'processing' && job.providerJobId) {
        // Trigger a poll attempt (non-blocking)
        musicPollingService.pollJob(jobId).catch((_error) => {
          // Log but don't fail the request
          // Error is logged by polling service
        });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Music job not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Music job not found',
          },
        });
      }
      next(error);
    }
  }

  /**
   * Webhook endpoint for provider to notify job completion
   * POST /api/music/webhook/:jobId
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const jobId = req.params.jobId;
      const { status, audio_url, error } = req.body;

      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Job ID is required' },
        });
      }

      // Verify webhook (in production, verify signature/token)
      // For now, update job status directly
      if (status === 'completed' && audio_url) {
        await musicPollingService.pollJob(jobId);
      } else if (status === 'failed') {
        // Update job as failed
        // This would be handled by pollJob, but we can do it directly here
      }

      res.json({ success: true, message: 'Webhook received' });
    } catch (error) {
      next(error);
    }
  }
}

export const musicController = new MusicController();
