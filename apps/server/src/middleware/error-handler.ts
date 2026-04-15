import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
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

  // Handle Zod validation errors
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
  const code = (err as ApiError).code || 'INTERNAL_SERVER_ERROR';

  const safeMessage = statusCode >= 500
    ? 'Internal server error'
    : err.message || 'An error occurred';

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: safeMessage,
    },
  });
}
