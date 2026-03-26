import { Request, Response, NextFunction } from 'express';
import { musicService } from '../services/music/music.service';
import { musicPollingService } from '../services/music/music-polling.service';
import { generateMusicSchema } from '../validations/music';
import { MUREKA_GENRES } from '../services/music/mureka-styles';
import { logger } from '../config/logger';

export class MusicController {
  /** 장르/스타일 목록 (뮤레카 스타일 태그) */
  async getGenres(_req: Request, res: Response): Promise<Response> {
    return res.json({
      success: true,
      data: { genres: MUREKA_GENRES },
    });
  }

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
      const result = await musicService.generateMusic(
        req.user.userId,
        input.diaryIds,
        input.genreTag
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        const err = error as Error & { code?: string };
        
        if (error.message === 'SUBSCRIPTION_REQUIRED' || err.code === 'SUBSCRIPTION_REQUIRED') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'SUBSCRIPTION_REQUIRED',
              message: '음악 생성을 이용하려면 구독이 필요합니다.',
            },
          });
        }
        if (error.message === 'MONTHLY_LIMIT_EXCEEDED' || err.code === 'MONTHLY_LIMIT_EXCEEDED') {
          return res.status(403).json({
            success: false,
            error: {
              code: 'MONTHLY_LIMIT_EXCEEDED',
              message: '이번 달 생성 한도(5곡)를 모두 사용했습니다.',
            },
          });
        }
        if (err.code === 'MUREKA_QUOTA_EXCEEDED' || error.message.includes('quota exceeded')) {
          return res.status(429).json({
            success: false,
            error: {
              code: 'MUREKA_QUOTA_EXCEEDED',
              message: 'Mureka API 할당량이 초과되었습니다.',
            },
          });
        }
      }
      next(error);
    }
  }

  async getJobs(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
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

      const data = await musicService.getJobs(req.user.userId);
      res.json({
        success: true,
        data,
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

      let job = await musicService.getJob(req.user.userId, jobId);
      if (job.status === 'processing' && job.providerJobId) {
        try {
          const done = await musicPollingService.pollJob(jobId);
          if (done) {
            job = await musicService.getJob(req.user.userId, jobId);
          }
        } catch (pollError) {
          logger.warn('Music job polling failed:', { jobId, error: pollError instanceof Error ? pollError.message : pollError });
        }
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
