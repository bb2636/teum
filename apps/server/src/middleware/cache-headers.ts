import { Request, Response, NextFunction } from 'express';

export function setCacheHeaders(req: Request, res: Response, next: NextFunction) {
  // Set cache headers for GET requests
  if (req.method === 'GET') {
    // Allow client-side caching for 5 minutes
    res.set('Cache-Control', 'private, max-age=300');
    // Include ETag for conditional requests
    res.set('ETag', `"${Date.now()}"`);
  }
  next();
}
