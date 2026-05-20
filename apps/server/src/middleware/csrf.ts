import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://teum--iteraon.replit.app',
]);

function isAllowedOrigin(origin: string): boolean {
  // 정확 일치만 허용 (substring 매칭은 유사도메인 우회 위험 → app.ts CORS 와 동일 정책).
  if (ALLOWED_ORIGINS.has(origin)) return true;
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.replace(/:\d+$/, '');
  if (devDomain && origin === `https://${devDomain}`) return true;
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && origin === frontendUrl) return true;
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin && origin === corsOrigin) return true;
  return false;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): Response | void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const checkPath = req.originalUrl || req.path;
  if (
    checkPath.startsWith('/api/payments/nicepay/') ||
    checkPath.startsWith('/api/payments/paypal/return') ||
    checkPath.startsWith('/api/payments/paypal/cancel') ||
    checkPath.startsWith('/api/payments/paypal/webhook') ||
    checkPath.startsWith('/api/payments/apple/webhook') ||
    checkPath.startsWith('/api/auth/apple/callback') ||
    req.path.startsWith('/payments/nicepay/') ||
    req.path.startsWith('/payments/paypal/return') ||
    req.path.startsWith('/payments/paypal/cancel') ||
    req.path.startsWith('/payments/paypal/webhook') ||
    req.path.startsWith('/payments/apple/webhook') ||
    req.path.startsWith('/auth/apple/callback')
  ) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin) {
    if (isAllowedOrigin(origin)) {
      return next();
    }
    // Origin: 'null' 은 sandboxed iframe / file:// / 일부 webview redirect 컨텍스트에서 나온다.
    // 무조건 허용하면 쿠키 기반 CSRF 우회 위험이 있으므로, **Authorization: Bearer 토큰이 있는 경우에만** 통과시킨다.
    // (CSRF 공격은 cross-site 요청에 사용자의 Bearer 토큰을 임의로 첨부할 수 없다.
    //  쿠키만 자동 첨부되므로, Bearer 가 있다는 것은 우리 모바일/Capacitor 클라이언트가 명시적으로 호출한 것.)
    if (origin === 'null') {
      const auth = req.headers.authorization;
      if (typeof auth === 'string' && /^Bearer\s+\S+/i.test(auth)) {
        return next();
      }
    }
    logger.warn({ origin, path: req.path }, 'CSRF: blocked request with disallowed origin');
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Request blocked' },
    });
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isAllowedOrigin(refOrigin)) {
        return next();
      }
    } catch {}
    logger.warn({ referer, path: req.path }, 'CSRF: blocked request with disallowed referer');
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Request blocked' },
    });
  }

  return next();
}
