import { Router } from 'express';
import { questionController } from '../controllers/question.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router: Router = Router();

// Public/User routes
router.get(
  '/random',
  authenticate,
  questionController.getRandomQuestions.bind(questionController)
);

// Admin routes
router.get(
  '/',
  authenticate,
  requireRole(['admin']),
  questionController.getAllQuestions.bind(questionController)
);
router.get(
  '/:id',
  authenticate,
  requireRole(['admin']),
  questionController.getQuestionById.bind(questionController)
);
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  questionController.createQuestion.bind(questionController)
);
router.put(
  '/order',
  authenticate,
  requireRole(['admin']),
  questionController.updateQuestionOrder.bind(questionController)
);
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  questionController.updateQuestion.bind(questionController)
);
router.patch(
  '/:id',
  authenticate,
  requireRole(['admin']),
  questionController.updateQuestion.bind(questionController)
);
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  questionController.deleteQuestion.bind(questionController)
);

export default router;
