import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
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

const mobileAuthTokens = new Map<string, { accessToken: string; refreshToken: string; user: { id: string; role: string }; expiresAt: number }>();

function sendMobileCloseBrowserPage(res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teum</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#665146;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:white;text-align:center}.c{padding:20px}h2{font-size:20px;margin-bottom:16px}p{font-size:14px;opacity:0.8;line-height:1.6}.btn{display:inline-block;margin-top:24px;padding:14px 40px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.6);border-radius:24px;color:white;text-decoration:none;font-size:15px;font-weight:500;cursor:pointer}</style></head>
<body><div class="c"><h2>로그인 완료!</h2><p>뒤로가기(←)를 눌러<br>앱으로 돌아가주세요.</p></div>
<script>try{window.close();}catch(e){}</script></body></html>`);
}

function sendMobileDeepLinkPage(res: Response, deepLinkUrl: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teum</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#665146;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:white;text-align:center}.c{padding:20px}h2{font-size:18px;margin-bottom:12px}p{font-size:14px;opacity:0.8;margin-bottom:20px}.btn{display:inline-block;padding:12px 32px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.6);border-radius:24px;color:white;text-decoration:none;font-size:14px;cursor:pointer}</style></head>
<body><div class="c"><h2>로그인 처리 중...</h2><p id="msg">자동으로 앱으로 이동합니다.</p><a id="openBtn" class="btn" href="${deepLinkUrl}">앱으로 돌아가기</a></div>
<script>
(function(){
  var deepLink="${deepLinkUrl}";
  var tried=0;
  function tryOpen(){
    tried++;
    if(tried>3){document.getElementById("msg").textContent="아래 버튼을 눌러 앱으로 돌아가세요.";return;}
    window.location.href=deepLink;
    setTimeout(function(){if(!document.hidden){tryOpen();}},1500);
  }
  var btn=document.getElementById("openBtn");
  if(btn){btn.addEventListener("click",function(e){e.preventDefault();tried=0;window.location.href=deepLink;});}
  setTimeout(tryOpen,300);
})();
</script></body></html>`);
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of mobileAuthTokens) {
    if (val.expiresAt < now) mobileAuthTokens.delete(key);
  }
}, 60_000);

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
        tokenVersion: currentVersion,
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


  async appleOAuthInit(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = process.env.APPLE_CLIENT_ID || 'app.teum.teum1';
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.get('host') || '';
      const redirectUri = `${proto}://${host}/api/auth/apple/callback`;
      const scope = 'name email';
      const state = (req.query.state as string) || `nonce=${randomUUID()}`;

      const authUrl = `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&response_mode=form_post&state=${encodeURIComponent(state)}`;

      return res.redirect(authUrl);
    } catch (error) {
      logger.error({ err: error }, 'Apple OAuth init error');
      return res.redirect('/splash?error=apple_init_failed');
    }
  }

  async googleOAuthInit(req: Request, res: Response, next: NextFunction) {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return res.redirect('/splash?error=not_configured');
      }
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.get('host') || '';
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;
      const scope = 'openid email profile';
      const state = (req.query.state as string) || `nonce=${randomUUID()}`;

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=select_account&state=${encodeURIComponent(state)}`;

      return res.redirect(authUrl);
    } catch (error) {
      logger.error({ err: error }, 'Google OAuth init error');
      return res.redirect('/splash?error=google_init_failed');
    }
  }

  async googleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.query;
      const isMobile = typeof state === 'string' && state.includes('platform=mobile');
      const stateNonce = typeof state === 'string' ? new URLSearchParams(state).get('nonce') : null;

      if (!code || typeof code !== 'string') {
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=no_code');
        return res.redirect('/splash?error=no_code');
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=not_configured');
        return res.redirect('/splash?error=not_configured');
      }

      const proto = req.get('x-forwarded-proto') || req.protocol;
      const host = req.get('host');
      const redirectUri = `${proto}://${host}/api/auth/google/callback`;
      logger.info({ redirectUri, host, proto }, 'Google OAuth callback - exchanging code for token');
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
      logger.info({ hasIdToken: !!tokenData.id_token, error: tokenData.error }, 'Google token exchange result');
      if (!tokenData.id_token) {
        logger.error({ tokenError: tokenData.error, tokenErrorDesc: tokenData.error_description, redirectUri }, 'Google token exchange failed');
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=token_exchange_failed');
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
        if (isMobile && stateNonce) {
          mobileAuthTokens.set(`onboarding:${stateNonce}`, {
            accessToken: '',
            refreshToken: '',
            user: { id: '', role: 'user' },
            expiresAt: Date.now() + 5 * 60 * 1000,
            onboardingData: Object.fromEntries(params),
          } as any);
          return sendMobileCloseBrowserPage(res);
        }
        return res.redirect(`/social-onboarding?${params.toString()}`);
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      if (isMobile) {
        const tokenKey = stateNonce || randomUUID();
        logger.info({ tokenKey: tokenKey.substring(0, 8), userId: loginResult.user.id }, 'Google OAuth: storing mobile token for exchange');
        mobileAuthTokens.set(tokenKey, {
          accessToken: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          user: { id: loginResult.user.id, role: loginResult.user.role },
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        return sendMobileCloseBrowserPage(res);
      }

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

      if (loginResult.user.role === 'admin') {
        return res.redirect('/login-redirect?to=/admin');
      }
      return res.redirect('/login-redirect');
    } catch (error) {
      logger.error({ err: error }, 'Google OAuth callback error');
      return res.redirect('/splash?error=login_failed');
    }
  }

  async appleOAuthCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const code = (req.body?.code || req.query?.code) as string | undefined;
      const stateParam = (req.body?.state || req.query?.state) as string | undefined;
      const isMobile = typeof stateParam === 'string' && stateParam.includes('platform=mobile');
      const appleNonce = typeof stateParam === 'string' ? new URLSearchParams(stateParam).get('nonce') : null;
      const userJson = req.body?.user as string | undefined;
      if (!code) {
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=no_code');
        return res.redirect('/splash?error=no_code');
      }

      const teamId = process.env.APPLE_TEAM_ID;
      const keyId = process.env.APPLE_KEY_ID;
      const privateKey = process.env.APPLE_PRIVATE_KEY;
      const clientId = process.env.APPLE_CLIENT_ID || process.env.VITE_APPLE_CLIENT_ID;
      if (!teamId || !keyId || !privateKey || !clientId) {
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=apple_not_configured');
        return res.redirect('/splash?error=apple_not_configured');
      }

      let formattedKey = privateKey.replace(/\\n/g, '\n');
      if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----`;
      }
      formattedKey = formattedKey
        .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
        .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
        .replace(/\n{2,}/g, '\n');

      const now = Math.floor(Date.now() / 1000);
      const clientSecret = jwtLib.sign(
        { iss: teamId, iat: now, exp: now + 600, aud: 'https://appleid.apple.com', sub: clientId },
        formattedKey,
        { algorithm: 'ES256', header: { alg: 'ES256', kid: keyId } }
      );

      const appleProto = req.get('x-forwarded-proto') || req.protocol;
      const redirectUri = `${appleProto}://${req.get('host')}/api/auth/apple/callback`;
      logger.info({ redirectUri, host: req.get('host'), proto: appleProto }, 'Apple OAuth callback - exchanging code for token');
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

      const tokenData = await tokenResponse.json() as { id_token?: string; error?: string; error_description?: string };
      if (!tokenData.id_token) {
        logger.error({ error: tokenData.error, errorDescription: tokenData.error_description, redirectUri, clientId }, 'Apple token exchange failed');
        if (isMobile) return sendMobileDeepLinkPage(res, 'com.teum.app://auth-callback?error=apple_token_failed');
        return res.redirect('/splash?error=apple_token_failed');
      }

      let userData: { email?: string; name?: { firstName?: string; lastName?: string } } | undefined;
      if (userJson) {
        try { userData = JSON.parse(userJson); } catch (e) { logger.warn('Failed to parse Apple user JSON', { error: e instanceof Error ? e.message : String(e) }); }
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
        if (isMobile && appleNonce) {
          mobileAuthTokens.set(`onboarding:${appleNonce}`, {
            accessToken: '',
            refreshToken: '',
            user: { id: '', role: 'user' },
            expiresAt: Date.now() + 5 * 60 * 1000,
            onboardingData: Object.fromEntries(params),
          } as any);
          return sendMobileCloseBrowserPage(res);
        }
        return res.redirect(`/social-onboarding?${params.toString()}`);
      }

      const loginResult = result as { accessToken: string; refreshToken: string; isNewUser: false; user: { id: string; email: string; role: string } };

      if (isMobile) {
        const tokenKey = appleNonce || randomUUID();
        logger.info({ tokenKey: tokenKey.substring(0, 8), userId: loginResult.user.id }, 'Apple OAuth: storing mobile token for exchange');
        mobileAuthTokens.set(tokenKey, {
          accessToken: loginResult.accessToken,
          refreshToken: loginResult.refreshToken,
          user: { id: loginResult.user.id, role: loginResult.user.role },
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        return sendMobileCloseBrowserPage(res);
      }

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

      if (loginResult.user.role === 'admin') {
        return res.redirect('/login-redirect?to=/admin');
      }
      return res.redirect('/login-redirect');
    } catch (error) {
      logger.error({ err: error }, 'Apple OAuth callback error');
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

  async exchangeMobileToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.body;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Token is required' } });
      }

      const onboardingKey = token.startsWith('onboarding:') ? token : `onboarding:${token}`;
      const loginKey = token.startsWith('onboarding:') ? token.replace('onboarding:', '') : token;

      const onboardingStored = mobileAuthTokens.get(onboardingKey) as any;
      if (onboardingStored && onboardingStored.expiresAt >= Date.now() && onboardingStored.onboardingData) {
        mobileAuthTokens.delete(onboardingKey);
        logger.info({ token: loginKey.substring(0, 8) }, 'Mobile token exchange: onboarding data returned');
        return res.json({ success: true, data: { onboardingData: onboardingStored.onboardingData } });
      }

      const loginStored = mobileAuthTokens.get(loginKey) as any;
      if (!loginStored || loginStored.expiresAt < Date.now()) {
        if (loginStored) mobileAuthTokens.delete(loginKey);
        if (onboardingStored) mobileAuthTokens.delete(onboardingKey);
        logger.info({ token: loginKey.substring(0, 8) }, 'Mobile token exchange: not found or expired');
        return res.status(404).json({ success: false, error: { code: 'TOKEN_NOT_FOUND', message: 'Token not ready or expired' } });
      }

      mobileAuthTokens.delete(loginKey);
      logger.info({ token: loginKey.substring(0, 8), role: loginStored.user?.role }, 'Mobile token exchange: login success');

      res.cookie('accessToken', loginStored.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', loginStored.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ success: true, data: { role: loginStored.user.role } });
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
