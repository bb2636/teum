import { Request, Response, NextFunction } from 'express';
import { questionSetService } from '../services/question-set.service';

export class QuestionSetController {
  async getActiveQuestionSets(req: Request, res: Response, next: NextFunction) {
    try {
      const questionSets = await questionSetService.getActiveQuestionSets();
      res.json({
        success: true,
        data: { questionSets },
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuestionSetById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Question set ID is required',
          },
        });
      }

      const questionSet = await questionSetService.getQuestionSetById(id);
      res.json({
        success: true,
        data: { questionSet },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Question set not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Question set not found',
          },
        });
      }
      next(error);
    }
  }
}

export const questionSetController = new QuestionSetController();
