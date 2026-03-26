import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { logger } from '../config/logger';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number;
}

export function generateAccessToken(payload: JWTPayload): string {
  try {
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
      logger.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET in environment variables for production.');
    }
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '15m', // 15 minutes
    });
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
}

export function generateRefreshToken(payload: JWTPayload): string {
  try {
    if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'your-refresh-secret-key-change-in-production') {
      logger.warn('WARNING: Using default JWT_REFRESH_SECRET. Set JWT_REFRESH_SECRET in environment variables for production.');
    }
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: '7d', // 7 days
    });
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}
