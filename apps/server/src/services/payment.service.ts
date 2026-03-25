import { db } from '../db';
import { payments, subscriptions, paymentSessions } from '../db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';
import { logger } from '../config/logger';
import { ProcessPaymentInput } from '../validations/payment';
import { nicePayProvider } from './payment/nicepay.provider';

setInterval(async () => {
  try {
    await db.delete(paymentSessions).where(lt(paymentSessions.expiresAt, new Date()));
  } catch (e) {
    logger.error('Failed to cleanup expired payment sessions', { error: e });
  }
}, 5 * 60 * 1000);

export class PaymentService {
  private isPaymentMockSuccess(): boolean {
    return process.env.PAYMENT_MOCK_SUCCESS === 'true';
  }

  async getActiveSubscription(userId: string) {
    const subs = await this.getSubscriptions(userId);
    const now = new Date();
    const activeSub = subs.find(
      (s) => s.status === 'active' && (!s.endDate || new Date(s.endDate) >= now)
    );
    if (activeSub) return activeSub;
    return subs.find(
      (s) => s.status === 'cancelled' && s.endDate && new Date(s.endDate) >= now
    ) ?? null;
  }

  async initPayment(
    userId: string,
    input: { amount: number; planName: string; paymentMethod: string }
  ) {
    const isRenewal = false;
    if (!isRenewal) {
      const activeSubscription = await this.getActiveSubscription(userId);
      if (activeSubscription) {
        throw new Error('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.');
      }
    }

    const orderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(paymentSessions).values({
      orderId,
      userId,
      amount: input.amount.toString(),
      planName: input.planName,
      paymentMethod: input.paymentMethod,
      expiresAt,
    });

    const clientId = nicePayProvider.getClientId();

    const nicepayMethodMap: Record<string, string> = {
      CARD: 'card',
      BANK: 'bank',
      CELLPHONE: 'cellphone',
    };

    return {
      clientId,
      orderId,
      amount: input.amount,
      goodsName: input.planName,
      method: nicepayMethodMap[input.paymentMethod] || 'card',
      isTestMode: nicePayProvider.getIsTestMode(),
    };
  }

  async getPendingSession(orderId: string) {
    const [session] = await db
      .select()
      .from(paymentSessions)
      .where(eq(paymentSessions.orderId, orderId))
      .limit(1);
    if (!session || session.expiresAt < new Date()) return null;
    return session;
  }

  async deletePendingSession(orderId: string) {
    await db.delete(paymentSessions).where(eq(paymentSessions.orderId, orderId));
  }

  async approveNicePayPayment(
    tid: string,
    orderId: string,
    amount: number
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const session = await this.getPendingSession(orderId);
    if (!session) {
      logger.error('Payment session not found', { orderId });
      return { success: false, message: '결제 세션을 찾을 수 없습니다.' };
    }

    if (Number(session.amount) !== amount) {
      logger.error('Payment amount mismatch', {
        orderId,
        expected: session.amount,
        received: amount,
      });
      return { success: false, message: '결제 금액이 일치하지 않습니다.' };
    }

    const approvalResult = await nicePayProvider.approvePayment(tid, amount);

    if (!approvalResult.success) {
      logger.error('NicePay approval failed', {
        orderId,
        tid,
        errorCode: approvalResult.errorCode,
        errorMsg: approvalResult.errorMsg,
      });

      await db.insert(payments).values({
        userId: session.userId,
        status: 'failed',
        amount: amount.toString(),
        currency: 'KRW',
        paymentMethod: session.paymentMethod,
        transactionId: tid || orderId,
        paidAt: null,
      });

      await this.deletePendingSession(orderId);

      return {
        success: false,
        message: approvalResult.errorMsg || '결제 승인에 실패했습니다.',
      };
    }

    const [payment] = await db
      .insert(payments)
      .values({
        userId: session.userId,
        status: 'completed',
        amount: amount.toString(),
        currency: 'KRW',
        paymentMethod: session.paymentMethod,
        transactionId: tid || orderId,
        paidAt: new Date(),
      })
      .returning();

    if (session.planName) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const [newSubscription] = await db
        .insert(subscriptions)
        .values({
          userId: session.userId,
          status: 'active',
          planName: session.planName,
          amount: amount.toString(),
          currency: 'KRW',
          startDate,
          endDate,
        })
        .returning();

      await db
        .update(payments)
        .set({ subscriptionId: newSubscription.id })
        .where(eq(payments.id, payment.id));
    }

    await this.deletePendingSession(orderId);

    logger.info('NicePay payment approved successfully', {
      paymentId: payment.id,
      tid,
      orderId,
    });

    return {
      success: true,
      message: approvalResult.resultMsg || '결제가 완료되었습니다.',
    };
  }

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
      nextPaymentDate?: string;
    };
    message?: string;
  }> {
    logger.info('Processing payment', { userId, input, mock: this.isPaymentMockSuccess() });

    const isRenewal = !!input.isRenewal;
    if (input.planName && !isRenewal) {
      const activeSubscription = await this.getActiveSubscription(userId);
      if (activeSubscription) {
        throw new Error('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.');
      }
    }

    const orderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;
    let paymentMethodStr: string = input.paymentMethod;
    if (input.paymentMethod === 'CARD' && input.cardCode) {
      paymentMethodStr = `CARD_${input.cardCode}`;
    }

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

    throw new Error('나이스페이 JS SDK를 통해 결제해주세요.');
  }

  async getPayments(userId: string) {
    return db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt));
  }

  async getSubscriptions(userId: string) {
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

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

    const cancelResponse = await nicePayProvider.cancelPayment(tid, amount, reason);

    if (!cancelResponse.success) {
      logger.error('NicePay cancellation failed', {
        tid,
        errorCode: cancelResponse.errorCode,
        errorMsg: cancelResponse.errorMsg,
      });
      throw new Error(cancelResponse.errorMsg || '결제 취소에 실패했습니다.');
    }

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

  async cancelSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    logger.info('Cancelling subscription', { userId, subscriptionId });

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
