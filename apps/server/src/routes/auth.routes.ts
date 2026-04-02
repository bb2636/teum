import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { loginLimiter, signupLimiter, verificationLimiter, mobileTokenExchangeLimiter } from '../middleware/rate-limiter';

const router: Router = Router();

// Public routes
router.post('/signup', signupLimiter, authController.signup.bind(authController));
router.post('/login', loginLimiter, authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
router.get('/check-email', authController.checkEmailExists.bind(authController));
router.post('/email/request', verificationLimiter, authController.requestEmailVerification.bind(authController));
router.post('/email/request-for-password-reset', verificationLimiter, authController.requestEmailVerificationForPasswordReset.bind(authController));
router.post('/email/confirm', authController.confirmEmailVerification.bind(authController));
router.post('/phone/request', verificationLimiter, authController.requestPhoneVerification.bind(authController));
router.post('/phone/confirm', authController.confirmPhoneVerification.bind(authController));

// Social login routes
router.get('/google/callback', authController.googleOAuthCallback.bind(authController));
router.post('/google/login', loginLimiter, authController.googleLogin.bind(authController));
router.get('/apple/callback', authController.appleOAuthCallback.bind(authController));
router.post('/apple/callback', authController.appleOAuthCallback.bind(authController));
router.post('/apple/login', loginLimiter, authController.appleLogin.bind(authController));
router.post('/social/onboarding', signupLimiter, authController.socialOnboarding.bind(authController));
router.post('/exchange-mobile-token', mobileTokenExchangeLimiter, authController.exchangeMobileToken.bind(authController));

// Protected routes
router.post('/logout', authenticate, authController.logout.bind(authController));

export default router;
