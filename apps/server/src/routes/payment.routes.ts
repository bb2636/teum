import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { nicepayLaunchLimiter } from '../middleware/rate-limiter';

const router: Router = Router();

router.post('/nicepay/return', paymentController.nicepayReturn.bind(paymentController));
router.post('/nicepay/billing-return', paymentController.nicepayBillingReturn.bind(paymentController));
router.get('/nicepay/launch', nicepayLaunchLimiter, paymentController.nicepayLaunch.bind(paymentController));
router.post('/nicepay/webhook', paymentController.nicepayWebhook.bind(paymentController));
router.get('/nicepay/webhook', (_req, res) => res.status(200).send('OK'));
router.get('/plan-price', paymentController.getPlanPrice.bind(paymentController));
router.get('/paypal/return', paymentController.paypalReturn.bind(paymentController));
router.get('/paypal/cancel', paymentController.paypalCancel.bind(paymentController));
router.post('/paypal/webhook', paymentController.paypalWebhook.bind(paymentController));
router.post('/apple/webhook', paymentController.appleWebhook.bind(paymentController));

router.use(authenticate);

router.post('/apple/verify-receipt', paymentController.appleVerifyReceipt.bind(paymentController));

router.post('/init', paymentController.initPayment.bind(paymentController));
router.post('/billing/init', paymentController.initBillingKey.bind(paymentController));
router.post('/paypal/init', paymentController.initPayPal.bind(paymentController));
router.post('/process', paymentController.processPayment.bind(paymentController));
router.post('/cancel', paymentController.cancelPayment.bind(paymentController));
router.post('/subscriptions/cancel', paymentController.cancelSubscription.bind(paymentController));
router.get('/billing-key/status', paymentController.getBillingKeyStatus.bind(paymentController));
router.post('/billing/restore', paymentController.restoreBilling.bind(paymentController));
router.post('/admin/subscriptions/cancel', requireRole(['admin']), paymentController.adminCancelSubscription.bind(paymentController));
router.get('/', paymentController.getPayments.bind(paymentController));
router.get('/subscriptions', paymentController.getSubscriptions.bind(paymentController));
router.get('/needs-verification', paymentController.needsVerification.bind(paymentController));

export default router;
