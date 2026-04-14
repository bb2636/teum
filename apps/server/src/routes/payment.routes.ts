import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router: Router = Router();

router.post('/nicepay/return', paymentController.nicepayReturn.bind(paymentController));
router.post('/nicepay/billing-return', paymentController.nicepayBillingReturn.bind(paymentController));
router.get('/plan-price', paymentController.getPlanPrice.bind(paymentController));
router.get('/paypal/return', paymentController.paypalReturn.bind(paymentController));
router.get('/paypal/cancel', paymentController.paypalCancel.bind(paymentController));

router.use(authenticate);

router.post('/init', paymentController.initPayment.bind(paymentController));
router.post('/billing/init', paymentController.initBillingKey.bind(paymentController));
router.post('/paypal/init', paymentController.initPayPal.bind(paymentController));
router.post('/process', paymentController.processPayment.bind(paymentController));
router.post('/cancel', paymentController.cancelPayment.bind(paymentController));
router.post('/subscriptions/cancel', paymentController.cancelSubscription.bind(paymentController));
router.post('/admin/subscriptions/cancel', requireRole(['admin']), paymentController.adminCancelSubscription.bind(paymentController));
router.get('/', paymentController.getPayments.bind(paymentController));
router.get('/subscriptions', paymentController.getSubscriptions.bind(paymentController));
router.get('/needs-verification', paymentController.needsVerification.bind(paymentController));

export default router;
