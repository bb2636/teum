import { Router, type RequestHandler, type Response as ExpressResponse } from 'express';
import { encouragementService } from '../services/ai/encouragement.service';
import { db } from '../db';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.use(authenticate);

// Regenerate encouragement message for a diary
router.post('/feedback/:diaryId', (async (req, res, next): Promise<ExpressResponse | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { diaryId } = req.params;
    const { content, title, type, answers } = req.body;

    // Regenerate encouragement message
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

// Get AI feedback for a diary
router.get('/feedback/:diaryId', (async (req, res, next): Promise<ExpressResponse | void> => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
    }

    const { diaryId } = req.params;

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
