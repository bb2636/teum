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

  // Admin: Get all inquiries
  async getAllInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      const inquiries = await supportService.getAllInquiries();
      res.json({
        success: true,
        data: { inquiries },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get inquiry by ID
  async getInquiryById(req: Request, res: Response, next: NextFunction) {
    try {
      const inquiry = await supportService.getInquiryById(req.params.id);
      res.json({
        success: true,
        data: { inquiry },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Inquiry not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Inquiry not found' },
        });
      }
      next(error);
    }
  }

  // Admin: Update inquiry answer
  async updateInquiryAnswer(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { answer } = req.body;
      if (!answer || typeof answer !== 'string' || !answer.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Answer is required' },
        });
      }

      const inquiry = await supportService.updateInquiryAnswer(
        req.params.id,
        answer.trim(),
        req.user.userId
      );

      res.json({
        success: true,
        data: { inquiry },
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Inquiry not found') {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Inquiry not found' },
        });
      }
      next(error);
    }
  }
  async getUncheckedCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await supportService.getUncheckedCount();
      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  async markChecked(req: Request, res: Response, next: NextFunction) {
    try {
      await supportService.markInquiriesChecked();
      res.json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const supportController = new SupportController();
