import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import {
  signupSchema,
  loginSchema,
  phoneVerificationRequestSchema,
  phoneVerificationConfirmSchema,
  emailVerificationRequestSchema,
  emailVerificationConfirmSchema,
  socialOnboardingSchema,
  appleOAuthCallbackSchema,
} from '../validations/auth';
import { verifyRefreshToken, generateAccessToken } from '../utils/jwt';
import { logger } from '../config/logger';
import jwtLib from 'jsonwebtoken';
import { getClientIp, detectCountryFromIp } from '../utils/ip-geolocation';
import { userRepository } from '../repositories/user.repository';

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate input
      const input = signupSchema.parse(req.body);

      // IP 기반 국가 감지 (country가 제공되지 않은 경우)
      let detectedCountry = input.country;
      if (!detectedCountry) {
        const clientIp = getClientIp(req);
        detectedCountry = await detectCountryFromIp(clientIp) || undefined;
        logger.info('Detected country from IP', { ip: clientIp, country: detectedCountry });
      }

      // Create user with detected country
      const result = await authService.signup({
        ...input,
        country: detectedCountry,
      });

      // Set httpOnly cookies (path: '/' so cookie is sent for all /api/* requests)
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      // Login
      const result = await authService.login(input);
      logger.info('Login successful', { userId: result.user.id, email: result.user.email });

      // Set httpOnly cookies (path: '/' so cookie is sent for all /api/* requests)
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

      const payload = verifyRefreshToken(refreshToken);

      const currentVersion = await userRepository.getTokenVersion(payload.userId);
      if (currentVersion === null || payload.tokenVersion === undefined || payload.tokenVersion !== currentVersion) {
        const cookieOpts = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
          path: '/',
        };
        res.clearCookie('accessToken', cookieOpts);
        res.clearCookie('refreshToken', cookieOpts);
        return res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: '다른 기기에서 로그인되어 현재 세션이 만료되었습니다.',
          },
        });
      }

      const accessToken = generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      // Set new access token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
        path: '/',
      };
      res.clearCookie('accessToken', cookieOpts);
      res.clearCookie('refreshToken', cookieOpts);
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired token',
        },
      });
    }
  }

  async logout(req: Request, res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
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

  async requestEmailVerificationForPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const input = emailVerificationRequestSchema.parse(req.body);
      const result = await authService.requestEmailVerificationForPasswordReset(input);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('존재하지 않는 이메일')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_NOT_FOUND',
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'idToken is required' },
        });
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      const result = await authService.googleLogin(idToken);

      if (result.isNewUser) {
        return res.json({
          success: true,
          data: {
            isNewUser: true,
            onboardingToken: result.onboardingToken,
            socialProfile: result.socialProfile,
          },
        });
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      res.cookie('accessToken', loginResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        data: {
          isNewUser: false,
          user: loginResult.user,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('정지')) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: error.message },
        });
      }
      next(error);
    }
  }

  private sendMobileCloseResponse(res: Response, message: string = '로그인 완료') {
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${message}</title></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#665146;color:white"><div style="text-align:center"><p style="font-size:18px">${message}</p><p style="font-size:14px;opacity:0.7">이 창을 닫아주세요</p></div></body></html>`);
  }

  async googleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      const isMobile = typeof state === 'string' && state.includes('platform=mobile');

      if (!code || typeof code !== 'string') {
        return res.redirect('/splash?error=no_code');
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return res.redirect('/splash?error=not_configured');
      }

      const proto = req.get('x-forwarded-proto') || req.protocol;
      const redirectUri = `${proto}://${req.get('host')}/api/auth/google/callback`;
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json() as { id_token?: string; error?: string; error_description?: string };
      if (!tokenData.id_token) {
        logger.error({ tokenError: tokenData.error, tokenErrorDesc: tokenData.error_description, redirectUri }, 'Google token exchange failed');
        return res.redirect('/splash?error=token_exchange_failed');
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      const result = await authService.googleLogin(tokenData.id_token);

      if (result.isNewUser) {
        const params = new URLSearchParams({
          isNewUser: 'true',
          onboardingToken: result.onboardingToken || '',
          provider: 'google',
          email: result.socialProfile?.email || '',
          name: result.socialProfile?.name || '',
          picture: result.socialProfile?.picture || '',
          providerAccountId: result.socialProfile?.providerAccountId || '',
        });
        return res.redirect(`/social-onboarding?${params.toString()}`);
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      res.cookie('accessToken', loginResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      if (isMobile) {
        return this.sendMobileCloseResponse(res, '로그인 완료');
      }

      if (loginResult.user.role === 'admin') {
        return res.redirect('/admin');
      }
      return res.redirect('/home');
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect('/splash?error=login_failed');
    }
  }

  async appleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = (req.body?.code || req.query?.code) as string | undefined;
      const userJson = req.body?.user as string | undefined;
      const stateParam = (req.body?.state || req.query?.state) as string | undefined;
      const isMobile = typeof stateParam === 'string' && stateParam.includes('platform=mobile');
      if (!code) {
        return res.redirect('/splash?error=no_code');
      }

      const teamId = process.env.APPLE_TEAM_ID;
      const keyId = process.env.APPLE_KEY_ID;
      const privateKey = process.env.APPLE_PRIVATE_KEY;
      const clientId = process.env.APPLE_CLIENT_ID || process.env.VITE_APPLE_CLIENT_ID;
      if (!teamId || !keyId || !privateKey || !clientId) {
        return res.redirect('/splash?error=apple_not_configured');
      }

      const now = Math.floor(Date.now() / 1000);
      const clientSecret = jwtLib.sign(
        { iss: teamId, iat: now, exp: now + 600, aud: 'https://appleid.apple.com', sub: clientId },
        privateKey.replace(/\\n/g, '\n'),
        { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId } }
      );

      const appleProto = req.get('x-forwarded-proto') || req.protocol;
      const redirectUri = `${appleProto}://${req.get('host')}/api/auth/apple/callback`;
      const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json() as { id_token?: string };
      if (!tokenData.id_token) {
        return res.redirect('/splash?error=apple_token_failed');
      }

      let userData: { email?: string; name?: { firstName?: string; lastName?: string } } | undefined;
      if (userJson) {
        try { userData = JSON.parse(userJson); } catch {}
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      const result = await authService.appleLogin(tokenData.id_token, userData);

      if (result.isNewUser) {
        const params = new URLSearchParams({
          isNewUser: 'true',
          onboardingToken: result.onboardingToken || '',
          provider: 'apple',
          email: result.socialProfile?.email || '',
          name: result.socialProfile?.name || '',
          providerAccountId: result.socialProfile?.providerAccountId || '',
          isEmailHidden: result.socialProfile?.isEmailHidden ? 'true' : 'false',
        });
        return res.redirect(`/social-onboarding?${params.toString()}`);
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      res.cookie('accessToken', loginResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      if (isMobile) {
        return this.sendMobileCloseResponse(res, '로그인 완료');
      }

      if (loginResult.user.role === 'admin') {
        return res.redirect('/admin');
      }
      return res.redirect('/home');
    } catch (error) {
      console.error('Apple OAuth callback error:', error);
      return res.redirect('/splash?error=apple_login_failed');
    }
  }

  async appleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = appleOAuthCallbackSchema.parse(req.body);

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/' });

      const result = await authService.appleLogin(parsed.idToken, parsed.user);

      if (result.isNewUser) {
        return res.json({
          success: true,
          data: {
            isNewUser: true,
            onboardingToken: result.onboardingToken,
            socialProfile: result.socialProfile,
          },
        });
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      res.cookie('accessToken', loginResult.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', loginResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        data: {
          isNewUser: false,
          user: loginResult.user,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('정지')) {
        return res.status(403).json({
          success: false,
          error: { code: 'ACCOUNT_SUSPENDED', message: error.message },
        });
      }
      next(error);
    }
  }

  async socialOnboarding(req: Request, res: Response, next: NextFunction) {
    try {
      const input = socialOnboardingSchema.parse(req.body);

      let detectedCountry = input.country;
      if (!detectedCountry) {
        const clientIp = getClientIp(req);
        detectedCountry = await detectCountryFromIp(clientIp) || undefined;
      }

      const result = await authService.socialOnboarding({
        ...input,
        country: detectedCountry,
      });

      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        success: true,
        data: { user: result.user },
      });
    } catch (error) {
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
