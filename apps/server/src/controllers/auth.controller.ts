import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import {
  signupSchema,
  loginSchema,
  phoneVerificationRequestSchema,
  phoneVerificationConfirmSchema,
} from '../validations/auth';
import { verifyRefreshToken, generateAccessToken } from '../utils/jwt';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate input
      const input = signupSchema.parse(req.body);

      // Create user
      const result = await authService.signup(input);

      // Set httpOnly cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
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
      console.log('Login attempt:', { email: req.body.email });
      
      // Validate input
      const input = loginSchema.parse(req.body);
      console.log('Input validated');

      // Login
      const result = await authService.login(input);
      console.log('Login successful:', { userId: result.user.id });

      // Set httpOnly cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.json({
        success: true,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      
      // Handle authentication errors with 401 status
      if (error instanceof Error && (
        error.message.includes('Invalid email or password') ||
        error.message.includes('이메일 또는 비밀번호')
      )) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '이메일 또는 비밀번호가 올바르지 않습니다.',
          },
        });
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
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      next(error);
    }
  }

  async logout(req: Request, res: Response) {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
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
}

export const authController = new AuthController();
