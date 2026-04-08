import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { musicService } from '../services/music/music.service';
import { musicPollingService } from '../services/music/music-polling.service';
import { generateMusicSchema } from '../validations/music';
import { MUREKA_GENRES } from '../services/music/mureka-styles';
import { logger } from '../config/logger';

const downloadTokens = new Map<string, { userId: string; jobId: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of downloadTokens) {
    if (data.expiresAt < now) downloadTokens.delete(token);
  }
}, 60000);

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

      const limitParam = req.query.limit as string | undefined;
      const offsetParam = req.query.offset as string | undefined;

      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : undefined;
      const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : undefined;

      const data = await musicService.getJobs(req.user.userId, limit != null ? { limit, offset } : undefined);
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

  async createDownloadToken(req: Request, res: Response): Promise<Response> {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const jobId = req.params.id;
    if (!jobId) {
      return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Job ID is required' } });
    }

    const token = crypto.randomBytes(32).toString('hex');
    downloadTokens.set(token, {
      userId: req.user.userId,
      jobId,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    return res.json({ success: true, data: { token } });
  }

  async downloadByToken(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { token } = req.params;
      const tokenData = downloadTokens.get(token);
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        downloadTokens.delete(token);
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid or expired token' } });
      }

      const job = await musicService.getJob(tokenData.userId, tokenData.jobId);
      if (!job.audioUrl) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Audio not available' } });
      }

      await this.streamAudio(res, job.audioUrl, job.title);
    } catch (error) {
      if (!res.headersSent) next(error);
    }
  }

  async downloadJob(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const jobId = req.params.id;
      if (!jobId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Job ID is required' },
        });
      }

      const job = await musicService.getJob(req.user.userId, jobId);
      if (!job.audioUrl) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Audio not available' },
        });
      }

      await this.streamAudio(res, job.audioUrl, job.title);
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      }
    }
  }

  private async streamAudio(res: Response, audioUrl: string, title?: string): Promise<void> {
    const cleanTitle = (title || 'music').replace(/[^\w가-힣\s\-]/g, '').trim() || 'music';
    const filename = `${cleanTitle}.mp3`;
    const asciiFilename = cleanTitle.replace(/[^\x20-\x7E]/g, '_').replace(/_+/g, '_').trim() || 'music';
    const encodedFilename = encodeURIComponent(filename);
    console.log('[streamAudio] title:', title, '→ filename:', filename, '→ ascii:', asciiFilename, '→ encoded:', encodedFilename);
    console.log('[streamAudio] Content-Disposition:', `attachment; filename="${asciiFilename}.mp3"; filename*=UTF-8''${encodedFilename}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const audioResponse = await fetch(audioUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!audioResponse.ok || !audioResponse.body) {
      res.status(502).json({
        success: false,
        error: { code: 'UPSTREAM_ERROR', message: 'Failed to fetch audio' },
      });
      return;
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFilename}.mp3"; filename*=UTF-8''${encodedFilename}`
    );
    const contentLength = audioResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const reader = audioResponse.body.getReader();
    const pump = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => res.once('drain', resolve));
      }
      return pump();
    };
    await pump();
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

      const webhookSecret = process.env.MUREKA_WEBHOOK_SECRET;
      if (webhookSecret) {
        const authHeader = req.headers['authorization'] || req.headers['x-webhook-secret'];
        if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
          logger.warn('Music webhook unauthorized attempt', { jobId, ip: req.ip });
          return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid webhook secret' },
          });
        }
      } else {
        logger.warn('MUREKA_WEBHOOK_SECRET not configured, webhook authentication skipped');
      }

      if (status === 'completed' && audio_url) {
        await musicPollingService.pollJob(jobId);
      }

      res.json({ success: true, message: 'Webhook received' });
    } catch (error) {
      next(error);
    }
  }
}

export const musicController = new MusicController();
