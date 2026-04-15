import { db } from '../../db';
import { subscriptions, payments, webhookEvents } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../config/logger';

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
          await tx
            .update(payments)
            .set({
              status: 'refunded',
              updatedAt: now,
            })
            .where(
              and(
                eq(payments.subscriptionId, sub.id),
                eq(payments.status, 'completed')
              )
            );
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
      return { processed: false, reason: 'no_matching_payment' };
    }

    if (!payment.subscriptionId) {
      logger.warn({ tid: event.tid, paymentId: payment.id }, 'NicePay refund: payment has no linked subscription');
      await this.recordWebhookEvent(idempotencyKey, 'nicepay', 'REFUND', event.rawPayload);
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
