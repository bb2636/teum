import { Request, Response, NextFunction } from 'express';
import { adapter } from '../storage';
import { logger } from '../config/logger';
import { buildSignedUrl } from '../utils/signed-url';

export class UploadController {
  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'No file provided' },
        });
      }

      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Only image files are allowed' },
        });
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'File size must be less than 50MB' },
        });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const extension = file.originalname.split('.').pop() || 'jpg';
      const filename = `${req.user.userId}/${timestamp}-${randomStr}.${extension}`;

      const url = await adapter.upload(file.buffer, filename, file.mimetype);
      const signedUrl = buildSignedUrl(url.replace(/^\/storage\//, ''), 86400 * 365);

      logger.info('Image uploaded successfully', { userId: req.user.userId, filename });

      res.json({
        success: true,
        data: { url, signedUrl },
      });
    } catch (error) {
      logger.error('Upload error:', error);
      next(error);
    }
  }
}

export const uploadController = new UploadController();
