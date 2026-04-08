import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router: Router = Router();

router.get('/check-nickname', userController.checkNickname.bind(userController));
router.get('/check-email', userController.checkEmail.bind(userController));

router.use(authenticate);

router.get('/me', userController.getMe.bind(userController));
router.put('/profile', userController.updateProfile.bind(userController));
router.delete('/account', userController.deleteAccount.bind(userController));

router.get('/all', requireRole(['admin']), userController.getAllUsers.bind(userController));
router.get('/:userId/payments', requireRole(['admin']), userController.getUserPayments.bind(userController));
router.put('/:userId/status', requireRole(['admin']), userController.updateUserStatus.bind(userController));
router.delete('/:userId', requireRole(['admin']), userController.deleteUser.bind(userController));

export default router;
