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
   * 결제 연동 전: PAYMENT_MOCK_SUCCESS=true 이면 NicePay 호출 없이 구독만 생성 후 성공 처리.
   * 다음 결제일 = 구독 endDate(갱신일) 기준으로 노출 가능.
   */
  private isPaymentMockSuccess(): boolean {
    return process.env.PAYMENT_MOCK_SUCCESS === 'true';
  }

  /**
   * 활성 구독 1건 조회 (다음 결제일 등 노출용).
   */
  async getActiveSubscription(userId: string) {
    const subs = await this.getSubscriptions(userId);
    const now = new Date();
    return subs.find(
      (s) => s.status === 'active' && (!s.endDate || new Date(s.endDate) >= now)
    ) ?? null;
  }

  /**
   * Process a payment using Nice Payments.
   * PAYMENT_MOCK_SUCCESS=true 이면 실제 PG 호출 없이 결제·구독만 생성 후 성공 반환.
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
      nextPaymentDate?: string; // ISO string, 다음 결제/갱신일
    };
    message?: string;
  }> {
    logger.info('Processing payment', { userId, input, mock: this.isPaymentMockSuccess() });

    const isRenewal = !!(input as any).isRenewal;
    if (input.planName && !isRenewal) {
      const activeSubscription = await this.getActiveSubscription(userId);
      if (activeSubscription) {
        logger.warn('User already has active subscription', { userId, existingSubscriptionId: activeSubscription.id });
        throw new Error('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.');
      }
    }

    const orderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;
    let paymentMethodStr: string = input.paymentMethod;
    if (input.paymentMethod === 'card' && input.cardCompany) {
      paymentMethodStr = `card_${input.cardCompany}`;
    } else if (input.paymentMethod === 'easy_pay' && input.easyPayProvider) {
      paymentMethodStr = `easy_pay_${input.easyPayProvider}`;
    }

    // 결제 연동 전: 모크 모드면 PG 호출 없이 바로 성공 처리
    if (this.isPaymentMockSuccess()) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const [payment] = await db
        .insert(payments)
        .values({
          userId,
          status: 'completed',
          amount: input.amount.toString(),
          currency: 'KRW',
          paymentMethod: paymentMethodStr,
          transactionId: orderId,
          paidAt: startDate,
        })
        .returning();

      let subscription: { id: string; status: string; planName: string; endDate: Date | null } | null = null;
      if (input.planName) {
        const [newSub] = await db
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

        await db
          .update(payments)
          .set({ subscriptionId: newSub.id })
          .where(eq(payments.id, payment.id));

        subscription = newSub;
      }

      logger.info('Payment processed (mock success)', { paymentId: payment.id });

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
              nextPaymentDate: subscription.endDate ? new Date(subscription.endDate).toISOString() : undefined,
            }
          : undefined,
        message: '결제가 완료되었습니다.',
      };
    }

    // 실제 PG 연동
    const nicePayResponse = await nicePayProvider.approvePayment({
      amount: input.amount,
      orderId,
      goodsName: input.planName,
      buyerName: undefined,
      buyerEmail: undefined,
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
      notifyUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/payments/webhook`,
    });

    if (!nicePayResponse.success) {
      logger.error('Nice Payments approval failed', {
        orderId,
        errorCode: nicePayResponse.errorCode,
        errorMsg: nicePayResponse.errorMsg,
      });

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

      if (paymentMethodStr.startsWith('card') || paymentMethodStr.startsWith('easy_pay')) {
        const activeSubscription = await this.getActiveSubscription(userId);
        if (activeSubscription) {
          await db
            .update(subscriptions)
            .set({
              status: 'cancelled',
              cancelledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, activeSubscription.id));
          logger.info('Subscription auto-cancelled due to payment failure', {
            subscriptionId: activeSubscription.id,
            paymentId: payment.id,
          });
        }
      }

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

    let subscription: { id: string; status: string; planName: string; endDate?: Date | null } | null = null;
    if (input.planName) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

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
            nextPaymentDate: subscription.endDate ? new Date(subscription.endDate).toISOString() : undefined,
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

  /**
   * Cancel subscription (구독 취소)
   */
  async cancelSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info('Cancelling subscription', { userId, subscriptionId });

    // Find subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription || subscription.userId !== userId) {
      throw new Error('Subscription not found or unauthorized');
    }

    if (subscription.status === 'cancelled') {
      return {
        success: true,
        message: '이미 취소된 구독입니다.',
      };
    }

    if (subscription.status !== 'active') {
      throw new Error('Only active subscriptions can be cancelled');
    }

    // Update subscription status to cancelled
    await db
      .update(subscriptions)
      .set({ 
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(subscriptions.id, subscriptionId));

    logger.info('Subscription cancelled successfully', { subscriptionId });

    return {
      success: true,
      message: '구독이 취소되었습니다.',
    };
  }
}

export const paymentService = new PaymentService();
