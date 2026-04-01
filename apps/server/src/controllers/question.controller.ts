import { Request, Response, NextFunction } from 'express';
import { questionService } from '../services/question.service';
import { createQuestionSchema, updateQuestionSchema } from '../validations/question';
import { requireRole } from '../middleware/auth';
import { logger } from '../config/logger';
import { getTranslatedQuestions } from '../services/question-translation.service';

export class QuestionController {
  // Get random questions for user (excludes questions used in last 7 days)
  async getRandomQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const count = parseInt(req.query.count as string) || 3;
      const lang = (req.query.lang as string) || 'ko';
      const questions = await questionService.getRandomQuestions(req.user.userId, count);

      const translatedQuestions = lang !== 'ko'
        ? await getTranslatedQuestions(questions, lang)
        : questions;

      res.json({
        success: true,
        data: { questions: translatedQuestions },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get all questions
  async getAllQuestions(req: Request, res: Response, next: NextFunction) {
    try {
      const questions = await questionService.getAllQuestions();
      res.json({
        success: true,
        data: { questions },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get question by ID
  async getQuestionById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Question ID is required' },
        });
      }

      const question = await questionService.getQuestionById(id);
      res.json({
        success: true,
        data: { question },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Question not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Question not found' },
        });
      }
      next(error);
    }
  }

  // Admin: Create question
  async createQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createQuestionSchema.parse(req.body);
      const question = await questionService.createQuestion(input);

      res.status(201).json({
        success: true,
        data: { question },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update question
  async updateQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Question ID is required' },
        });
      }

      const input = updateQuestionSchema.parse(req.body);
      logger.info(`Update question - id=${id} body=${JSON.stringify(req.body)} parsed=${JSON.stringify(input)}`);
      if (Object.keys(input).length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: '수정할 내용(question 또는 isActive)을 입력해주세요' },
        });
      }
      const question = await questionService.updateQuestion(id, input);

      res.json({
        success: true,
        data: { question },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Question not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Question not found' },
        });
      }
      next(error);
    }
  }

  // Admin: Delete question
  async deleteQuestion(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Question ID is required' },
        });
      }

      await questionService.deleteQuestion(id);

      res.json({
        success: true,
        message: 'Question deleted successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Question not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Question not found' },
        });
      }
      next(error);
    }
  }

  // Admin: Update question order
  async updateQuestionOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { questionIds } = req.body;
      
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'questionIds array is required' },
        });
      }

      const questions = await questionService.updateQuestionOrder(questionIds);

      res.json({
        success: true,
        data: { questions },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const questionController = new QuestionController();
