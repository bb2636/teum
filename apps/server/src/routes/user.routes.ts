import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';

const router: Router = Router();

// All routes require authentication
router.get('/check-nickname', userController.checkNickname.bind(userController));

router.use(authenticate);

router.get('/me', userController.getMe.bind(userController));
router.put('/profile', userController.updateProfile.bind(userController));
router.delete('/account', userController.deleteAccount.bind(userController));
router.get('/all', userController.getAllUsers.bind(userController));
router.get('/:userId/payments', userController.getUserPayments.bind(userController));
router.put('/:userId/status', userController.updateUserStatus.bind(userController));
router.delete('/:userId', userController.deleteUser.bind(userController));

export default router;
