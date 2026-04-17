import { db } from '../db';
import { payments, subscriptions, paymentSessions, billingKeys, users, userProfiles } from '../db/schema';
import { eq, desc, lt, and, lte, or, isNotNull } from 'drizzle-orm';
import { logger } from '../config/logger';
import { ProcessPaymentInput } from '../validations/payment';
import { nicePayProvider } from './payment/nicepay.provider';
import { paypalProvider } from './payment/paypal.provider';
import { appleProvider, AppleProvider } from './payment/apple.provider';
import { emailService } from './email/email.service';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';
import { getKRWPrice, getBasePriceUSD } from '../utils/currency';

setInterval(async () => {
  try {
    await db.delete(paymentSessions).where(lt(paymentSessions.expiresAt, new Date()));
  } catch (e) {
    logger.error('Failed to cleanup expired payment sessions', { error: e });
  }
}, 5 * 60 * 1000);

export class PaymentService {
  async getServerPlanAmount(): Promise<number> {
    return await getKRWPrice();
  }

  private isPaymentMockSuccess(): boolean {
    return process.env.PAYMENT_MOCK_SUCCESS === 'true';
  }

  private async getUserEmailAndNickname(userId: string): Promise<{ email: string; nickname: string; language: string } | null> {
    const [result] = await db
      .select({ email: users.email, nickname: userProfiles.nickname, language: userProfiles.language })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.id, userId))
      .limit(1);
    if (!result?.email) return null;
    return { email: result.email, nickname: result.nickname || '회원', language: result.language || 'ko' };
  }

  async getActiveSubscription(userId: string) {
    const subs = await this.getSubscriptions(userId);
    const now = new Date();

    const activeSub = subs.find(
      (s) => s.status === 'active' && (!s.endDate || new Date(s.endDate) >= now)
    );
    if (activeSub) return activeSub;

    const cancelledSub = subs.find(
      (s) => s.status === 'cancelled' && s.endDate && new Date(s.endDate) >= now
    );
    if (cancelledSub) return cancelledSub;

    return null;
  }

  async needsIdentityVerification(userId: string): Promise<boolean> {
    const subs = await this.getSubscriptions(userId);
    if (subs.length === 0) return false;
    const hasActiveSub = subs.some(
      (s) => s.status === 'active' && (!s.endDate || new Date(s.endDate) >= new Date())
    );
    if (hasActiveSub) return false;
    return true;
  }

  async initBillingKeyRegistration(
    userId: string,
    input: { planName: string; paymentMethod: string; identityVerified?: boolean }
  ) {
    const serverAmount = await this.getServerPlanAmount();

    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new Error('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.');
    }

    const needsVerification = await this.needsIdentityVerification(userId);
    if (needsVerification && !input.identityVerified) {
      throw new Error('재구독 시 본인인증이 필요합니다.');
    }

    const orderId = `BILLING_${Date.now()}_${userId.substring(0, 8)}`;

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(paymentSessions).values({
      orderId,
      userId,
      amount: serverAmount.toString(),
      planName: input.planName,
      paymentMethod: input.paymentMethod,
      expiresAt,
    });

    const clientId = nicePayProvider.getClientId();

    return {
      clientId,
      orderId,
      amount: serverAmount,
      method: 'card',
      isTestMode: nicePayProvider.getIsTestMode(),
    };
  }

  async issueBillingKey(
    authToken: string,
    tid: string,
    orderId: string,
    amount: number
  ): Promise<{ success: boolean; message: string; bid?: string; tid?: string; cardCode?: string; cardName?: string; cardNo?: string; paidWithoutBid?: boolean }> {
    const issueResult = await nicePayProvider.issueBillingKey(authToken, tid, orderId, amount);
    if (issueResult.success && issueResult.bid) {
      return { success: true, message: '빌링키 발급 성공', bid: issueResult.bid, cardCode: issueResult.cardCode, cardName: issueResult.cardName, cardNo: issueResult.cardNo };
    }
    if (issueResult.success && !issueResult.bid) {
      logger.warn({ orderId, tid: issueResult.tid }, 'Payment approved but no bid returned (sandbox mode). Treating as successful first payment.');
      return { success: true, message: '결제 승인 성공 (빌링키 미발급)', tid: issueResult.tid, paidWithoutBid: true, cardCode: issueResult.cardCode, cardName: issueResult.cardName, cardNo: issueResult.cardNo };
    }
    return {
      success: false,
      message: issueResult.errorMsg || '빌링키 발급에 실패했습니다.',
    };
  }

  private processingBillingReturns = new Set<string>();

  async processBillingKeyReturn(
    bid: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    if (this.processingBillingReturns.has(orderId)) {
      logger.warn('Duplicate billing return detected, skipping', { orderId });
      return { success: false, message: '이미 처리 중인 요청입니다.' };
    }
    this.processingBillingReturns.add(orderId);

    try {
      return await this._processBillingKeyReturnInner(bid, orderId);
    } finally {
      this.processingBillingReturns.delete(orderId);
    }
  }

  private async _processBillingKeyReturnInner(
    bid: string,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    const session = await this.getPendingSession(orderId);
    if (!session) {
      logger.error('Billing key session not found or already processed', { orderId });
      return { success: false, message: '세션을 찾을 수 없습니다.' };
    }

    const serverAmount = Number(session.amount);
    const serverPlanName = session.planName;

    await this.deletePendingSession(orderId);

    const approvalResult = await nicePayProvider.approveBillingKey(bid);

    if (!approvalResult.success) {
      logger.error('Billing key approval failed', {
        orderId,
        errorCode: approvalResult.errorCode,
        errorMsg: approvalResult.errorMsg,
      });
      return {
        success: false,
        message: approvalResult.errorMsg || '빌링키 등록에 실패했습니다.',
      };
    }

    const existingKeys = await db
      .select()
      .from(billingKeys)
      .where(and(eq(billingKeys.userId, session.userId), eq(billingKeys.status, 'active')));

    if (existingKeys.length > 0) {
      for (const key of existingKeys) {
        await db
          .update(billingKeys)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(eq(billingKeys.id, key.id));
      }
    }

    const encryptedBid = encrypt(bid);

    await db.insert(billingKeys).values({
      userId: session.userId,
      bid: encryptedBid,
      cardCode: approvalResult.cardCode || null,
      cardName: approvalResult.cardName || null,
      cardNo: approvalResult.cardNo || null,
      status: 'active',
    });

    logger.info('Billing key registered', { userId: session.userId });

    const chargeResult = await this.chargeWithBillingKey(
      session.userId,
      bid,
      serverAmount,
      serverPlanName
    );

    if (!chargeResult.success) {
      logger.warn('First charge failed after billing key registration, deactivating billing key', {
        userId: session.userId,
        message: chargeResult.message,
      });
      await db
        .update(billingKeys)
        .set({ status: 'inactive', updatedAt: new Date() })
        .where(and(eq(billingKeys.userId, session.userId), eq(billingKeys.status, 'active')));

      try {
        await nicePayProvider.cancelBillingKey(bid);
      } catch (cancelErr) {
        logger.error('Failed to cancel billing key after charge failure', {
          userId: session.userId,
          error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
        });
      }
    }

    return chargeResult;
  }

  private processingDirectReturns = new Set<string>();

  async processDirectPaymentReturn(
    orderId: string,
    tid: string,
    cardCode?: string,
    cardName?: string,
    cardNo?: string,
    preloadedSession?: { userId: string; amount: string; planName: string } | null
  ): Promise<{ success: boolean; message: string }> {
    if (this.processingDirectReturns.has(orderId)) {
      logger.warn({ orderId }, 'Duplicate direct payment return detected, treating as success');
      return { success: true, message: '결제가 이미 처리되었습니다.' };
    }
    this.processingDirectReturns.add(orderId);

    try {
      return await this._processDirectPaymentReturnInner(orderId, tid, cardCode, cardName, cardNo, preloadedSession);
    } finally {
      this.processingDirectReturns.delete(orderId);
    }
  }

  private async _processDirectPaymentReturnInner(
    orderId: string,
    tid: string,
    cardCode?: string,
    cardName?: string,
    cardNo?: string,
    preloadedSession?: { userId: string; amount: string; planName: string } | null
  ): Promise<{ success: boolean; message: string }> {
    let session = preloadedSession;
    if (!session) {
      const dbSession = await this.getPendingSession(orderId);
      if (!dbSession) {
        logger.error({ orderId }, 'Direct payment session not found or already processed');
        return { success: false, message: '세션을 찾을 수 없습니다.' };
      }
      session = { userId: dbSession.userId, amount: dbSession.amount, planName: dbSession.planName };
    }

    const serverAmount = Number(session.amount);
    const serverPlanName = session.planName;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    try {
      await db.transaction(async (tx) => {
        const [newSubscription] = await tx
          .insert(subscriptions)
          .values({
            userId: session.userId,
            planName: serverPlanName,
            amount: serverAmount.toString(),
            status: 'active',
            startDate,
            endDate,
          })
          .returning();

        await tx
          .insert(payments)
          .values({
            userId: session.userId,
            subscriptionId: newSubscription.id,
            status: 'completed',
            amount: serverAmount.toString(),
            currency: 'KRW',
            paymentMethod: 'CARD',
            transactionId: tid,
            paidAt: startDate,
          });

        logger.info({
          userId: session.userId,
          subscriptionId: newSubscription.id,
          tid,
        }, 'Direct payment subscription created with linked payment record');
      });

      await this.deletePendingSession(orderId);

      try {
        const userInfo = await this.getUserEmailAndNickname(session.userId);
        if (userInfo) {
          await emailService.sendSubscriptionStartNotification(
            userInfo.email,
            userInfo.nickname,
            serverPlanName,
            userInfo.language
          );
        }
      } catch (emailError) {
        logger.error({ error: emailError }, 'Failed to send subscription confirmation email');
      }

      return { success: true, message: '결제가 완료되었습니다.' };
    } catch (error) {
      logger.error({ error, orderId, tid }, 'Failed to process direct payment');
      return { success: false, message: '결제 처리 중 오류가 발생했습니다.' };
    }
  }

  async chargeWithBillingKey(
    userId: string,
    bid: string,
    amount: number,
    planName: string
  ): Promise<{ success: boolean; message: string }> {
    const chargeOrderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;

    if (this.isPaymentMockSuccess()) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            userId,
            status: 'completed',
            amount: amount.toString(),
            currency: 'KRW',
            paymentMethod: 'BILLING',
            transactionId: chargeOrderId,
            paidAt: startDate,
          })
          .returning();

        const [newSubscription] = await tx
          .insert(subscriptions)
          .values({
            userId,
            status: 'active',
            planName,
            amount: amount.toString(),
            currency: 'KRW',
            startDate,
            endDate,
          })
          .returning();

        await tx
          .update(payments)
          .set({ subscriptionId: newSubscription.id })
          .where(eq(payments.id, payment.id));
      });

      logger.info('Billing payment processed (mock)', { userId, chargeOrderId });

      this.getUserEmailAndNickname(userId).then(info => {
        if (info) emailService.sendSubscriptionStartNotification(info.email, info.nickname, planName, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
      }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));

      return { success: true, message: '구독이 시작되었습니다.' };
    }

    const chargeResult = await nicePayProvider.payWithBillingKey(
      bid,
      chargeOrderId,
      amount,
      planName
    );

    if (!chargeResult.success) {
      logger.error('Billing key charge failed', {
        userId,
        bidSuffix: bid ? `***${bid.slice(-4)}` : 'N/A',
        chargeOrderId,
        errorMsg: chargeResult.errorMsg,
      });

      await db.insert(payments).values({
        userId,
        status: 'failed',
        amount: amount.toString(),
        currency: 'KRW',
        paymentMethod: 'BILLING',
        transactionId: chargeResult.tid || chargeOrderId,
        paidAt: null,
      });

      return {
        success: false,
        message: chargeResult.errorMsg || '결제에 실패했습니다.',
      };
    }

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            userId,
            status: 'completed',
            amount: amount.toString(),
            currency: 'KRW',
            paymentMethod: 'BILLING',
            transactionId: chargeResult.tid || chargeOrderId,
            paidAt: startDate,
          })
          .returning();

        const [newSubscription] = await tx
          .insert(subscriptions)
          .values({
            userId,
            status: 'active',
            planName,
            amount: amount.toString(),
            currency: 'KRW',
            startDate,
            endDate,
          })
          .returning();

        await tx
          .update(payments)
          .set({ subscriptionId: newSubscription.id })
          .where(eq(payments.id, payment.id));
      });

      logger.info('Billing key charge successful', { userId, tid: chargeResult.tid });

      this.getUserEmailAndNickname(userId).then(info => {
        if (info) emailService.sendSubscriptionStartNotification(info.email, info.nickname, planName, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
      }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));

      return { success: true, message: '결제가 완료되었습니다.' };
    } catch (txError) {
      logger.error('Billing payment DB transaction failed', { error: txError, userId });

      if (chargeResult.tid) {
        try {
          await nicePayProvider.cancelPayment(chargeResult.tid, amount, '시스템 오류로 인한 자동 취소');
        } catch (cancelError) {
          logger.error('Failed to auto-cancel billing payment', { cancelError });
        }
      }

      return {
        success: false,
        message: '결제 처리 중 오류가 발생했습니다.',
      };
    }
  }

  private isProcessingRenewals = false;

  async processAutoRenewals() {
    if (this.isProcessingRenewals) {
      logger.warn('Auto-renewal already in progress, skipping');
      return;
    }
    this.isProcessingRenewals = true;

    try {
      await this._processAutoRenewalsInner();
    } finally {
      this.isProcessingRenewals = false;
    }
  }

  private async _processAutoRenewalsInner() {
    const now = new Date();
    const GRACE_PERIOD_DAYS = 3;
    const MAX_RETRY = 3;
    const RETRY_DELAY_MS = 5000;

    const expiredSubs = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          or(
            and(lte(subscriptions.endDate, now), eq(subscriptions.renewalFailCount, 0)),
            and(isNotNull(subscriptions.nextRetryAt), lte(subscriptions.nextRetryAt, now))
          )
        )
      );

    logger.info({ count: expiredSubs.length }, 'Subscriptions due for auto-renewal');

    for (const sub of expiredSubs) {
      try {
        if (sub.paypalSubscriptionId) {
          await this.processPayPalAutoRenewal(sub);
          continue;
        }

        const activeBillingKey = await this.getActiveBillingKey(sub.userId);

        if (!activeBillingKey) {
          logger.warn({
            userId: sub.userId,
            subscriptionId: sub.id,
          }, 'No active billing key for auto-renewal, expiring subscription');
          await db
            .update(subscriptions)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));
          continue;
        }

        const currentAmount = await this.getServerPlanAmount();

        let result: { success: boolean; message: string } = { success: false, message: '' };
        for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
          result = await this.chargeWithBillingKey(
            sub.userId,
            activeBillingKey.bid,
            currentAmount,
            sub.planName
          );

          if (result.success) break;

          logger.warn({
            userId: sub.userId,
            subscriptionId: sub.id,
            attempt,
            maxRetry: MAX_RETRY,
            message: result.message,
          }, 'Auto-renewal attempt failed');

          if (attempt < MAX_RETRY) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }

        if (result.success) {
          await db
            .update(subscriptions)
            .set({ status: 'expired', renewalFailCount: 0, nextRetryAt: null, updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));

          logger.info({
            userId: sub.userId,
            oldSubscriptionId: sub.id,
          }, 'Auto-renewal successful');
        } else {
          const failCount = sub.renewalFailCount + 1;

          if (failCount > GRACE_PERIOD_DAYS) {
            await db
              .update(subscriptions)
              .set({ status: 'expired', renewalFailCount: failCount, nextRetryAt: null, updatedAt: new Date() })
              .where(eq(subscriptions.id, sub.id));

            logger.error({
              userId: sub.userId,
              subscriptionId: sub.id,
              failCount,
              message: result.message,
            }, 'Auto-renewal failed after grace period, subscription expired');
          } else {
            const nextRetry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const graceEndDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            await db
              .update(subscriptions)
              .set({
                renewalFailCount: failCount,
                nextRetryAt: nextRetry,
                endDate: graceEndDate,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, sub.id));

            logger.warn({
              userId: sub.userId,
              subscriptionId: sub.id,
              failCount,
              nextRetryAt: nextRetry.toISOString(),
              graceDaysRemaining: GRACE_PERIOD_DAYS - failCount,
            }, 'Auto-renewal failed, grace period active');
          }
        }
      } catch (error) {
        logger.error({
          userId: sub.userId,
          subscriptionId: sub.id,
          error,
        }, 'Auto-renewal error');
      }
    }
  }

  private async processPayPalAutoRenewal(sub: typeof subscriptions.$inferSelect) {
    if (!sub.paypalSubscriptionId) return;

    try {
      const ppDetails = await paypalProvider.getSubscriptionDetails(sub.paypalSubscriptionId);
      if (ppDetails.status === 'ACTIVE') {
        const newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + 1);

        const basePriceUSD = getBasePriceUSD();

        await db.transaction(async (tx) => {
          await tx.update(subscriptions)
            .set({ endDate: newEndDate, renewalFailCount: 0, nextRetryAt: null, updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));

          await tx.insert(payments).values({
            userId: sub.userId,
            subscriptionId: sub.id,
            status: 'completed',
            amount: basePriceUSD.toString(),
            currency: 'USD',
            paymentMethod: 'PAYPAL',
            transactionId: `paypal_renewal_${sub.paypalSubscriptionId}_${Date.now()}`,
            paidAt: new Date(),
          });
        });

        logger.info({
          subscriptionId: sub.id,
          paypalSubscriptionId: sub.paypalSubscriptionId,
          amount: basePriceUSD,
        }, 'PayPal subscription renewed, payment recorded');
      } else {
        await db.update(subscriptions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));

        logger.info({
          subscriptionId: sub.id,
          paypalStatus: ppDetails.status,
        }, 'PayPal subscription no longer active, expired');
      }
    } catch (ppError) {
      logger.error({
        error: ppError,
        subscriptionId: sub.id,
      }, 'Failed to check PayPal subscription status during auto-renewal');
    }
  }

  private decryptBid(bid: string): string {
    try {
      return isEncrypted(bid) ? decrypt(bid) : bid;
    } catch {
      return bid;
    }
  }

  async getActiveBillingKey(userId: string) {
    const [key] = await db
      .select()
      .from(billingKeys)
      .where(
        and(
          eq(billingKeys.userId, userId),
          eq(billingKeys.status, 'active')
        )
      )
      .limit(1);
    if (!key) return null;
    return { ...key, bid: this.decryptBid(key.bid) };
  }

  async deactivateBillingKey(userId: string): Promise<{ success: boolean; message: string }> {
    const activeBillingKey = await this.getActiveBillingKey(userId);
    if (!activeBillingKey) {
      return { success: true, message: '활성 빌링키가 없습니다.' };
    }

    const cancelResult = await nicePayProvider.cancelBillingKey(activeBillingKey.bid);

    await db
      .update(billingKeys)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(billingKeys.id, activeBillingKey.id));

    logger.info('Billing key deactivated', {
      userId,
      nicepayCancel: cancelResult.success,
    });

    return { success: true, message: '빌링키가 해지되었습니다.' };
  }

  async initPayment(
    userId: string,
    input: { planName: string; paymentMethod: string }
  ) {
    const serverAmount = await this.getServerPlanAmount();

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
      amount: serverAmount.toString(),
      planName: input.planName,
      paymentMethod: input.paymentMethod,
      expiresAt,
    });

    const clientId = nicePayProvider.getClientId();

    const nicepayMethodMap: Record<string, string> = {
      CARD: 'card',
    };

    return {
      clientId,
      orderId,
      amount: serverAmount,
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

    await this.deletePendingSession(orderId);

    const existingPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.transactionId, tid))
      .limit(1);

    if (existingPayment.length > 0) {
      logger.warn('Duplicate approval attempt detected', { tid, orderId });
      return {
        success: existingPayment[0].status === 'completed',
        message: existingPayment[0].status === 'completed'
          ? '이미 처리된 결제입니다.'
          : '결제가 실패한 상태입니다.',
      };
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
        transactionId: tid,
        paidAt: null,
      });

      return {
        success: false,
        message: approvalResult.errorMsg || '결제 승인에 실패했습니다.',
      };
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            userId: session.userId,
            status: 'completed',
            amount: amount.toString(),
            currency: 'KRW',
            paymentMethod: session.paymentMethod,
            transactionId: tid,
            paidAt: new Date(),
          })
          .returning();

        let subscriptionId: string | null = null;

        if (session.planName) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);

          const [newSubscription] = await tx
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

          subscriptionId = newSubscription.id;

          await tx
            .update(payments)
            .set({ subscriptionId: newSubscription.id })
            .where(eq(payments.id, payment.id));
        }

        return { paymentId: payment.id, subscriptionId };
      });

      logger.info('NicePay payment approved successfully', {
        paymentId: result.paymentId,
        subscriptionId: result.subscriptionId,
        tid,
        orderId,
      });

      if (result.subscriptionId && session.planName) {
        this.getUserEmailAndNickname(session.userId).then(info => {
          if (info) emailService.sendSubscriptionStartNotification(info.email, info.nickname, session.planName!, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
        }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
      }

      return {
        success: true,
        message: approvalResult.resultMsg || '결제가 완료되었습니다.',
      };
    } catch (txError) {
      logger.error('Payment DB transaction failed, attempting to cancel NicePay payment', { error: txError, tid, orderId });

      try {
        const cancelResult = await nicePayProvider.cancelPayment(tid, amount, '시스템 오류로 인한 자동 취소');
        logger.info('NicePay payment auto-cancelled after DB failure', { tid, cancelResult: cancelResult.success });
      } catch (cancelError) {
        logger.error('Failed to auto-cancel NicePay payment after DB failure', { tid, cancelError });
      }

      return {
        success: false,
        message: '결제 처리 중 오류가 발생했습니다. 자동 취소 처리되었습니다. 문제가 지속되면 고객센터에 문의해주세요.',
      };
    }
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

      if (subscription && input.planName) {
        this.getUserEmailAndNickname(userId).then(info => {
          if (info) emailService.sendSubscriptionStartNotification(info.email, info.nickname, input.planName!, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
        }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
      }

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

  async handlePayPalSubscriptionCancelled(
    paypalSubscriptionId: string,
    eventType: string
  ): Promise<string> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.paypalSubscriptionId, paypalSubscriptionId),
          eq(subscriptions.status, 'active')
        )
      )
      .limit(1);

    if (!sub) {
      logger.info({ paypalSubscriptionId, eventType }, 'PayPal cancellation webhook: no active subscription found (already cancelled/expired)');
      return 'no_active_subscription';
    }

    await db
      .update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));

    logger.info({
      subscriptionId: sub.id,
      userId: sub.userId,
      paypalSubscriptionId,
      eventType,
    }, 'PayPal subscription cancelled via webhook');

    const endDateStr = sub.endDate
      ? new Date(sub.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '이용 기간 종료 시';
    this.getUserEmailAndNickname(sub.userId).then(info => {
      if (info) emailService.sendSubscriptionCancelNotification(info.email, info.nickname, endDateStr, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
    }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));

    return 'cancelled';
  }

  /**
   * Verify an Apple StoreKit transaction (transactionId) and create/refresh subscription.
   * Called from POST /api/payments/apple/verify-receipt after a successful in-app purchase.
   */
  async verifyAppleTransaction(
    userId: string,
    input: { transactionId?: string; receipt?: string }
  ): Promise<{ success: boolean; message: string; subscriptionId?: string }> {
    if (!appleProvider.isEnabled()) {
      throw new Error('Apple in-app purchase is not configured');
    }

    if (!input.transactionId && !input.receipt) {
      throw new Error('transactionId 또는 receipt가 필요합니다.');
    }

    const verified = input.transactionId
      ? await appleProvider.verifyTransactionId(input.transactionId)
      : await appleProvider.verifyReceipt(input.receipt!);

    const expectedProductId = process.env.APPLE_PRODUCT_ID || 'subscription01';
    if (verified.productId !== expectedProductId) {
      logger.warn({ verified, expected: expectedProductId }, 'Apple verify: unexpected product id');
      throw new Error(`예상하지 않은 상품입니다: ${verified.productId}`);
    }

    // Idempotency: re-using the same originalTransactionId means user already has this subscription
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.appleOriginalTransactionId, verified.originalTransactionId))
      .limit(1);

    const planName = '월간 프리미엄';
    const basePriceUSD = getBasePriceUSD();
    const startDate = verified.purchaseDate;
    const endDate = verified.expiresDate || (() => {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + 1);
      return d;
    })();

    if (existing) {
      // Same Apple subscription belongs to a different user — security check
      if (existing.userId !== userId) {
        logger.warn({
          existingUserId: existing.userId,
          requestUserId: userId,
          originalTransactionId: verified.originalTransactionId,
        }, 'Apple verify: originalTransactionId already linked to another user');
        throw new Error('이 영수증은 다른 계정에 등록되어 있습니다.');
      }

      await db
        .update(subscriptions)
        .set({
          status: 'active',
          endDate,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));

      // Record payment if not already
      const txKey = `apple_${verified.transactionId}`;
      const [existingPayment] = await db
        .select()
        .from(payments)
        .where(eq(payments.transactionId, txKey))
        .limit(1);

      if (!existingPayment) {
        await db.insert(payments).values({
          userId,
          subscriptionId: existing.id,
          status: 'completed',
          amount: basePriceUSD.toString(),
          currency: 'USD',
          paymentMethod: 'APPLE_IAP',
          transactionId: txKey,
          paidAt: startDate,
        });
      }

      return { success: true, message: '구독이 갱신되었습니다.', subscriptionId: existing.id };
    }

    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new Error('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.');
    }

    const txKey = `apple_${verified.transactionId}`;
    let subscriptionId: string | undefined;

    await db.transaction(async (tx) => {
      const [newSub] = await tx
        .insert(subscriptions)
        .values({
          userId,
          status: 'active',
          planName,
          amount: basePriceUSD.toString(),
          currency: 'USD',
          appleOriginalTransactionId: verified.originalTransactionId,
          appleProductId: verified.productId,
          startDate,
          endDate,
        })
        .returning();

      await tx.insert(payments).values({
        userId,
        subscriptionId: newSub.id,
        status: 'completed',
        amount: basePriceUSD.toString(),
        currency: 'USD',
        paymentMethod: 'APPLE_IAP',
        transactionId: txKey,
        paidAt: startDate,
      });

      subscriptionId = newSub.id;
    });

    logger.info({
      userId,
      subscriptionId,
      originalTransactionId: verified.originalTransactionId,
      productId: verified.productId,
      env: verified.environment,
    }, 'Apple subscription created');

    this.getUserEmailAndNickname(userId).then(info => {
      if (info) emailService.sendSubscriptionStartNotification(info.email, info.nickname, planName, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
    }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));

    return { success: true, message: '구독이 시작되었습니다.', subscriptionId };
  }

  /**
   * Handle App Store Server Notifications v2 (renew / cancel / refund / etc).
   */
  async handleAppleNotification(
    notificationType: string,
    subtype: string | undefined,
    decodedTransaction: {
      originalTransactionId?: string;
      transactionId?: string;
      productId?: string;
      expiresDate?: number | Date;
      purchaseDate?: number | Date;
      revocationDate?: number | Date;
    } | undefined,
  ): Promise<string> {
    const originalTxId = decodedTransaction?.originalTransactionId;
    if (!originalTxId) {
      logger.warn({ notificationType, subtype }, 'Apple notification: missing originalTransactionId');
      return 'no_original_transaction_id';
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.appleOriginalTransactionId, originalTxId))
      .limit(1);

    if (!sub) {
      logger.info({ notificationType, subtype, originalTxId }, 'Apple notification: subscription not found (likely first purchase still being verified)');
      return 'subscription_not_found';
    }

    const expiresDate = decodedTransaction?.expiresDate
      ? new Date(decodedTransaction.expiresDate as number)
      : null;

    // Handle renewal-status changes first (subtype-based cancel/uncancel)
    if (notificationType === AppleProvider.NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS) {
      if (subtype === AppleProvider.Subtype.AUTO_RENEW_DISABLED) {
        await db
          .update(subscriptions)
          .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        return 'cancelled';
      }
      if (subtype === AppleProvider.Subtype.AUTO_RENEW_ENABLED) {
        await db
          .update(subscriptions)
          .set({ status: 'active', cancelledAt: null, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        return 'auto_renew_enabled';
      }
      logger.info({ notificationType, subtype }, 'Apple notification: renewal status change with no actionable subtype');
      return 'unhandled';
    }

    switch (notificationType) {
      case AppleProvider.NotificationTypeV2.DID_RENEW: {
        if (expiresDate) {
          await db
            .update(subscriptions)
            .set({ status: 'active', endDate: expiresDate, renewalFailCount: 0, nextRetryAt: null, updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));

          if (decodedTransaction?.transactionId) {
            const txKey = `apple_${decodedTransaction.transactionId}`;
            const [existingPayment] = await db
              .select()
              .from(payments)
              .where(eq(payments.transactionId, txKey))
              .limit(1);
            if (!existingPayment) {
              const basePriceUSD = getBasePriceUSD();
              await db.insert(payments).values({
                userId: sub.userId,
                subscriptionId: sub.id,
                status: 'completed',
                amount: basePriceUSD.toString(),
                currency: 'USD',
                paymentMethod: 'APPLE_IAP',
                transactionId: txKey,
                paidAt: new Date(),
              });
            }
          }
        }
        return 'renewed';
      }

      case AppleProvider.NotificationTypeV2.EXPIRED:
      case AppleProvider.NotificationTypeV2.GRACE_PERIOD_EXPIRED: {
        await db
          .update(subscriptions)
          .set({ status: 'expired', updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        return 'expired';
      }

      case AppleProvider.NotificationTypeV2.DID_FAIL_TO_RENEW: {
        const failCount = (sub.renewalFailCount || 0) + 1;
        await db
          .update(subscriptions)
          .set({ renewalFailCount: failCount, updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        return 'renewal_failed';
      }

      case AppleProvider.NotificationTypeV2.REFUND:
      case AppleProvider.NotificationTypeV2.REVOKE: {
        await db
          .update(subscriptions)
          .set({ status: 'refunded', cancelledAt: new Date(), updatedAt: new Date() })
          .where(eq(subscriptions.id, sub.id));
        if (decodedTransaction?.transactionId) {
          const txKey = `apple_${decodedTransaction.transactionId}`;
          await db
            .update(payments)
            .set({ status: 'refunded', updatedAt: new Date() })
            .where(eq(payments.transactionId, txKey));
        }
        return 'refunded';
      }

      default: {
        logger.info({ notificationType, subtype }, 'Apple notification: unhandled type');
        return 'unhandled';
      }
    }
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

    if (subscription.status === 'refunded') {
      return {
        success: true,
        message: '환불 처리된 구독입니다.',
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

    await this.deactivateBillingKey(userId);

    if (subscription.paypalSubscriptionId) {
      const ppCancelled = await this.cancelPayPalSubscription(subscription.paypalSubscriptionId);
      if (ppCancelled) {
        logger.info({ paypalSubscriptionId: subscription.paypalSubscriptionId }, 'PayPal subscription also cancelled');
      } else {
        logger.error({ paypalSubscriptionId: subscription.paypalSubscriptionId }, 'Failed to cancel PayPal subscription - may still be billing');
      }
    }

    logger.info('Subscription cancelled successfully', { subscriptionId });

    const endDateStr = subscription.endDate
      ? new Date(subscription.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '이용 기간 종료 시';
    this.getUserEmailAndNickname(userId).then(info => {
      if (info) emailService.sendSubscriptionCancelNotification(info.email, info.nickname, endDateStr, info.language).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));
    }).catch((err: unknown) => logger.error('Email notification failed', { error: err instanceof Error ? err.message : String(err) }));

    return {
      success: true,
      message: '구독이 취소되었습니다. 이용 기간이 끝나면 자동결제가 중단됩니다.',
    };
  }

  async initPayPalPayment(
    userId: string,
    planName: string,
    baseUrl: string
  ): Promise<{ approveUrl: string; orderId: string; paypalSubscriptionId: string }> {
    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new Error('You already have an active subscription.');
    }

    const usdAmount = getBasePriceUSD().toFixed(2);
    const orderId = `PAYPAL_${Date.now()}_${userId.substring(0, 8)}`;

    const { planId } = await paypalProvider.ensureProductAndPlan(usdAmount, 'USD');

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.insert(paymentSessions).values({
      orderId,
      userId,
      amount: usdAmount,
      planName,
      paymentMethod: 'PAYPAL',
      expiresAt,
    });

    const returnUrl = `${baseUrl}/api/payments/paypal/return?oid=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${baseUrl}/api/payments/paypal/cancel?oid=${encodeURIComponent(orderId)}`;

    const result = await paypalProvider.createSubscription(
      planId,
      returnUrl,
      cancelUrl,
      orderId,
    );

    logger.info({ orderId, paypalSubscriptionId: result.subscriptionId, userId }, 'PayPal subscription initiated');

    return {
      approveUrl: result.approveUrl,
      orderId,
      paypalSubscriptionId: result.subscriptionId,
    };
  }

  private processingPayPalReturns = new Set<string>();

  async activatePayPalSubscription(
    paypalSubscriptionId: string,
    internalOrderId: string
  ): Promise<{ success: boolean; message: string }> {
    if (this.processingPayPalReturns.has(internalOrderId)) {
      logger.warn({ internalOrderId }, 'Duplicate PayPal activation detected, skipping');
      return { success: true, message: 'Already processing.' };
    }
    this.processingPayPalReturns.add(internalOrderId);

    try {
      return await this._activatePayPalSubscriptionInner(paypalSubscriptionId, internalOrderId);
    } finally {
      this.processingPayPalReturns.delete(internalOrderId);
    }
  }

  private async _activatePayPalSubscriptionInner(
    paypalSubscriptionId: string,
    internalOrderId: string
  ): Promise<{ success: boolean; message: string }> {
    const session = await this.getPendingSession(internalOrderId);
    if (!session) {
      const existingSub = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.paypalSubscriptionId, paypalSubscriptionId))
        .limit(1);
      if (existingSub.length > 0) {
        logger.info({ internalOrderId, paypalSubscriptionId }, 'PayPal session gone but subscription exists (likely page refresh)');
        return { success: true, message: 'Subscription already activated.' };
      }
      logger.error({ internalOrderId }, 'PayPal session not found');
      return { success: false, message: 'Payment session not found.' };
    }

    let subDetails;
    try {
      subDetails = await paypalProvider.getSubscriptionDetails(paypalSubscriptionId);
    } catch (error) {
      logger.error({ paypalSubscriptionId, error }, 'Failed to get PayPal subscription details');
      return { success: false, message: 'Failed to verify PayPal subscription.' };
    }

    if (subDetails.customId && subDetails.customId !== internalOrderId) {
      logger.error({
        paypalSubscriptionId,
        expectedCustomId: internalOrderId,
        actualCustomId: subDetails.customId,
      }, 'PayPal subscription custom_id mismatch');
      return { success: false, message: 'Subscription verification failed.' };
    }

    if (subDetails.status !== 'ACTIVE' && subDetails.status !== 'APPROVED') {
      logger.error({ paypalSubscriptionId, status: subDetails.status }, 'PayPal subscription not active');
      return { success: false, message: `PayPal subscription status: ${subDetails.status}` };
    }

    const serverAmount = Number(session.amount);
    const serverPlanName = session.planName;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    try {
      await db.transaction(async (tx) => {
        const [newSubscription] = await tx
          .insert(subscriptions)
          .values({
            userId: session.userId,
            planName: serverPlanName,
            amount: serverAmount.toString(),
            currency: 'USD',
            status: 'active',
            paypalSubscriptionId,
            startDate,
            endDate,
          })
          .returning();

        await tx
          .insert(payments)
          .values({
            userId: session.userId,
            subscriptionId: newSubscription.id,
            status: 'completed',
            amount: serverAmount.toString(),
            currency: 'USD',
            paymentMethod: 'PAYPAL',
            transactionId: paypalSubscriptionId,
            paidAt: startDate,
          });

        logger.info({
          userId: session.userId,
          subscriptionId: newSubscription.id,
          paypalSubscriptionId,
        }, 'PayPal recurring subscription created');
      });

      await this.deletePendingSession(internalOrderId);

      try {
        const userInfo = await this.getUserEmailAndNickname(session.userId);
        if (userInfo) {
          await emailService.sendSubscriptionStartNotification(
            userInfo.email,
            userInfo.nickname,
            serverPlanName,
            userInfo.language
          );
        }
      } catch (emailError) {
        logger.error({ error: emailError }, 'Failed to send subscription email after PayPal payment');
      }

      return { success: true, message: 'Subscription activated successfully.' };
    } catch (error) {
      logger.error({ error, internalOrderId, paypalSubscriptionId }, 'Failed to process PayPal subscription');
      return { success: false, message: 'Failed to process subscription.' };
    }
  }

  async cancelPayPalSubscription(paypalSubscriptionId: string): Promise<boolean> {
    return await paypalProvider.cancelSubscription(paypalSubscriptionId);
  }
}

export const paymentService = new PaymentService();
