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
  const statusCode = (err as ApiError).statusCode || 500;

  const userId = (req as Request & { user?: { userId?: string } }).user?.userId;

  const errorDetails = {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    name: err.name,
    statusCode,
    ...(userId ? { userId } : {}),
    ...(Object.keys(req.query).length ? { query: req.query } : {}),
  };

  if (statusCode >= 500) {
    logger.error(errorDetails, 'Unhandled error');
  } else {
    logger.warn(errorDetails, 'Request error');
  }

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

  // DB compute quota exceeded → 503 Service Unavailable
  const errMsg = err.message || '';
  if (errMsg.includes('compute time quota') || errMsg.includes('exceeded the compute')) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: '서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.',
      },
    });
  }

  const code = (err as ApiError).code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

  let safeMessage: string;
  if (statusCode >= 500) {
    // 5xx 도 AppError 처럼 expose:true 가 명시된 경우엔 메시지를 노출한다.
    // (예: PayPal 502 "잠시 후 다시 시도해주세요" / Apple 503 "결제는 완료, 재시도 안내" 같이
    //  사용자에게 행동 가이드를 제공하기 위해 의도적으로 작성된 한글 메시지.)
    // 그 외 raw Error / 알 수 없는 5xx 는 generic 으로 가린다.
    if (isExposable(err) && err.message) {
      safeMessage = err.message;
    } else {
      safeMessage = 'Internal server error';
    }
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
