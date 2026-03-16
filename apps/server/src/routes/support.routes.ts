import { Router } from 'express';
import { supportController } from '../controllers/support.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router: Router = Router();

// User routes
router.post('/', authenticate, supportController.createInquiry.bind(supportController));
router.get('/', authenticate, supportController.getInquiries.bind(supportController));
router.get('/:id', authenticate, supportController.getInquiry.bind(supportController));

// Admin routes (must be before /:id route)
router.get('/admin/all', authenticate, requireRole(['admin']), supportController.getAllInquiries.bind(supportController));
router.get('/admin/:id', authenticate, requireRole(['admin']), supportController.getInquiryById.bind(supportController));
router.put('/admin/:id/answer', authenticate, requireRole(['admin']), supportController.updateInquiryAnswer.bind(supportController));

export default router;
