import { Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../utils/performance-monitor';

/**
 * Middleware to track API endpoint performance
 */
export function performanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (chunk?: unknown, encoding?: unknown) {
    const duration = Date.now() - startTime;

    performanceMonitor.recordEndpoint(
      req.path,
      req.method,
      duration,
      res.statusCode
    );

    // Call original end
    originalEnd.call(this, chunk, encoding);
  };

  next();
}
