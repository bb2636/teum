import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/user.repository';
import { userService } from '../services/user.service';
import { authenticate } from '../middleware/auth';
import { eq, isNull, and } from 'drizzle-orm';
import { users, subscriptions } from '../db/schema';
import { updateProfileSchema } from '../validations/user';
import { db } from '../db';
import { emailService } from '../services/email/email.service';
import { logger } from '../config/logger';

export class UserController {
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const user = await userRepository.findByIdWithProfile(req.user.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.profile,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async checkNickname(req: Request, res: Response, next: NextFunction) {
    try {
      const { nickname } = req.query;

      if (!nickname || typeof nickname !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Nickname is required',
          },
        });
      }

      // Check if nickname is valid format
      if (nickname.length < 2 || nickname.length > 12) {
        return res.json({
          success: true,
          data: { available: false, reason: 'length' },
        });
      }

      if (nickname.includes(' ')) {
        return res.json({
          success: true,
          data: { available: false, reason: 'spaces' },
        });
      }

      if (!/^[a-zA-Z0-9가-힣_]+$/.test(nickname)) {
        return res.json({
          success: true,
          data: { available: false, reason: 'invalid_chars' },
        });
      }

      // Check if nickname is already taken
      const existingProfile = await userRepository.findByNickname(nickname);
      if (existingProfile && existingProfile.user && !existingProfile.user.deletedAt) {
        return res.json({
          success: true,
          data: { available: false, reason: 'duplicate' },
        });
      }

      res.json({
        success: true,
        data: { available: true },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const userWithProfile = await userRepository.findByIdWithProfile(req.user.userId);
      const userEmail = userWithProfile?.email;
      const userNickname = (userWithProfile as any)?.profile?.nickname || '회원';

      await userRepository.softDeleteUser(req.user.userId);

      if (userEmail) {
        emailService.sendWithdrawalNotification(userEmail, userNickname).catch((err: unknown) => logger.error('Withdrawal email notification failed', { error: err instanceof Error ? err.message : String(err) }));
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = updateProfileSchema.parse(req.body);
      const profile = await userService.updateProfile(req.user.userId, input);

      res.json({
        success: true,
        data: { profile },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const allUsers = await userRepository.findAllWithProfiles();
      
      // 각 사용자의 활성 구독 정보 가져오기
      const usersWithSubscriptions = await Promise.all(
        allUsers.map(async (user) => {
          const activeSubscription = await db.query.subscriptions.findFirst({
            where: (subs, { eq, and }) => and(
              eq(subs.userId, user.id),
              eq(subs.status, 'active')
            ),
          });
          const isWithdrawn = !!user.deletedAt;
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            deletedAt: user.deletedAt,
            profile: user.profile,
            hasActiveSubscription: !!activeSubscription,
            isActive: user.isActive ?? true,
            isWithdrawn,
            status: isWithdrawn ? 'withdrawn' : (user.isActive ? 'active' : 'suspended'),
          };
        })
      );
      
      res.json({
        success: true,
        data: { users: usersWithSubscriptions },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserPayments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'userId is required' },
        });
      }

      const { paymentService } = await import('../services/payment.service');
      const payments = await paymentService.getPayments(userId);
      const subscriptions = await paymentService.getSubscriptions(userId);
      
      // 결제와 구독을 연결
      const paymentsWithSubscriptions = payments.map((payment) => {
        const subscription = subscriptions.find((sub) => sub.id === payment.subscriptionId);
        return {
          ...payment,
          subscription: subscription || null,
        };
      });
      
      res.json({
        success: true,
        data: { payments: paymentsWithSubscriptions },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'userId is required' },
        });
      }

      // Check if user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      // Prevent deleting admin users
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot delete admin users' },
        });
      }

      // Soft delete user
      await userRepository.softDeleteUser(userId);

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }

      const { userId } = req.params;
      const { isActive } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'userId is required' },
        });
      }

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'isActive must be a boolean' },
        });
      }

      // Check if user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        });
      }

      // Prevent changing admin user status
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot change admin user status' },
        });
      }

      // Update user status
      const updated = await userService.updateUserStatus(userId, isActive);

      res.json({
        success: true,
        data: {
          user: {
            id: updated.id,
            email: updated.email,
            isActive: updated.isActive,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
