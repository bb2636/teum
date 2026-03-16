import { Router } from 'express';
import { passwordResetController } from '../controllers/password-reset.controller';

const router: Router = Router();

router.post('/request', passwordResetController.requestPasswordReset.bind(passwordResetController));
router.post('/reset', passwordResetController.resetPassword.bind(passwordResetController));

export default router;
