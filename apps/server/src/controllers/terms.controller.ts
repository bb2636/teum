import { Request, Response, NextFunction } from 'express';
import { termsService } from '../services/terms.service';
import { z } from 'zod';

const updateTermsSchema = z.object({
  content: z.string().min(1, 'Content is required'),
});

export class TermsController {
  // Get service terms (public)
  async getServiceTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const terms = await termsService.getTerms('service');
      
      if (!terms) {
        return res.json({
          success: true,
          data: {
            title: '서비스 이용약관',
            content: '',
            version: '1.0',
            updatedAt: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          title: '서비스 이용약관',
          content: terms.content,
          version: terms.version,
          updatedAt: terms.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get privacy policy (public)
  async getPrivacyPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const terms = await termsService.getTerms('privacy');
      
      if (!terms) {
        return res.json({
          success: true,
          data: {
            title: '개인정보 처리방침',
            content: '',
            version: '1.0',
            updatedAt: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          title: '개인정보 처리방침',
          content: terms.content,
          version: terms.version,
          updatedAt: terms.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Get service terms
  async getAdminServiceTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const terms = await termsService.getTerms('service');
      
      if (!terms) {
        return res.json({
          success: true,
          data: {
            type: 'service',
            title: '서비스 이용약관',
            content: '',
            version: '1.0',
            updatedAt: null,
            createdAt: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          type: 'service',
          title: '서비스 이용약관',
          content: terms.content || '',
          version: terms.version || '1.0',
          updatedAt: terms.updatedAt ? terms.updatedAt.toISOString() : null,
          createdAt: terms.createdAt ? terms.createdAt.toISOString() : null,
        },
      });
    } catch (error) {
      console.error('Error fetching service terms:', error);
      // Return default instead of throwing error
      res.json({
        success: true,
        data: {
          type: 'service',
          title: '서비스 이용약관',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        },
      });
    }
  }

  // Admin: Get privacy policy
  async getAdminPrivacyPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const terms = await termsService.getTerms('privacy');
      
      if (!terms) {
        return res.json({
          success: true,
          data: {
            type: 'privacy',
            title: '개인정보 처리방침',
            content: '',
            version: '1.0',
            updatedAt: null,
            createdAt: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          type: 'privacy',
          title: '개인정보 처리방침',
          content: terms.content || '',
          version: terms.version || '1.0',
          updatedAt: terms.updatedAt ? terms.updatedAt.toISOString() : null,
          createdAt: terms.createdAt ? terms.createdAt.toISOString() : null,
        },
      });
    } catch (error) {
      console.error('Error fetching privacy policy:', error);
      // Return default instead of throwing error
      res.json({
        success: true,
        data: {
          type: 'privacy',
          title: '개인정보 처리방침',
          content: '',
          version: '1.0',
          updatedAt: null,
          createdAt: null,
        },
      });
    }
  }

  // Admin: Update service terms
  async updateServiceTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateTermsSchema.parse(req.body);
      const incrementVersion = req.query.autoSave !== 'true'; // Only increment version if not auto-save
      const terms = await termsService.createOrUpdateTerms('service', input.content, incrementVersion);

      res.json({
        success: true,
        data: {
          type: 'service',
          title: '서비스 이용약관',
          content: terms.content,
          version: terms.version,
          updatedAt: terms.updatedAt,
          createdAt: terms.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update privacy policy
  async updatePrivacyPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateTermsSchema.parse(req.body);
      const incrementVersion = req.query.autoSave !== 'true'; // Only increment version if not auto-save
      const terms = await termsService.createOrUpdateTerms('privacy', input.content, incrementVersion);

      res.json({
        success: true,
        data: {
          type: 'privacy',
          title: '개인정보 처리방침',
          content: terms.content,
          version: terms.version,
          updatedAt: terms.updatedAt,
          createdAt: terms.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const termsController = new TermsController();
