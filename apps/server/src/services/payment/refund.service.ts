import { db } from '../../db';
import { subscriptions, payments, webhookEvents, refundLogs, users, userProfiles } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../config/logger';
import { emailService } from '../email/email.service';

export class RefundService {
  async isDuplicateWebhookEvent(eventId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, eventId))
      .limit(1);
    return !!existing;
  }

  async recordWebhookEvent(
    eventId: string,
    source: 'paypal' | 'nicepay',
    eventType: string,
    payload: string
  ): Promise<boolean> {
    try {
      await db.insert(webhookEvents).values({
        eventId,
        source,
        eventType,
        payload,
      });
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        logger.info({ eventId }, 'Webhook event already recorded (concurrent duplicate)');
        return false;
      }
      throw error;
    }
  }

  private async getUserInfo(userId: string): Promise<{ email: string; nickname: string; language: string } | null> {
    const [result] = await db
      .select({ email: users.email, nickname: userProfiles.nickname, language: userProfiles.language })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);
    if (!result?.email) return null;
    return { email: result.email, nickname: result.nickname || '회원', language: result.language || 'ko' };
  }

  private async insertRefundLog(
    userId: string | null,
    paymentId: string | null,
    eventType: string,
    rawPayload: string
  ): Promise<void> {
    try {
      await db.insert(refundLogs).values({
        userId,
        paymentId,
        eventType,
        rawPayload,
      });
    } catch (error) {
      logger.error({ error, userId, paymentId, eventType }, 'Failed to insert refund log');
    }
  }

  private async sendRefundNotifications(
    userId: string,
    paymentId: string | undefined,
    eventType: string,
    amount?: string,
    currency?: string
  ): Promise<void> {
    try {
      const userInfo = await this.getUserInfo(userId);
      if (userInfo) {
        await emailService.sendRefundNotificationToUser(
          userInfo.email,
          userInfo.nickname,
          amount,
          currency,
          userInfo.language
        );
      }

      await emailService.sendRefundNotificationToAdmin({
        userId,
        paymentId,
        amount,
        currency,
        eventType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to send refund notification emails');
    }
  }

  async processPayPalRefund(event: {
    eventId: string;
    eventType: string;
    saleId: string;
    billingAgreementId?: string;
    amount?: string;
    currency?: string;
    rawPayload: string;
  }): Promise<{ processed: boolean; reason: string }> {
    if (await this.isDuplicateWebhookEvent(event.eventId)) {
      logger.info({ eventId: event.eventId }, 'Duplicate PayPal refund webhook, skipping');
      return { processed: false, reason: 'duplicate' };
    }

    const sub = event.billingAgreementId
      ? await this.findSubscriptionByPaypalId(event.billingAgreementId)
      : null;

    if (!sub) {
      logger.warn({
        eventId: event.eventId,
        saleId: event.saleId,
        billingAgreementId: event.billingAgreementId,
      }, 'PayPal refund: no matching subscription found');

      await this.recordWebhookEvent(event.eventId, 'paypal', event.eventType, event.rawPayload);
      await this.insertRefundLog(null, null, event.eventType, event.rawPayload);
      return { processed: false, reason: 'no_matching_subscription' };
    }

    if (sub.status === 'refunded') {
      logger.info({
        eventId: event.eventId,
        subscriptionId: sub.id,
        userId: sub.userId,
      }, 'PayPal refund: subscription already refunded');

      await this.recordWebhookEvent(event.eventId, 'paypal', event.eventType, event.rawPayload);
      return { processed: false, reason: 'already_refunded' };
    }

    const now = new Date();
    let refundedPaymentId: string | undefined;

    try {
      await db.transaction(async (tx) => {
        await tx.insert(webhookEvents).values({
          eventId: event.eventId,
          source: 'paypal',
          eventType: event.eventType,
          payload: event.rawPayload,
        });

        await tx
          .update(subscriptions)
          .set({
            status: 'refunded',
            endDate: now,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        if (event.saleId) {
          const [matchingPayment] = await tx
            .select({ id: payments.id })
            .from(payments)
            .where(
              and(
                eq(payments.subscriptionId, sub.id),
                eq(payments.status, 'completed')
              )
            )
            .orderBy(payments.createdAt)
            .limit(1);

          if (matchingPayment) {
            await tx
              .update(payments)
              .set({
                status: 'refunded',
                updatedAt: now,
              })
              .where(eq(payments.id, matchingPayment.id));
            refundedPaymentId = matchingPayment.id;
          }
        }
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        logger.info({ eventId: event.eventId }, 'PayPal refund: concurrent duplicate detected in transaction');
        return { processed: false, reason: 'duplicate' };
      }
      throw error;
    }

    await this.insertRefundLog(sub.userId, refundedPaymentId || null, event.eventType, event.rawPayload);

    await this.sendRefundNotifications(sub.userId, refundedPaymentId, event.eventType, event.amount, event.currency);

    logger.info({
      eventId: event.eventId,
      eventType: event.eventType,
      subscriptionId: sub.id,
      userId: sub.userId,
      saleId: event.saleId,
      amount: event.amount,
      currency: event.currency,
    }, 'PayPal refund processed: subscription revoked immediately');

    return { processed: true, reason: 'refunded' };
  }

  async processPayPalDispute(event: {
    eventId: string;
    eventType: string;
    disputeId: string;
    reason?: string;
    disputedTransactions?: Array<{ seller_transaction_id?: string }>;
    rawPayload: string;
  }): Promise<{ processed: boolean; reason: string }> {
    if (await this.isDuplicateWebhookEvent(event.eventId)) {
      logger.info({ eventId: event.eventId }, 'Duplicate PayPal dispute webhook, skipping');
      return { processed: false, reason: 'duplicate' };
    }

    await this.recordWebhookEvent(event.eventId, 'paypal', event.eventType, event.rawPayload);
    await this.insertRefundLog(null, null, event.eventType, event.rawPayload);

    logger.warn({
      eventId: event.eventId,
      eventType: event.eventType,
      disputeId: event.disputeId,
      reason: event.reason,
    }, 'PayPal dispute received — logged for admin review');

    try {
      await emailService.sendRefundNotificationToAdmin({
        userId: `N/A (dispute: ${event.disputeId})`,
        paymentId: event.disputedTransactions?.[0]?.seller_transaction_id || event.disputeId,
        eventType: `${event.eventType} - Reason: ${event.reason || 'unknown'}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Failed to send dispute notification to admin');
    }

    return { processed: true, reason: 'dispute_logged' };
  }

  async processNicePayRefund(event: {
    eventId: string;
    tid: string;
    orderId?: string;
    amount?: string;
    resultCode: string;
    resultMsg?: string;
    rawPayload: string;
  }): Promise<{ processed: boolean; reason: string }> {
    const idempotencyKey = `nicepay_refund_${event.tid}_${event.eventId || Date.now()}`;

    if (await this.isDuplicateWebhookEvent(idempotencyKey)) {
      logger.info({ eventId: idempotencyKey, tid: event.tid }, 'Duplicate NicePay refund webhook, skipping');
      return { processed: false, reason: 'duplicate' };
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionId, event.tid))
      .limit(1);

    if (!payment) {
      logger.warn({ tid: event.tid, eventId: idempotencyKey }, 'NicePay refund: no matching payment found');
      await this.recordWebhookEvent(idempotencyKey, 'nicepay', 'REFUND', event.rawPayload);
      await this.insertRefundLog(null, null, 'NICEPAY_REFUND', event.rawPayload);
      return { processed: false, reason: 'no_matching_payment' };
    }

    if (!payment.subscriptionId) {
      logger.warn({ tid: event.tid, paymentId: payment.id }, 'NicePay refund: payment has no linked subscription');
      await this.recordWebhookEvent(idempotencyKey, 'nicepay', 'REFUND', event.rawPayload);
      await this.insertRefundLog(payment.userId, payment.id, 'NICEPAY_REFUND', event.rawPayload);
      return { processed: false, reason: 'no_linked_subscription' };
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, payment.subscriptionId))
      .limit(1);

    if (!sub) {
      logger.warn({ subscriptionId: payment.subscriptionId }, 'NicePay refund: subscription not found');
      await this.recordWebhookEvent(idempotencyKey, 'nicepay', 'REFUND', event.rawPayload);
      await this.insertRefundLog(payment.userId, payment.id, 'NICEPAY_REFUND', event.rawPayload);
      return { processed: false, reason: 'subscription_not_found' };
    }

    if (sub.status === 'refunded') {
      logger.info({ subscriptionId: sub.id, userId: sub.userId }, 'NicePay refund: already refunded');
      await this.recordWebhookEvent(idempotencyKey, 'nicepay', 'REFUND', event.rawPayload);
      return { processed: false, reason: 'already_refunded' };
    }

    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx.insert(webhookEvents).values({
          eventId: idempotencyKey,
          source: 'nicepay',
          eventType: 'REFUND',
          payload: event.rawPayload,
        });

        await tx
          .update(subscriptions)
          .set({
            status: 'refunded',
            endDate: now,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id));

        await tx
          .update(payments)
          .set({
            status: 'refunded',
            updatedAt: now,
          })
          .where(eq(payments.id, payment.id));
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        logger.info({ eventId: idempotencyKey, tid: event.tid }, 'NicePay refund: concurrent duplicate detected in transaction');
        return { processed: false, reason: 'duplicate' };
      }
      throw error;
    }

    await this.insertRefundLog(sub.userId, payment.id, 'NICEPAY_REFUND', event.rawPayload);

    await this.sendRefundNotifications(sub.userId, payment.id, 'NICEPAY_REFUND', event.amount, 'KRW');

    logger.info({
      eventId: idempotencyKey,
      subscriptionId: sub.id,
      userId: sub.userId,
      paymentId: payment.id,
      tid: event.tid,
      amount: event.amount,
    }, 'NicePay refund processed: subscription revoked immediately');

    return { processed: true, reason: 'refunded' };
  }

  private async findSubscriptionByPaypalId(paypalSubscriptionId: string) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.paypalSubscriptionId, paypalSubscriptionId))
      .limit(1);
    return sub || null;
  }
}

export const refundService = new RefundService();
