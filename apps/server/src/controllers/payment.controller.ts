import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { processPaymentSchema } from '../validations/payment';

export class PaymentController {
  async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const input = processPaymentSchema.parse(req.body);
      const result = await paymentService.processPayment(req.user.userId, input);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const payments = await paymentService.getPayments(req.user.userId);
      res.json({
        success: true,
        data: { payments },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const subscriptions = await paymentService.getSubscriptions(req.user.userId);
      res.json({
        success: true,
        data: { subscriptions },
      });
    } catch (error) {
      next(error);
    }
  }

  async cancelPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { tid, amount, reason } = req.body;
      if (!tid || !amount || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'tid, amount, reason are required' },
        });
      }

      const result = await paymentService.cancelPayment(req.user.userId, tid, amount, reason);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
