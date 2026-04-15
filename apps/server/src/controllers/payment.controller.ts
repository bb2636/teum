import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';
import { processPaymentSchema } from '../validations/payment';
import { logger } from '../config/logger';
import { getExchangeInfo } from '../utils/currency';
import { refundService } from '../services/payment/refund.service';
import { paypalProvider } from '../services/payment/paypal.provider';
import crypto from 'crypto';

export class PaymentController {
  async getPlanPrice(req: Request, res: Response, next: NextFunction) {
    try {
      const exchangeInfo = await getExchangeInfo();
      res.json({
        success: true,
        data: {
          usd: exchangeInfo.usd,
          krw: exchangeInfo.krw,
          rate: exchangeInfo.rate,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async initPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const { planName, paymentMethod } = req.body;
      if (!planName || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'planName, paymentMethod are required' },
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

      const { planName, paymentMethod, identityVerified } = req.body;
      if (!planName || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'planName, paymentMethod are required' },
        });
      }

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
      const returnUrl = `${backendUrl}/api/payments/nicepay/billing-return`;

      const result = await paymentService.initBillingKeyRegistration(req.user.userId, {
        planName,
        paymentMethod,
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
        hasAuthToken: !!body.authToken,
        hasEncData: !!body.encData,
        hasBid: !!body.bid,
        hasTid: !!body.tid,
        authResultCode: body.authResultCode,
        authResultMsg: body.authResultMsg,
        orderId: body.orderId,
        amount: body.amount,
      }, 'NicePay billing return received');

      const resultCode = body.authResultCode || body.resultCode;
      const resultMsg = body.authResultMsg || body.resultMsg;
      const { orderId, amount, tid } = body;
      const authToken = body.authToken || body.encData;
      let bid = body.bid;

      logger.info({
        resultCode,
        resultMsg,
        hasBid: !!bid,
        hasTid: !!tid,
        hasAuthToken: !!authToken,
        orderId,
        amount,
      }, 'NicePay billing return parsed');

      if (!orderId) {
        logger.error('NicePay billing return missing orderId');
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('주문 정보가 누락되었습니다.')}`);
      }

      const preloadedSession = await paymentService.getPendingSession(orderId);
      if (!preloadedSession) {
        logger.error({ orderId }, 'NicePay billing return: session not found at entry');
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('결제 세션을 찾을 수 없습니다. 다시 시도해주세요.')}`);
      }

      logger.info({ orderId, sessionUserId: preloadedSession.userId, sessionAmount: preloadedSession.amount }, 'Session preloaded for billing return');

      if (resultCode !== '0000') {
        await paymentService.deletePendingSession(orderId);
        logger.error(`NicePay billing auth failed - code=${resultCode} msg=${resultMsg}`);
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(resultMsg || '빌링키 등록에 실패했습니다.')}`);
      }

      if (!bid && authToken && tid) {
        const numericAmount = Number(amount) || 0;
        const issueResult = await paymentService.issueBillingKey(authToken, tid, orderId, numericAmount);
        if (issueResult.success && issueResult.bid) {
          bid = issueResult.bid;
        } else if (issueResult.success && issueResult.paidWithoutBid) {
          logger.info({ orderId, tid: issueResult.tid }, 'Payment approved without bid - processing as direct payment');
          const directResult = await paymentService.processDirectPaymentReturn(
            orderId,
            issueResult.tid || tid,
            issueResult.cardCode,
            issueResult.cardName,
            issueResult.cardNo,
            { userId: preloadedSession.userId, amount: preloadedSession.amount, planName: preloadedSession.planName }
          );
          if (directResult.success) {
            return res.redirect(`${frontendUrl}/payment/success`);
          } else {
            return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(directResult.message)}`);
          }
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
      logger.info({ bodyKeys: Object.keys(body).join(', ') }, 'NicePay return received');
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

  async initPayPal(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
      }

      const userId = req.user.userId;
      const planName = 'Music Plan Monthly';

      const backendUrl = process.env.BACKEND_URL || process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;

      const result = await paymentService.initPayPalPayment(
        userId,
        planName,
        backendUrl
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async paypalReturn(req: Request, res: Response, _next: NextFunction) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    try {
      const { subscription_id: paypalSubscriptionId, oid: internalOrderId } = req.query;

      if (!paypalSubscriptionId || !internalOrderId) {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('PayPal subscription information is missing.')}`);
      }

      const result = await paymentService.activatePayPalSubscription(
        paypalSubscriptionId as string,
        internalOrderId as string
      );

      if (result.success) {
        return res.redirect(`${frontendUrl}/payment/success`);
      } else {
        return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent(result.message)}`);
      }
    } catch (error) {
      logger.error({ error }, 'PayPal return processing failed');
      return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('PayPal subscription processing failed.')}`);
    }
  }

  async paypalCancel(req: Request, res: Response, _next: NextFunction) {
    const frontendUrl = process.env.FRONTEND_URL || `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`;
    const { token: paypalOrderId } = req.query;
    logger.info({ paypalOrderId }, 'PayPal payment cancelled by user');
    return res.redirect(`${frontendUrl}/payment/fail?message=${encodeURIComponent('Payment was cancelled.')}`);
  }

  async paypalWebhook(req: Request, res: Response) {
    const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

    if (!PAYPAL_WEBHOOK_ID) {
      logger.error('PAYPAL_WEBHOOK_ID not configured, rejecting webhook');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!rawBody) {
      logger.error('PayPal webhook: missing raw body');
      return res.status(400).json({ error: 'Missing request body' });
    }

    const verified = await paypalProvider.verifyWebhookSignature(
      req.headers,
      rawBody,
      PAYPAL_WEBHOOK_ID
    );

    if (!verified) {
      logger.warn({ headers: {
        authAlgo: req.headers['paypal-auth-algo'],
        transmissionId: req.headers['paypal-transmission-id'],
      }}, 'PayPal webhook signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.error('PayPal webhook: invalid JSON body');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const eventType = event.event_type as string;
    const eventId = event.id as string;

    if (!eventId || !eventType) {
      logger.error({ event }, 'PayPal webhook: missing event_type or id');
      return res.status(400).json({ error: 'Missing event_type or id' });
    }

    const REFUND_EVENTS = ['PAYMENT.SALE.REFUNDED', 'PAYMENT.SALE.REVERSED'];

    if (!REFUND_EVENTS.includes(eventType)) {
      logger.info({ eventType, eventId }, 'PayPal webhook: non-refund event, acknowledging');
      return res.status(200).json({ status: 'acknowledged' });
    }

    const resource = event.resource as Record<string, unknown> | undefined;
    if (!resource) {
      logger.error({ eventId, eventType }, 'PayPal webhook: missing resource');
      return res.status(400).json({ error: 'Missing resource' });
    }

    const saleId = (resource.id as string) || '';
    const billingAgreementId = resource.billing_agreement_id as string | undefined;
    const amountObj = resource.amount as Record<string, unknown> | undefined;
    const amount = amountObj?.total as string | undefined;
    const currency = amountObj?.currency as string | undefined;

    const result = await refundService.processPayPalRefund({
      eventId,
      eventType,
      saleId,
      billingAgreementId,
      amount,
      currency,
      rawPayload: rawBody,
    });

    logger.info({
      eventId,
      eventType,
      saleId,
      billingAgreementId,
      processed: result.processed,
      reason: result.reason,
    }, 'PayPal refund webhook handled');

    return res.status(200).json({ status: result.reason });
  }

  async nicepayWebhook(req: Request, res: Response) {
    const NICEPAY_WEBHOOK_SECRET = process.env.NICEPAY_WEBHOOK_SECRET;

    if (!NICEPAY_WEBHOOK_SECRET) {
      logger.error('NICEPAY_WEBHOOK_SECRET not configured, rejecting webhook');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    const signatureHeader = req.headers['x-nicepay-signature'] as string | undefined;
    const rawBody = (req as Request & { rawBody?: string }).rawBody;

    if (!rawBody) {
      logger.error('NicePay webhook: missing raw body');
      return res.status(400).json({ error: 'Missing request body' });
    }

    if (!signatureHeader) {
      logger.warn('NicePay webhook: missing x-nicepay-signature header');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const expectedSig = crypto
      .createHmac('sha256', NICEPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signatureHeader);
    const expectedBuffer = Buffer.from(expectedSig);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      logger.warn('NicePay webhook: signature verification failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const body = req.body;
    const { tid, orderId, resultCode, resultMsg, cancelAmt, mallReserved } = body;

    if (!tid) {
      logger.error('NicePay webhook: missing tid');
      return res.status(400).json({ error: 'Missing tid' });
    }

    const eventId = body.cancelNum || body.tid || `nicepay_${Date.now()}`;

    const result = await refundService.processNicePayRefund({
      eventId,
      tid,
      orderId,
      amount: cancelAmt || body.amount,
      resultCode: resultCode || '0000',
      resultMsg,
      rawPayload: rawBody,
    });

    logger.info({
      eventId,
      tid,
      orderId,
      processed: result.processed,
      reason: result.reason,
    }, 'NicePay refund webhook handled');

    return res.status(200).json({ status: result.reason });
  }
}

export const paymentController = new PaymentController();
