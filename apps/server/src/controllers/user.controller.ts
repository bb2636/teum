import { Request, Response, NextFunction } from 'express';
import { userRepository } from '../repositories/user.repository';
import { userService } from '../services/user.service';
import { authenticate } from '../middleware/auth';
import { eq, isNull } from 'drizzle-orm';
import { users } from '../db/schema';
import { updateProfileSchema } from '../validations/user';

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

      // Soft delete user
      await userRepository.softDeleteUser(req.user.userId);

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

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
}

export const userController = new UserController();
