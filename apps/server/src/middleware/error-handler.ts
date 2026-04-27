import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  expose?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  expose: boolean;

  constructor(message: string, options?: { statusCode?: number; code?: string; expose?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = options?.statusCode ?? 400;
    this.code = options?.code ?? 'APP_ERROR';
    this.expose = options?.expose ?? true;
  }
}

const GENERIC_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Authentication required',
  403: 'Forbidden',
  404: 'Resource not found',
  405: 'Method not allowed',
  408: 'Request timeout',
  409: 'Conflict',
  410: 'Gone',
  413: 'Payload too large',
  415: 'Unsupported media type',
  422: 'Unprocessable entity',
  429: 'Too many requests',
};

function isExposable(err: ApiError | Error): boolean {
  const apiErr = err as ApiError;
  // AppError defaults to expose:true but can be overridden to false; honor the explicit flag
  return apiErr.expose === true;
}

export function errorHandler(
  err: ApiError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response | void {
  const errorDetails = {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    name: err.name,
  };

  logger.error(errorDetails, 'Unhandled error');

  // Ensure response hasn't been sent
  if (res.headersSent) {
    return;
  }

  // Handle Zod validation errors (always expose details — they are user-correctable)
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors,
      },
    });
  }

  const statusCode = (err as ApiError).statusCode || 500;
  const code = (err as ApiError).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

  let safeMessage: string;
  if (statusCode >= 500) {
    safeMessage = 'Internal server error';
  } else if (isExposable(err)) {
    // Explicitly safe to surface
    safeMessage = err.message || GENERIC_MESSAGES[statusCode] || 'Request failed';
  } else {
    // Default to generic message — do not leak internal/raw error text
    safeMessage = GENERIC_MESSAGES[statusCode] || 'Request failed';
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: safeMessage,
    },
  });
}
