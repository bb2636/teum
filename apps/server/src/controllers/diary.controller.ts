import { Request, Response, NextFunction } from 'express';
import { diaryService } from '../services/diary.service';
import {
  createDiarySchema,
  updateDiarySchema,
  calendarQuerySchema,
} from '../validations/diary';

export class DiaryController {
  async getDiaries(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const folderId = req.query.folderId as string | undefined;
      const diaries = await diaryService.getDiaries(req.user.userId, folderId);
      res.json({
        success: true,
        data: { diaries },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDiary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const diary = await diaryService.getDiary(req.params.id, req.user.userId);
      res.json({
        success: true,
        data: { diary },
      });
    } catch (error) {
      next(error);
    }
  }

  async createDiary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = createDiarySchema.parse(req.body);
      const diary = await diaryService.createDiary(req.user.userId, input);
      res.status(201).json({
        success: true,
        data: { diary },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDiary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = updateDiarySchema.parse(req.body);
      const diary = await diaryService.updateDiary(req.params.id, req.user.userId, input);
      res.json({
        success: true,
        data: { diary },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDiary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      await diaryService.deleteDiary(req.params.id, req.user.userId);
      res.json({
        success: true,
        message: 'Diary deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCalendarDiaries(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const query = calendarQuerySchema.parse(req.query);
      const year = parseInt(query.year);
      const month = parseInt(query.month) - 1; // 0-indexed

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59);

      const diaries = await diaryService.getDiariesByDateRange(
        req.user.userId,
        startDate,
        endDate
      );

      res.json({
        success: true,
        data: { diaries },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllDiaries(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const diaries = await diaryService.getAllDiaries();
      res.json({
        success: true,
        data: { diaries },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const diaryController = new DiaryController();
