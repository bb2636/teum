import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../utils/performance-monitor';
import { logger } from '../config/logger';

/**
 * Middleware to track API endpoint performance
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Override res.end to capture response time (래핑으로 오버로드 시그니처는 any로 단언)
  const originalEnd = res.end.bind(res);
  res.end = function (...args: unknown[]) {
    const duration = Date.now() - startTime;
    try {
      performanceMonitor.recordEndpoint(
        req.path,
        req.method,
        duration,
        res.statusCode
      );
    } catch (e) {
      logger.error({ err: e }, 'Performance monitor recordEndpoint failed');
    }
    return originalEnd(...(args as Parameters<typeof originalEnd>));
  } as typeof res.end;

  next();
}
