import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { processPaymentSchema } from '../validations/payment';
import { logger } from '../config/logger';

export class PaymentController {
  async initPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { amount, planName, paymentMethod } = req.body;
      if (!amount || !planName || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'amount, planName, paymentMethod are required' },
        });
      }

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'amount must be a positive number' },
        });
      }

      const allowedMethods = ['CARD'];
      if (!allowedMethods.includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid payment method' },
        });
      }

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/return`;

      const result = await paymentService.initPayment(req.user.userId, {
        amount: Number(amount),
        planName,
        paymentMethod,
      });

      res.json({
        success: true,
        data: {
          ...result,
          returnUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async initBillingKey(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { planName, paymentMethod, amount, identityVerified } = req.body;
      if (!planName || !paymentMethod || !amount) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'planName, paymentMethod, amount are required' },
        });
      }

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'amount must be a positive number' },
        });
      }

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/billing-return`;

      const result = await paymentService.initBillingKeyRegistration(req.user.userId, {
        planName,
        paymentMethod,
        amount: numericAmount,
        identityVerified: !!identityVerified,
      });

      res.json({
        success: true,
        data: {
          ...result,
          returnUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async nicepayBillingReturn(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    try {
      const body = req.body;
      const bodyKeys = Object.keys(body);
      logger.info({
        bodyKeys: bodyKeys.join(', '),
        bodyRaw: JSON.stringify(body),
        hasAuthToken: !!body.authToken,
        hasEncData: !!body.encData,
        hasBid: !!body.bid,
        hasTid: !!body.tid,
        authResultCode: body.authResultCode,
        resultCode: body.resultCode,
        authResultMsg: body.authResultMsg,
        resultMsg: body.resultMsg,
        orderId: body.orderId,
        amount: body.amount,
        authTokenLength: body.authToken?.length || 0,
        encDataLength: body.encData?.length || 0,
        bidValue: body.bid || 'none',
      }, 'NicePay billing return FULL body');

      const resultCode = body.authResultCode || body.resultCode;
      const resultMsg = body.authResultMsg || body.resultMsg;
      const { orderId, amount } = body;
      const authToken = body.authToken || body.encData;
      let bid = body.bid;

      logger.info({
        resultCode,
        resultMsg,
        hasBid: !!bid,
        hasAuthToken: !!authToken,
        authTokenPreview: authToken ? `${authToken.substring(0, 20)}...` : 'none',
        orderId,
        amount,
      }, 'NicePay billing return parsed');

      if (!orderId) {
        logger.error('NicePay billing return missing orderId');
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('주문 정보가 누락되었습니다.')}`);
      }

      if (resultCode !== '0000') {
        await paymentService.deletePendingSession(orderId);
        logger.error(`NicePay billing auth failed - code=${resultCode} msg=${resultMsg}`);
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(resultMsg || '빌링키 등록에 실패했습니다.')}`);
      }

      if (!bid && authToken) {
        const numericAmount = Number(amount) || 0;
        const issueResult = await paymentService.issueBillingKey(authToken, orderId, numericAmount);
        if (issueResult.success && issueResult.bid) {
          bid = issueResult.bid;
        } else {
          await paymentService.deletePendingSession(orderId);
          logger.error({ orderId, errorMsg: issueResult.message }, 'NicePay billing key issue failed');
          return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(issueResult.message || '빌링키 발급에 실패했습니다.')}`);
        }
      }

      if (!bid) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay billing return missing bid and authToken', { orderId });
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('빌링키 정보가 누락되었습니다.')}`);
      }

      const result = await paymentService.processBillingKeyReturn(
        bid,
        orderId
      );

      if (result.success) {
        return res.redirect(`${frontendUrl}/payment/success`);
      } else {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(result.message)}`);
      }
    } catch (error) {
      logger.error('NicePay billing return handler error', { error });
      return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('빌링키 등록 처리 중 오류가 발생했습니다.')}`);
    }
  }

  async nicepayReturn(req: Request, res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    try {
      const body = req.body;
      logger.info('NicePay return FULL body', { body: JSON.stringify(body) });
      const resultCode = body.authResultCode || body.resultCode;
      const resultMsg = body.authResultMsg || body.resultMsg;
      const { tid, orderId, amount, authToken } = body;

      logger.info(`NicePay return - code=${resultCode} msg=${resultMsg} tid=${tid} orderId=${orderId} amount=${amount}`);

      if (!orderId) {
        logger.error('NicePay return missing orderId');
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('주문 정보가 누락되었습니다.')}`);
      }

      if (resultCode !== '0000') {
        await paymentService.deletePendingSession(orderId);
        logger.error(`NicePay auth failed - code=${resultCode} msg=${resultMsg} orderId=${orderId}`);
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(resultMsg || '결제 인증에 실패했습니다.')}`);
      }

      if (!tid) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay return missing tid', { orderId });
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 거래 정보가 누락되었습니다.')}`);
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        await paymentService.deletePendingSession(orderId);
        logger.error('NicePay return invalid amount', { orderId, amount });
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 금액 정보가 올바르지 않습니다.')}`);
      }

      const result = await paymentService.approveNicePayPayment(
        tid,
        orderId,
        parsedAmount
      );

      if (result.success) {
        return res.redirect(`${frontendUrl}/payment/success`);
      } else {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(result.message)}`);
      }
    } catch (error) {
      logger.error('NicePay return handler error', { error });
      return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`);
    }
  }

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

  async needsVerification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const needsVerification = await paymentService.needsIdentityVerification(req.user.userId);
      res.json({
        success: true,
        data: { needsVerification },
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

  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { subscriptionId } = req.body;
      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'subscriptionId is required' },
        });
      }

      const result = await paymentService.cancelSubscription(req.user.userId, subscriptionId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async adminCancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { userId, subscriptionId } = req.body;
      if (!userId || !subscriptionId) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'userId and subscriptionId are required' },
        });
      }

      const result = await paymentService.cancelSubscription(userId, subscriptionId);
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
