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
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.replit.dev') || origin.endsWith('.replit.app')) {
    const devDomain = process.env.REPLIT_DEV_DOMAIN?.replace(/:\d+$/, '');
    if (devDomain && origin.includes(devDomain)) return true;
    if (origin.includes('teum')) return true;
  }
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
