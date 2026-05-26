import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, JWTPayload } from '../utils/jwt';
import { userRepository } from '../repositories/user.repository';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// tokenVersion 캐시 (Neon DB quota 절감용)
// - tokenVersion 은 사용자가 로그아웃/타기기 로그인/비번 변경 시에만 증가한다.
// - 30초 지연을 허용하면 매 API 요청마다 DB 를 때리는 부하를 거의 0 으로 줄일 수 있다.
// - per-user generation 으로 race condition 방지:
//   invalidate 이후 도착한 in-flight DB 결과가 stale 값으로 캐시를 덮어쓰는 것을 막는다.
const TOKEN_VERSION_TTL_MS = 30_000;
const tokenVersionCache = new Map<string, { v: number | null; exp: number; gen: number }>();
const tokenVersionGen = new Map<string, number>();

function currentGen(userId: string): number {
  return tokenVersionGen.get(userId) ?? 0;
}

export async function getTokenVersionCached(userId: string): Promise<number | null> {
  const now = Date.now();
  const hit = tokenVersionCache.get(userId);
  if (hit && hit.exp > now && hit.gen === currentGen(userId)) return hit.v;

  // 스냅샷 generation 으로 race-safe write
  const genAtStart = currentGen(userId);
  const v = await userRepository.getTokenVersion(userId);
  // invalidate 가 이 사이에 일어났다면(gen 증가) 캐시에 쓰지 않는다 — 다음 요청에서 다시 조회
  if (currentGen(userId) === genAtStart) {
    tokenVersionCache.set(userId, { v, exp: now + TOKEN_VERSION_TTL_MS, gen: genAtStart });
  }
  // 메모리 누수 방지: 캐시 크기 제한 (단순 LRU 대체)
  if (tokenVersionCache.size > 5000) {
    const firstKey = tokenVersionCache.keys().next().value;
    if (firstKey) tokenVersionCache.delete(firstKey);
  }
  return v;
}

/**
 * 사용자의 tokenVersion 이 변경되었을 때(로그아웃/타기기 로그인/비번 변경) 호출.
 * generation 을 증가시켜 in-flight 캐시 write 와 기존 캐시 모두 무효화한다.
 */
export function invalidateTokenVersionCache(userId: string): void {
  tokenVersionGen.set(userId, currentGen(userId) + 1);
  tokenVersionCache.delete(userId);
}

/**
 * 새 tokenVersion 을 즉시 캐시에 반영 (로그인/refresh 직후 호출용).
 * generation 을 함께 증가시켜 진행 중인 stale 조회를 무력화한다.
 */
export function setTokenVersionCache(userId: string, version: number): void {
  const newGen = currentGen(userId) + 1;
  tokenVersionGen.set(userId, newGen);
  tokenVersionCache.set(userId, { v: version, exp: Date.now() + TOKEN_VERSION_TTL_MS, gen: newGen });
}

const clearAuthCookies = (res: Response) => {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', cookieOpts);
  res.clearCookie('refreshToken', cookieOpts);
};

const SESSION_EXPIRED_RESPONSE = {
  success: false,
  error: {
    code: 'SESSION_EXPIRED',
    message: '다른 기기에서 로그인되어 현재 세션이 만료되었습니다.',
  },
};

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    try {
      const payload = verifyAccessToken(token);

      const currentVersion = await getTokenVersionCached(payload.userId);
      if (currentVersion === null || payload.tokenVersion === undefined || payload.tokenVersion !== currentVersion) {
        // 캐시가 stale 일 수 있으니 한 번 더 DB 직접 조회로 확인 (false-positive 로그아웃 방지)
        const freshVersion = await userRepository.getTokenVersion(payload.userId);
        if (freshVersion !== null) setTokenVersionCache(payload.userId, freshVersion);
        if (freshVersion === null || payload.tokenVersion === undefined || payload.tokenVersion !== freshVersion) {
          clearAuthCookies(res);
          return res.status(401).json(SESSION_EXPIRED_RESPONSE);
        }
      }

      req.user = payload;
      next();
    } catch (error) {
      const refreshToken = req.cookies?.refreshToken;
      
      if (refreshToken) {
        try {
          const refreshPayload = verifyRefreshToken(refreshToken);

          const currentVersion = await getTokenVersionCached(refreshPayload.userId);
          if (currentVersion === null || refreshPayload.tokenVersion === undefined || refreshPayload.tokenVersion !== currentVersion) {
            clearAuthCookies(res);
            return res.status(401).json(SESSION_EXPIRED_RESPONSE);
          }

          const newAccessToken = generateAccessToken({
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
            tokenVersion: currentVersion,
          });

          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 15 * 60 * 1000,
          });

          req.user = {
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
            tokenVersion: currentVersion,
          };
          next();
        } catch (refreshError) {
          clearAuthCookies(res);
          return res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Invalid or expired token',
            },
          });
        }
      } else {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
        });
      }
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error instanceof Error ? error.message : 'Invalid token',
      },
    });
  }
}

/**
 * Optional auth middleware: populates req.user if a valid token is present,
 * but never rejects the request. Intended for routes that must remain public
 * but want to bind state to the authenticated user when available.
 * Mirrors authenticate's refresh-token fallback so users with expired access
 * tokens but valid refresh tokens are still recognized.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const currentVersion = await getTokenVersionCached(payload.userId);
        if (currentVersion !== null && payload.tokenVersion !== undefined && payload.tokenVersion === currentVersion) {
          req.user = payload;
          return next();
        }
      } catch {
        // Fall through to refresh attempt
      }
    }

    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const refreshPayload = verifyRefreshToken(refreshToken);
        const currentVersion = await getTokenVersionCached(refreshPayload.userId);
        if (currentVersion !== null && refreshPayload.tokenVersion !== undefined && refreshPayload.tokenVersion === currentVersion) {
          const newAccessToken = generateAccessToken({
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
            tokenVersion: currentVersion,
          });
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 15 * 60 * 1000,
          });
          req.user = {
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
            tokenVersion: currentVersion,
          };
        }
      } catch {
        // Ignore — leave req.user undefined
      }
    }
  } catch {
    // Defensive: never block the request from optional auth
  }
  return next();
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
}
