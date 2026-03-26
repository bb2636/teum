import jwt from 'jsonwebtoken';
import { logger } from '../config/logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion?: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return secret;
}

export function generateAccessToken(payload: JWTPayload): string {
  try {
    return jwt.sign(payload, getJwtSecret(), {
      expiresIn: '15m',
    });
  } catch (error) {
    logger.error('Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
}

export function generateRefreshToken(payload: JWTPayload): string {
  try {
    return jwt.sign(payload, getJwtRefreshSecret(), {
      expiresIn: '7d',
    });
  } catch (error) {
    logger.error('Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJwtRefreshSecret()) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}
