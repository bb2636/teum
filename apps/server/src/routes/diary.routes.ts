import { Router } from 'express';
import { diaryController } from '../controllers/diary.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// Protected routes
router.use(authenticate);

router.get('/', diaryController.getDiaries.bind(diaryController));
router.get('/all', diaryController.getAllDiaries.bind(diaryController));
router.get('/calendar', diaryController.getCalendarDiaries.bind(diaryController));
router.get('/:id', diaryController.getDiary.bind(diaryController));
router.post('/', diaryController.createDiary.bind(diaryController));
router.put('/:id', diaryController.updateDiary.bind(diaryController));
router.delete('/:id', diaryController.deleteDiary.bind(diaryController));

export default router;
