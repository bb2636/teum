import { Request, Response, NextFunction } from 'express';
import { diaryService } from '../services/diary.service';
import { diaryRepository } from '../repositories/diary.repository';
import { userRepository } from '../repositories/user.repository';
import { getTranslatedQuestions } from '../services/question-translation.service';
import {
  createDiarySchema,
  updateDiarySchema,
  calendarQuerySchema,
} from '../validations/diary';

async function getUserLanguage(userId: string): Promise<string> {
  try {
    const user = await userRepository.findByIdWithProfile(userId);
    return user?.profile?.language || 'ko';
  } catch {
    return 'ko';
  }
}

async function translateDiaryQuestions(diary: any, lang: string) {
  if (!diary?.answers?.length || lang === 'ko') return diary;
  const questionsToTranslate = diary.answers
    .filter((a: any) => a.question?.question)
    .map((a: any) => ({ id: a.questionId, question: a.question.question }));
  if (questionsToTranslate.length === 0) return diary;
  const translated = await getTranslatedQuestions(questionsToTranslate, lang);
  const translatedMap = new Map(translated.map((q) => [q.id, q.question]));
  for (const answer of diary.answers) {
    if (answer.question?.question && translatedMap.has(answer.questionId)) {
      answer.question = { ...answer.question, question: translatedMap.get(answer.questionId) };
    }
  }
  return diary;
}

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
      const limitParam = req.query.limit as string | undefined;
      const offsetParam = req.query.offset as string | undefined;

      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : undefined;
      const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : undefined;

      const result = await diaryService.getDiaries(req.user.userId, folderId, limit != null ? { limit, offset } : undefined);
      const lang = await getUserLanguage(req.user.userId);
      if (lang !== 'ko') {
        await Promise.all(result.items.map((diary: any) => translateDiaryQuestions(diary, lang)));
      }
      res.json({
        success: true,
        data: {
          diaries: result.items,
          hasMore: result.hasMore,
          nextOffset: result.nextOffset,
        },
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
      const lang = await getUserLanguage(req.user.userId);
      await translateDiaryQuestions(diary, lang);
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
  async getDiaryCount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const count = await diaryRepository.countByUserId(req.user.userId);
      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const diaryController = new DiaryController();
