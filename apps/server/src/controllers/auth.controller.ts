import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import {
  signupSchema,
  loginSchema,
  phoneVerificationRequestSchema,
  phoneVerificationConfirmSchema,
  emailVerificationRequestSchema,
  emailVerificationConfirmSchema,
} from '../validations/auth';
import { verifyRefreshToken, generateAccessToken } from '../utils/jwt';
import { logger } from '../config/logger';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate input
      const input = signupSchema.parse(req.body);

      // Create user
      const result = await authService.signup(input);

      // Set httpOnly cookies (path: '/' so cookie is sent for all /api/* requests)
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      logger.debug('Login attempt', { email: req.body.email });
      
      // Validate input
      const input = loginSchema.parse(req.body);
      logger.debug('Input validated');

      // Login
      const result = await authService.login(input);
      logger.info('Login successful', { userId: result.user.id, email: result.user.email });

      // Set httpOnly cookies (path: '/' so cookie is sent for all /api/* requests)
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      logger.error('Login error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      
      // Handle authentication errors with 401 status
      if (error instanceof Error) {
        if (error.message.includes('계정이 정지되었습니다')) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'ACCOUNT_SUSPENDED',
              message: '계정이 정지되었습니다. 관리자에게 문의하세요.',
            },
          });
        }
        if (error.message.includes('Invalid email or password') ||
            error.message.includes('이메일 또는 비밀번호')) {
          return res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_CREDENTIALS',
              message: '이메일 또는 비밀번호가 올바르지 않습니다.',
            },
          });
        }
      }
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const refreshToken = req.cookies?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Refresh token not found',
          },
        });
      }

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      // Set new access token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.json({
        success: true,
        data: {
          user: {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
          },
        },
      });
    } catch (error) {
      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });
      next(error);
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  async requestPhoneVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const input = phoneVerificationRequestSchema.parse(req.body);
      const result = await authService.requestPhoneVerification(input);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmPhoneVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const input = phoneVerificationConfirmSchema.parse(req.body);
      const result = await authService.confirmPhoneVerification(input);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkEmailExists(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.query;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Email is required',
          },
        });
      }
      const result = await authService.checkEmailExists(email);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async requestEmailVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const input = emailVerificationRequestSchema.parse(req.body);
      const result = await authService.requestEmailVerification(input);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('이미 존재하는 이메일')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  async confirmEmailVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const input = emailVerificationConfirmSchema.parse(req.body);
      const result = await authService.confirmEmailVerification(input);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
