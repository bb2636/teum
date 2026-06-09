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

  async checkEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Email is required' },
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.json({
          success: true,
          data: { available: false, reason: 'invalid_format' },
        });
      }

      const existingUser = await userRepository.findByEmailIncludingDeleted(email);
      if (existingUser) {
        if (existingUser.deletedAt) {
          const deletedAt = new Date(existingUser.deletedAt);
          const oneYearLater = new Date(deletedAt);
          oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
          if (new Date() < oneYearLater) {
            return res.json({
              success: true,
              data: { available: false, reason: 'withdrawn' },
            });
          }
        } else {
          return res.json({
            success: true,
            data: { available: false, reason: 'duplicate' },
          });
        }
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
      const userNickname = userWithProfile?.profile?.nickname || '회원';
      const userLang = userWithProfile?.profile?.language || 'ko';

      await userRepository.softDeleteUser(req.user.userId);

      if (userEmail) {
        emailService.sendWithdrawalNotification(userEmail, userNickname, userLang).catch((err: unknown) => logger.error('Withdrawal email notification failed', { error: err instanceof Error ? err.message : String(err) }));
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

      // 결제(payments) 레코드가 없는 구독도 관리자 「구독 상세 내역」에 보이도록
      // 구독 기반 합성 이력을 추가한다.
      // (예: 관리자가 상태를 수동 보정했거나, 결제행 없이 구독행만 생성된 경우)
      // pending 구독은 아직 확정된 이력이 아니므로 제외한다.
      const paidSubscriptionIds = new Set(
        payments.map((p) => p.subscriptionId).filter((id): id is string => !!id)
      );
      const subscriptionOnlyEntries = subscriptions
        .filter((sub) => !paidSubscriptionIds.has(sub.id) && sub.status !== 'pending')
        .map((sub) => ({
          id: `subscription-${sub.id}`,
          userId: sub.userId,
          subscriptionId: sub.id,
          // 프론트 상태 라벨은 payment.status='completed' + subscription.status 로 결정되므로
          // 합성 결제 상태는 'completed' 로 두고 실제 라벨은 구독 상태가 결정한다.
          status: 'completed' as const,
          amount: sub.amount,
          currency: sub.currency,
          paymentMethod: sub.appleProductId ? 'apple' : sub.paypalSubscriptionId ? 'paypal' : null,
          transactionId: null,
          paidAt: sub.startDate,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
          subscription: sub,
          derivedFromSubscription: true as const,
        }));

      // 결제일(paidAt 우선, 없으면 createdAt) 기준 최신순 정렬
      const combined = [...paymentsWithSubscriptions, ...subscriptionOnlyEntries].sort((a, b) => {
        const at = new Date(a.paidAt ?? a.createdAt).getTime();
        const bt = new Date(b.paidAt ?? b.createdAt).getTime();
        return bt - at;
      });

      res.json({
        success: true,
        data: { payments: combined },
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
