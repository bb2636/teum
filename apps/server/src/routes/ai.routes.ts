import { Router, type RequestHandler, type Response as ExpressResponse } from 'express';
import { encouragementService } from '../services/ai/encouragement.service';
import { db } from '../db';
import { authenticate } from '../middleware/auth';
import { z } from 'zod';

const router: Router = Router();

const aiFeedbackParamsSchema = z.object({
  diaryId: z.string().uuid('Invalid diary ID format'),
});

const aiFeedbackBodySchema = z.object({
  content: z.string().optional(),
  title: z.string().optional(),
  type: z.enum(['free_form', 'question_based']).default('free_form'),
  answers: z.array(z.object({
    answer: z.string(),
    question: z.union([
      z.string(),
      z.object({ question: z.string() }),
    ]).optional().transform(v => {
      if (!v) return '';
      return typeof v === 'string' ? v : v.question;
    }),
  })).optional(),
});

router.use(authenticate);

router.post('/feedback/:diaryId', (async (req, res, next): Promise<ExpressResponse | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const paramsResult = aiFeedbackParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: paramsResult.error.errors[0]?.message || 'Invalid parameters' },
      });
    }

    const bodyResult = aiFeedbackBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: bodyResult.error.errors[0]?.message || 'Invalid request body' },
      });
    }

    const { diaryId } = paramsResult.data;
    const { content, title, type, answers } = bodyResult.data;

    const diary = await db.query.diaries.findFirst({
      where: (d, { eq, and }) => and(eq(d.id, diaryId), eq(d.userId, req.user!.userId)),
    });
    if (!diary) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Diary not found' },
      });
    }

    await encouragementService.generateAndSaveEncouragement(
      diaryId,
      req.user.userId,
      {
        title,
        content,
        type: type || 'free_form',
        answers,
      }
    );

    // Get the latest feedback
    const feedback = await db.query.aiFeedback.findFirst({
      where: (feedback, { eq, and }) =>
        and(eq(feedback.diaryId, diaryId), eq(feedback.kind, 'encouragement')),
      orderBy: (feedback, { desc }) => [desc(feedback.createdAt)],
    });

    res.json({
      success: true,
      data: {
        message: feedback?.outputText || null,
        feedback,
      },
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

router.get('/feedback/:diaryId', (async (req, res, next): Promise<ExpressResponse | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const paramsResult = aiFeedbackParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: paramsResult.error.errors[0]?.message || 'Invalid parameters' },
      });
    }

    const { diaryId } = paramsResult.data;

    const diary = await db.query.diaries.findFirst({
      where: (d, { eq, and }) => and(eq(d.id, diaryId), eq(d.userId, req.user!.userId)),
    });
    if (!diary) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Diary not found' },
      });
    }

    const feedback = await db.query.aiFeedback.findFirst({
      where: (feedback, { eq, and }) =>
        and(eq(feedback.diaryId, diaryId), eq(feedback.kind, 'encouragement')),
      orderBy: (feedback, { desc }) => [desc(feedback.createdAt)],
    });

    res.json({
      success: true,
      data: { feedback },
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

export default router;
