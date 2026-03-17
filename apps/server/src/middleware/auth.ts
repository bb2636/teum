import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, generateAccessToken, JWTPayload } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): Response | void {
  try {
    // Get token from httpOnly cookie
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
      // Verify token
      const payload = verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error) {
      // If access token is invalid, try to refresh
      const refreshToken = req.cookies?.refreshToken;
      
      if (refreshToken) {
        try {
          const refreshPayload = verifyRefreshToken(refreshToken);
          const newAccessToken = generateAccessToken({
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
          });

          // Set new access token
          res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60 * 1000, // 15 minutes
          });

          req.user = {
            userId: refreshPayload.userId,
            email: refreshPayload.email,
            role: refreshPayload.role,
          };
          next();
        } catch (refreshError) {
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
