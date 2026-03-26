import { Router } from 'express';
import { passwordResetController } from '../controllers/password-reset.controller';
import { passwordResetLimiter } from '../middleware/rate-limiter';

const router: Router = Router();

router.post('/request', passwordResetLimiter, passwordResetController.requestPasswordReset.bind(passwordResetController));
router.post('/request-by-phone', passwordResetLimiter, passwordResetController.requestPasswordResetByPhone.bind(passwordResetController));
router.post('/reset', passwordResetController.resetPassword.bind(passwordResetController));

export default router;
