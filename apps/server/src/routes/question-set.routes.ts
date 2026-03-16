import { Router } from 'express';
import { questionSetController } from '../controllers/question-set.controller';

const router: Router = Router();

// Public routes - no authentication required for viewing question sets
router.get('/', questionSetController.getActiveQuestionSets.bind(questionSetController));
router.get('/:id', questionSetController.getQuestionSetById.bind(questionSetController));

export default router;
