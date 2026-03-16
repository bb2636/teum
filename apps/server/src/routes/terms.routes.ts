import { Router } from 'express';
import { termsController } from '../controllers/terms.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/auth';

const router: Router = Router();

// Public routes
router.get('/service', termsController.getServiceTerms.bind(termsController));
router.get('/privacy', termsController.getPrivacyPolicy.bind(termsController));

// Admin routes
router.get(
  '/admin/service',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminServiceTerms.bind(termsController)
);
router.get(
  '/admin/privacy',
  authenticate,
  requireRole(['admin']),
  termsController.getAdminPrivacyPolicy.bind(termsController)
);
router.put(
  '/admin/service',
  authenticate,
  requireRole(['admin']),
  termsController.updateServiceTerms.bind(termsController)
);
router.put(
  '/admin/privacy',
  authenticate,
  requireRole(['admin']),
  termsController.updatePrivacyPolicy.bind(termsController)
);

export default router;
