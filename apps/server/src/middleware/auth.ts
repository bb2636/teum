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
      req.user = payload;
      next();
    } catch (error) {
      const refreshToken = req.cookies?.refreshToken;
      
      if (refreshToken) {
        try {
          const refreshPayload = verifyRefreshToken(refreshToken);

          const currentVersion = await userRepository.getTokenVersion(refreshPayload.userId);
          if (currentVersion === null || refreshPayload.tokenVersion === undefined || refreshPayload.tokenVersion !== currentVersion) {
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

          const newAccessToken = generateAccessToken({
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
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
          };
          next();
        } catch (refreshError) {
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
