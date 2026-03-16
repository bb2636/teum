import { Request, Response, NextFunction } from 'express';
import { supportService } from '../services/support.service';
import { createInquirySchema } from '../validations/support';

export class SupportController {
  async createInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = createInquirySchema.parse(req.body);
      const inquiry = await supportService.createInquiry(req.user.userId, input);

      res.status(201).json({
        success: true,
        data: { inquiry },
      });
    } catch (error) {
      next(error);
    }
  }

  async getInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const inquiries = await supportService.getInquiries(req.user.userId);
      res.json({
        success: true,
        data: { inquiries },
      });
    } catch (error) {
      next(error);
    }
  }

  async getInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const inquiry = await supportService.getInquiry(req.params.id, req.user.userId);
      res.json({
        success: true,
        data: { inquiry },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const supportController = new SupportController();
