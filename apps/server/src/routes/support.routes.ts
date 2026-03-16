import { Router } from 'express';
import { supportController } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.use(authenticate);

router.post('/', supportController.createInquiry.bind(supportController));
router.get('/', supportController.getInquiries.bind(supportController));
router.get('/:id', supportController.getInquiry.bind(supportController));

export default router;
