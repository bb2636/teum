import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

router.use(authenticate);

router.post('/process', paymentController.processPayment.bind(paymentController));
router.post('/cancel', paymentController.cancelPayment.bind(paymentController));
router.post('/subscriptions/cancel', paymentController.cancelSubscription.bind(paymentController));
router.get('/', paymentController.getPayments.bind(paymentController));
router.get('/subscriptions', paymentController.getSubscriptions.bind(paymentController));

export default router;
