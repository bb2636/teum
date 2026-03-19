import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// Public routes
router.post('/signup', authController.signup.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.get('/check-email', authController.checkEmailExists.bind(authController));
router.post('/email/request', authController.requestEmailVerification.bind(authController));
router.post('/email/request-for-password-reset', authController.requestEmailVerificationForPasswordReset.bind(authController));
router.post('/email/confirm', authController.confirmEmailVerification.bind(authController));
router.post('/phone/request', authController.requestPhoneVerification.bind(authController));
router.post('/phone/confirm', authController.confirmPhoneVerification.bind(authController));

// Protected routes
router.post('/logout', authenticate, authController.logout.bind(authController));

export default router;
