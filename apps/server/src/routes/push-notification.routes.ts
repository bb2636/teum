import { Router, type Router as RouterType } from 'express';
import { pushNotificationController } from '../controllers/push-notification.controller';
import { authenticate } from '../middleware/auth';

const router: RouterType = Router();

router.post('/register', authenticate, pushNotificationController.registerToken.bind(pushNotificationController));
router.post('/unregister', authenticate, pushNotificationController.unregisterToken.bind(pushNotificationController));

export default router;
