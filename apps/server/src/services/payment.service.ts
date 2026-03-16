import { db } from '../db';
import { payments, subscriptions } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../config/logger';
import { ProcessPaymentInput } from '../validations/payment';
import { nicePayProvider } from './payment/nicepay.provider';

/**
 * Payment Service
 * 
 * Handles payment processing using Nice Payments.
 * Supports both test and production modes.
 */
export class PaymentService {
  /**
   * Process a payment using Nice Payments.
   */
  async processPayment(
    userId: string,
    input: ProcessPaymentInput
  ): Promise<{
    success: boolean;
    payment: {
      id: string;
      status: string;
      amount: string;
      paymentMethod: string | null;
      transactionId: string | null;
    };
    subscription?: {
      id: string;
      status: string;
      planName: string;
    };
    message?: string;
  }> {
    logger.info('Processing payment with Nice Payments', { userId, input });

    // Generate unique order ID
    const orderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;

    // Build payment method string for Nice Payments
    // Note: This is for internal tracking, actual payment method is still the enum
    let paymentMethodStr: string = input.paymentMethod;
    if (input.paymentMethod === 'card' && input.cardCompany) {
      paymentMethodStr = `card_${input.cardCompany}`;
    } else if (input.paymentMethod === 'easy_pay' && input.easyPayProvider) {
      paymentMethodStr = `easy_pay_${input.easyPayProvider}`;
    }

    // Call Nice Payments API
    const nicePayResponse = await nicePayProvider.approvePayment({
      amount: input.amount,
      orderId,
      goodsName: input.planName,
      buyerName: undefined, // Can be added from user profile
      buyerEmail: undefined, // Can be added from user profile
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
      notifyUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/payments/webhook`,
    });

    if (!nicePayResponse.success) {
      logger.error('Nice Payments approval failed', {
        orderId,
        errorCode: nicePayResponse.errorCode,
        errorMsg: nicePayResponse.errorMsg,
      });

      // Create failed payment record
      const [payment] = await db
        .insert(payments)
        .values({
          userId,
          status: 'failed',
          amount: input.amount.toString(),
          currency: 'KRW',
          paymentMethod: paymentMethodStr,
          transactionId: nicePayResponse.tid || orderId,
          paidAt: null,
        })
        .returning();

      return {
        success: false,
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          transactionId: payment.transactionId,
        },
        message: nicePayResponse.errorMsg || '결제에 실패했습니다.',
      };
    }

    // Create successful payment record
    const [payment] = await db
      .insert(payments)
      .values({
        userId,
        status: 'completed',
        amount: input.amount.toString(),
        currency: 'KRW',
        paymentMethod: paymentMethodStr,
        transactionId: nicePayResponse.tid || orderId,
        paidAt: new Date(),
      })
      .returning();

    // Create subscription if this is a subscription payment
    let subscription = null;
    if (input.planName) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          userId,
          status: 'active',
          planName: input.planName,
          amount: input.amount.toString(),
          currency: 'KRW',
          startDate,
          endDate,
        })
        .returning();

      // Link payment to subscription
      await db
        .update(payments)
        .set({ subscriptionId: newSubscription.id })
        .where(eq(payments.id, payment.id));

      subscription = newSubscription;
    }

    logger.info('Payment processed successfully', {
      paymentId: payment.id,
      transactionId: nicePayResponse.tid,
    });

    return {
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            planName: subscription.planName,
          }
        : undefined,
      message: nicePayResponse.resultMsg || '결제가 완료되었습니다.',
    };
  }

  /**
   * Get all payments for a user.
   */
  async getPayments(userId: string) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  /**
   * Get all subscriptions for a user.
   */
  async getSubscriptions(userId: string) {
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  /**
   * Cancel payment (refund)
   */
  async cancelPayment(
    userId: string,
    tid: string,
    amount: number,
    reason: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info('Cancelling payment', { userId, tid, amount });

    // Find payment by transaction ID
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionId, tid))
      .limit(1);

    if (!payment || payment.userId !== userId) {
      throw new Error('Payment not found or unauthorized');
    }

    if (payment.status !== 'completed') {
      throw new Error('Only completed payments can be cancelled');
    }

    // Call Nice Payments cancel API
    const cancelResponse = await nicePayProvider.cancelPayment(tid, amount, reason);

    if (!cancelResponse.success) {
      logger.error('Nice Payments cancellation failed', {
        tid,
        errorCode: cancelResponse.errorCode,
        errorMsg: cancelResponse.errorMsg,
      });
      throw new Error(cancelResponse.errorMsg || '결제 취소에 실패했습니다.');
    }

    // Update payment status
    await db
      .update(payments)
      .set({ status: 'refunded', updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    logger.info('Payment cancelled successfully', { paymentId: payment.id, tid });

    return {
      success: true,
      message: cancelResponse.resultMsg || '결제가 취소되었습니다.',
    };
  }
}

export const paymentService = new PaymentService();
