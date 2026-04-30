import { db } from '../db';
import { payments, subscriptions, paymentSessions, billingKeys, users, userProfiles } from '../db/schema';
import { eq, desc, lt, and, lte, or, isNotNull, isNull, ne, exists, sql } from 'drizzle-orm';
import { logger } from '../config/logger';
import { ProcessPaymentInput } from '../validations/payment';
import { nicePayProvider } from './payment/nicepay.provider';
import { paypalProvider } from './payment/paypal.provider';
import { appleProvider, AppleProvider } from './payment/apple.provider';
import { emailService } from './email/email.service';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';
import { getKRWPrice, getBasePriceUSD } from '../utils/currency';
import { phoneVerificationRepository } from '../repositories/phone-verification.repository';
import { AppError } from '../middleware/error-handler';

setInterval(async () => {
  try {
    // 기본 정책: PayPal sweep job 이 처리할 때까지 PAYPAL + externalSubscriptionId row 는 보존.
    // 단, 이미 subscriptions 테이블에 동일 paypal_subscription_id 로 활성화된 row 가 있다면 그건
    // 좀비 session 이므로 5분 cleanup 에서도 제거한다 (sweep 안에서도 정리하지만 빠른 회수가 안전).
    await db.delete(paymentSessions).where(
      and(
        lt(paymentSessions.expiresAt, new Date()),
        or(
          ne(paymentSessions.paymentMethod, 'PAYPAL'),
          isNull(paymentSessions.externalSubscriptionId),
          // PAYPAL + externalSubscriptionId 인데 이미 subscriptions 에 매칭되는 row 가 있으면 좀비
          exists(
            db
              .select({ one: sql`1` })
              .from(subscriptions)
              .where(eq(subscriptions.paypalSubscriptionId, paymentSessions.externalSubscriptionId)),
          ),
        ),
      ),
    );
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

  async needsIdentityVerification(_userId: string): Promise<boolean> {
    // 정책: 모든 결제(첫 결제·재구독 모두) 전에 본인인증을 요구한다.
    return true;
  }

  /**
   * 결제 시작 직전 서버측에서 본인인증 여부를 검증한다.
   * - 클라이언트 게이트가 우회되더라도 결제가 진행되지 않도록 보호한다.
   * - 최근 30일 이내 검증된 휴대폰 인증 기록이 있어야 통과.
   */
  private async assertIdentityVerified(userId: string): Promise<void> {
    const needs = await this.needsIdentityVerification(userId);
    if (!needs) return;
    const recent = await phoneVerificationRepository.findRecentVerifiedByUserId(userId, 30);
    if (!recent) {
      throw new AppError('결제 진행을 위해 본인인증이 필요합니다.', {
        statusCode: 403,
        code: 'IDENTITY_VERIFICATION_REQUIRED',
      });
    }
  }

  async initBillingKeyRegistration(
    userId: string,
    input: { planName: string; paymentMethod: string; identityVerified?: boolean }
  ) {
    const serverAmount = await this.getServerPlanAmount();

    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new AppError('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.', {
        statusCode: 409,
        code: 'ACTIVE_SUBSCRIPTION_EXISTS',
      });
    }

    // Server-trusted identity verification check.
    // Do NOT trust the client-supplied input.identityVerified boolean.
    await this.assertIdentityVerified(userId);

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
      // 보상 처리: NicePay 카드 승인은 끝났는데 우리 DB 가 깨졌으므로 즉시 결제 취소한다.
      // chargeWithBillingKey 와 동일한 비대칭 위험을 메운다.
      // 단, idempotency guard: 동시 콜백/재시도/부분 unique 인덱스 충돌로 다른 요청이 이미 동일 tid 로
      // 결제를 성공 기록한 경우엔 정상 결제를 취소하면 안 된다.
      logger.error({ error, orderId, tid }, 'Failed to process direct payment, checking idempotency before compensation cancel');
      try {
        // existence-only guard: 동일 tid 의 payment row 가 어떤 status 든 존재하면
        // 다른 동시 요청이 이미 처리한 것이므로 정상 결제를 절대 cancel 하지 않는다.
        // (catch 진입은 트랜잭션 rollback 을 의미하므로, 여기서 row 가 보인다면 = 다른 호출이 commit 한 것)
        const [alreadyRecorded] = await db
          .select({ id: payments.id, status: payments.status })
          .from(payments)
          .where(eq(payments.transactionId, tid))
          .limit(1);
        if (alreadyRecorded) {
          logger.info(
            { tid, orderId, paymentId: alreadyRecorded.id, status: alreadyRecorded.status },
            'NicePay direct payment row exists from concurrent request - skipping compensation cancel',
          );
          return { success: true, message: '결제가 완료되었습니다.' };
        }
        await nicePayProvider.cancelPayment(tid, serverAmount, '시스템 오류로 인한 자동 취소(direct payment activation)');
        logger.warn({ tid, orderId, serverAmount }, 'NicePay direct payment compensation cancel succeeded');
      } catch (cancelErr) {
        logger.error(
          { tid, orderId, error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr) },
          'NicePay direct payment compensation cancel failed - manual reconciliation required',
        );
      }
      return { success: false, message: '결제 처리 중 오류가 발생했습니다.' };
    }
  }

  async chargeWithBillingKey(
    userId: string,
    bid: string,
    amount: number,
    planName: string,
    /**
     * 자동 갱신 호출 시 기존 active subscription 의 id 를 넘긴다.
     * 트랜잭션 안에서 이 row 를 먼저 'expired' 로 UPDATE 한 뒤 새 active row 를 INSERT 하므로,
     * `uniq_active_sub_per_user` 부분 unique 인덱스와 충돌하지 않는다.
     */
    previousSubscriptionId?: string
  ): Promise<{ success: boolean; message: string }> {
    const chargeOrderId = `ORDER_${Date.now()}_${userId.substring(0, 8)}`;

    if (this.isPaymentMockSuccess()) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      await db.transaction(async (tx) => {
        // 자동 갱신: 기존 active 를 먼저 expired 처리하여 부분 unique 인덱스 충돌 방지.
        if (previousSubscriptionId) {
          await tx
            .update(subscriptions)
            .set({ status: 'expired', renewalFailCount: 0, nextRetryAt: null, updatedAt: new Date() })
            .where(eq(subscriptions.id, previousSubscriptionId));
        }

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
        // 자동 갱신: 기존 active 를 먼저 expired 처리하여 부분 unique 인덱스 충돌 방지.
        if (previousSubscriptionId) {
          await tx
            .update(subscriptions)
            .set({ status: 'expired', renewalFailCount: 0, nextRetryAt: null, updatedAt: new Date() })
            .where(eq(subscriptions.id, previousSubscriptionId));
        }

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
          // sub.id 를 넘겨, chargeWithBillingKey 가 트랜잭션 안에서 기존 active 를 먼저
          // expired 로 처리한 뒤 새 active 를 INSERT 하도록 한다.
          // (uniq_active_sub_per_user 부분 unique 인덱스 충돌 방지)
          result = await this.chargeWithBillingKey(
            sub.userId,
            activeBillingKey.bid,
            currentAmount,
            sub.planName,
            sub.id,
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
          // 기존 sub 의 'expired' 처리는 이제 chargeWithBillingKey 의 트랜잭션 안에서 원자적으로 일어난다.
          // 여기서 또 한 번 UPDATE 하면 이미 expired 인 row 를 다시 expired 로 쓰는 것이라 문제는 없지만,
          // 의도와 흐름을 분명히 하기 위해 후처리는 남기지 않는다.
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

  async getBillingKeyStatusForUser(userId: string): Promise<{
    hasActiveBillingKey: boolean;
    cardName?: string;
    cardNo?: string;
    cardCode?: string;
  }> {
    const key = await this.getActiveBillingKey(userId);
    if (!key) return { hasActiveBillingKey: false };
    return {
      hasActiveBillingKey: true,
      cardName: key.cardName ?? undefined,
      cardNo: key.cardNo ?? undefined,
      cardCode: key.cardCode ?? undefined,
    };
  }

  private restoreInProgress = new Set<string>();

  async restoreSubscriptionWithBillingKey(
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    if (this.restoreInProgress.has(userId)) {
      return {
        success: false,
        message: '이전 재결제 요청을 처리하고 있습니다. 잠시 후 다시 시도해주세요.',
      };
    }
    this.restoreInProgress.add(userId);
    try {
      const activeBillingKey = await this.getActiveBillingKey(userId);
      if (!activeBillingKey) {
        return { success: false, message: '저장된 결제 수단이 없습니다. 새로 결제를 진행해주세요.' };
      }

      const activeSubscription = await this.getActiveSubscription(userId);
      if (activeSubscription) {
        return { success: false, message: '이미 활성 구독이 있습니다.' };
      }

      const amount = await this.getServerPlanAmount();
      const planName = 'monthly';

      logger.info('Restoring subscription with saved billing key', {
        userId,
        bidSuffix: `***${activeBillingKey.bid.slice(-4)}`,
        amount,
      });

      return await this.chargeWithBillingKey(userId, activeBillingKey.bid, amount, planName);
    } finally {
      this.restoreInProgress.delete(userId);
    }
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
   * Apple IAP 결제 PRE-CHECK.
   *
   * 클라이언트가 Apple StoreKit 결제창(`store.order(offer)`)을 띄우기 *직전*에 호출한다.
   * Apple IAP 는 우리가 임의로 환불/취소할 수 없으므로, "결제가 일어나기 전" 단계에서
   * 막아야 한다 (verifyAppleTransaction 의 throw 는 이미 결제 완료 후라 늦음).
   *
   * 검증:
   *  1) 본인인증 (최근 30일 내 휴대폰 인증)
   *  2) productId 가 우리가 판매 중인 상품인지
   *  3) 활성 구독이 이미 있는지
   *
   * verifyAppleTransaction 의 동일 가드는 클라이언트 우회 방어용으로 그대로 유지한다.
   * (precheck 와 결제 완료 사이의 race 는 어쩔 수 없으므로 마지막 방어선이 필요)
   */
  async precheckApplePurchase(
    userId: string,
    input: { productId: string }
  ): Promise<{ ok: true; productId: string }> {
    if (!appleProvider.isEnabled()) {
      throw new AppError('Apple in-app purchase is not configured', {
        statusCode: 503,
        code: 'APPLE_NOT_CONFIGURED',
      });
    }

    const expectedProductId = process.env.APPLE_PRODUCT_ID || 'subscription02';
    if (input.productId !== expectedProductId) {
      logger.warn({ userId, requested: input.productId, expected: expectedProductId },
        'Apple precheck: invalid productId');
      throw new AppError('현재 판매 중인 상품이 아닙니다.', {
        statusCode: 400,
        code: 'INVALID_PRODUCT',
      });
    }

    await this.assertIdentityVerified(userId);

    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new AppError('이미 활성 구독이 있습니다. 기존 구독을 취소한 후 다시 시도해주세요.', {
        statusCode: 409,
        code: 'ACTIVE_SUBSCRIPTION_EXISTS',
      });
    }

    return { ok: true, productId: expectedProductId };
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

    // 정책: 모든 결제 전 본인인증 필수 (NicePay/PayPal과 동일)
    // Apple IAP는 이미 결제가 일어난 뒤 영수증을 검증하는 단계이므로,
    // 여기서 차단되면 사용자는 Apple에 결제했지만 구독이 등록되지 않는다.
    // 클라이언트 게이트가 우회된 경우의 마지막 방어선.
    await this.assertIdentityVerified(userId);

    const verified = input.transactionId
      ? await appleProvider.verifyTransactionId(input.transactionId)
      : await appleProvider.verifyReceipt(input.receipt!);

    const expectedProductId = process.env.APPLE_PRODUCT_ID || 'subscription02';
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

  // 앱 언어를 PayPal locale 코드로 매핑. 미지정/미지원 언어는 en_US fallback.
  private mapPayPalLocale(appLanguage?: string | null): string {
    if (!appLanguage) return 'en_US';
    const lang = appLanguage.toLowerCase();
    if (lang.startsWith('ko')) return 'ko_KR';
    if (lang.startsWith('en')) return 'en_US';
    if (lang.startsWith('ja')) return 'ja_JP';
    return 'en_US';
  }

  // PayPal locale 매핑 전용: user_profiles.language를 raw nullable로 조회.
  // (getUserEmailAndNickname 은 'ko' 기본값을 강제하므로 PayPal locale 결정에는 부적합)
  // DB 조회 실패해도 결제 흐름이 끊기지 않도록 항상 안전한 fallback 반환.
  private async resolvePayPalLocale(userId: string): Promise<string> {
    try {
      const [row] = await db
        .select({ language: userProfiles.language })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      return this.mapPayPalLocale(row?.language ?? null);
    } catch (err) {
      logger.warn(
        { userId, error: err instanceof Error ? err.message : String(err) },
        'Failed to resolve PayPal locale, falling back to en_US',
      );
      return 'en_US';
    }
  }

  async initPayPalPayment(
    userId: string,
    planName: string,
    baseUrl: string,
    isNative: boolean = false
  ): Promise<{ approveUrl: string; orderId: string; paypalSubscriptionId: string }> {
    const activeSubscription = await this.getActiveSubscription(userId);
    if (activeSubscription) {
      throw new Error('You already have an active subscription.');
    }

    // PayPal은 해외 사용자 결제 수단이므로 본인인증 불필요
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

    const nativeFlag = isNative ? '&n=1' : '';
    const returnUrl = `${baseUrl}/api/payments/paypal/return?oid=${encodeURIComponent(orderId)}${nativeFlag}`;
    const cancelUrl = `${baseUrl}/api/payments/paypal/cancel?oid=${encodeURIComponent(orderId)}${nativeFlag}`;

    const result = await paypalProvider.createSubscription(
      planId,
      returnUrl,
      cancelUrl,
      orderId,
    );

    // Sweep 보정용: 발급된 PayPal subscription id 를 세션에 기록.
    // 사용자가 콜백 직전 브라우저를 닫는 등으로 활성화가 누락된 경우, sweep job 이
    // 이 컬럼을 단서로 PayPal 측 상태를 조회하여 활성/취소를 보정한다.
    await db
      .update(paymentSessions)
      .set({ externalSubscriptionId: result.subscriptionId })
      .where(eq(paymentSessions.orderId, orderId));

    // 사용자 앱 언어에 맞춰 PayPal 결제 페이지 UI 언어를 동적으로 지정.
    // 과거 en_US 강제로 인해 한국 사용자가 영어 페이지에 당황해 취소하는 문제를 해결.
    // locale 조회 실패는 결제 흐름을 막지 않고 en_US fallback.
    const locale = await this.resolvePayPalLocale(userId);
    const approveUrlWithLocale = result.approveUrl.includes('locale.x=')
      ? result.approveUrl
      : `${result.approveUrl}${result.approveUrl.includes('?') ? '&' : '?'}locale.x=${locale}`;

    logger.info(
      { orderId, paypalSubscriptionId: result.subscriptionId, userId, locale },
      'PayPal subscription initiated',
    );

    return {
      approveUrl: approveUrlWithLocale,
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
    internalOrderId: string,
    /**
     * sweep recovery 등에서 만료된 session 도 활용해야 할 때 미리 가져온 session 을 주입한다.
     * 주입 시 getPendingSession 의 expiresAt 체크를 우회한다.
     */
    preloadedSession?: { userId: string; amount: string; planName: string },
    /**
     * sweep recovery 모드에서 호출 시 true. catch 의 보상 cancel 을 절대 수행하지 않고
     * fail 만 반환한다 (다음 sweep 에서 재시도하도록 PayPal 구독은 살려두기 위함).
     * 일반 사용자 콜백에서는 false (기본).
     */
    suppressCompensationCancel: boolean = false,
  ): Promise<{ success: boolean; message: string }> {
    const session = preloadedSession ?? await this.getPendingSession(internalOrderId);
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
      // 보상 처리: DB 활성화에 실패했으므로 PayPal 쪽 구독을 즉시 취소한다.
      // 이렇게 하지 않으면 사용자 카드는 매월 빠지는데 우리 DB 에는 구독이 없는 "돈 먹튀" 상태가 된다.
      // 단, idempotency guard: 동시 콜백/재시도/부분 unique 인덱스 충돌로 다른 요청이 이미 동일
      // paypalSubscriptionId 로 구독을 활성화한 경우엔 정상 구독을 취소하면 안 된다.
      logger.error(
        { error, internalOrderId, paypalSubscriptionId, suppressCompensationCancel },
        'Failed to process PayPal subscription, checking idempotency before compensation cancel',
      );
      try {
        // existence-only guard: 동일 paypalSubscriptionId 의 subscription row 가 어떤 status 든
        // 존재하면 다른 동시 요청이 이미 처리한 것이므로 절대 cancel 하지 않는다.
        const [alreadyExists] = await db
          .select({ id: subscriptions.id, status: subscriptions.status })
          .from(subscriptions)
          .where(eq(subscriptions.paypalSubscriptionId, paypalSubscriptionId))
          .limit(1);
        if (alreadyExists) {
          logger.info(
            { paypalSubscriptionId, internalOrderId, subscriptionId: alreadyExists.id, status: alreadyExists.status },
            'PayPal subscription row exists from concurrent request - skipping compensation cancel',
          );
          return { success: true, message: 'Subscription already activated.' };
        }

        // sweep recovery 모드: cancel 절대 금지. 호출자가 grace window / retry 정책을 책임진다.
        if (suppressCompensationCancel) {
          logger.warn(
            { paypalSubscriptionId, internalOrderId },
            'PayPal activation failed under recovery mode - cancel suppressed, caller will retry',
          );
          return { success: false, message: 'Failed to process subscription.' };
        }

        const cancelled = await paypalProvider.cancelSubscription(
          paypalSubscriptionId,
          'Compensation: server-side activation failed',
        );
        logger.warn(
          { paypalSubscriptionId, internalOrderId, cancelled },
          'PayPal subscription compensation cancel result',
        );
      } catch (cancelErr) {
        logger.error(
          { paypalSubscriptionId, internalOrderId, error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr) },
          'PayPal compensation cancel failed - manual reconciliation required',
        );
      }
      return { success: false, message: 'Failed to process subscription.' };
    }
  }

  async cancelPayPalSubscription(paypalSubscriptionId: string): Promise<boolean> {
    return await paypalProvider.cancelSubscription(paypalSubscriptionId);
  }

  /**
   * Daily sweep: 결제 콜백(paypalReturn)이 누락된 PayPal 구독을 보정한다.
   *
   * 동기:
   *  - 사용자가 PayPal 결제 후 브라우저를 닫거나 네트워크가 끊어지면, PayPal 쪽에는 ACTIVE 구독이
   *    생성되지만 우리 DB 의 subscriptions 테이블에는 아무 레코드도 만들어지지 않는다.
   *  - 다음 결제 시도 시 PayPal 에 같은 사용자에 대해 또 다른 구독이 만들어져 매월 이중 청구가 된다.
   *
   * 동작:
   *  - paymentSessions 중 paymentMethod = 'PAYPAL' 이고 externalSubscriptionId 가 기록된 row 를 순회한다.
   *  - 이미 subscriptions 테이블에 같은 paypalSubscriptionId 로 active 구독이 있으면 session 만 정리한다.
   *  - PayPal API 로 상태를 조회하여:
   *      - ACTIVE/APPROVED:
   *          - RECOVERY_WINDOW(24h) 안 → 정상 활성화 콜백을 대신 수행한다 (DB INSERT 시도).
   *            성공하면 recovered, 실패하면 다음 sweep 에서 재시도하도록 session 보존 (cancel 안 함).
   *          - RECOVERY_WINDOW 초과 → 진짜 orphan 으로 보고 보상 cancel + session 정리.
   *      - 그 외 (CANCELLED/EXPIRED/SUSPENDED 등) → session 만 정리
   *  - PayPal 호출 실패 시 다음 sweep 에서 재시도하도록 그대로 둔다.
   *
   * 복구 우선 정책 동기:
   *  - "ACTIVE 면 무조건 cancel" 은 정상 결제 직후 우리 DB 트랜잭션이 깨진 사용자에게
   *    실제 결제는 빠지고 우리만 끊어버리는 사고를 만든다.
   *  - 따라서 충분한 grace 안에서는 복구를 먼저 시도하고, grace 가 지나면 사용자 카드에서
   *    매월 빠지는 "돈 먹튀" 를 막기 위해 보상 cancel 한다.
   */
  async sweepOrphanPayPalSubscriptions(): Promise<{ scanned: number; cancelled: number; cleaned: number; recovered: number; errors: number }> {
    const stats = { scanned: 0, cancelled: 0, cleaned: 0, recovered: 0, errors: 0 };
    const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24시간

    // 만료된 세션만 sweep 대상으로 본다 (정상 흐름은 30분 안에 처리되므로,
    // 만료 후에도 남아있다는 것은 콜백이 안 도달했음을 의미).
    const orphanSessions = await db
      .select()
      .from(paymentSessions)
      .where(
        and(
          eq(paymentSessions.paymentMethod, 'PAYPAL'),
          isNotNull(paymentSessions.externalSubscriptionId),
          lt(paymentSessions.expiresAt, new Date()),
        ),
      );

    stats.scanned = orphanSessions.length;
    if (orphanSessions.length === 0) return stats;

    logger.info({ count: orphanSessions.length }, 'PayPal orphan sweep: scanning expired sessions with external id');

    for (const session of orphanSessions) {
      const paypalSubscriptionId = session.externalSubscriptionId!;
      try {
        // 이미 활성화에 성공해 subscriptions 에 기록된 경우 → 세션만 정리
        const [existing] = await db
          .select({ id: subscriptions.id })
          .from(subscriptions)
          .where(eq(subscriptions.paypalSubscriptionId, paypalSubscriptionId))
          .limit(1);

        if (existing) {
          await this.deletePendingSession(session.orderId);
          stats.cleaned += 1;
          continue;
        }

        // PayPal 측 실제 상태 확인
        let details;
        try {
          details = await paypalProvider.getSubscriptionDetails(paypalSubscriptionId);
        } catch (apiErr) {
          stats.errors += 1;
          logger.warn(
            {
              orderId: session.orderId,
              paypalSubscriptionId,
              error: apiErr instanceof Error ? apiErr.message : String(apiErr),
            },
            'PayPal sweep: status check failed, will retry next run',
          );
          continue;
        }

        // ACTIVE / APPROVED:
        //   - 충분한 grace(RECOVERY_WINDOW) 안 → 복구 시도 우선 (정상 활성화 콜백 대행)
        //   - grace 초과 → 보상 cancel
        if (details.status === 'ACTIVE' || details.status === 'APPROVED') {
          const ageMs = Date.now() - new Date(session.createdAt).getTime();

          if (ageMs <= RECOVERY_WINDOW_MS) {
            // 복구 시도: _activatePayPalSubscriptionInner 가 INSERT + email 등 정상 흐름을 모두 수행한다.
            // session 이 만료된 상태이므로 preloadedSession 으로 expiresAt 체크를 우회한다.
            // suppressCompensationCancel=true 로 호출하여 inner 함수가 실패 시 PayPal cancel 을
            // 호출하지 못하도록 막는다 (cancel 권한은 sweep 의 grace 정책에만 있음).
            const recovery = await this._activatePayPalSubscriptionInner(
              paypalSubscriptionId,
              session.orderId,
              {
                userId: session.userId,
                amount: session.amount,
                planName: session.planName,
              },
              true,
            );

            if (recovery.success) {
              // _activatePayPalSubscriptionInner 성공 시 deletePendingSession 도 내부에서 수행됨
              stats.recovered += 1;
              logger.info(
                {
                  orderId: session.orderId,
                  userId: session.userId,
                  paypalSubscriptionId,
                  ageMinutes: Math.round(ageMs / 60000),
                },
                'PayPal sweep: orphan subscription recovered into DB (callback missing)',
              );
            } else {
              // 복구 실패 — session 보존하여 다음 sweep 에서 재시도 (cancel 하지 않는다)
              stats.errors += 1;
              logger.warn(
                {
                  orderId: session.orderId,
                  userId: session.userId,
                  paypalSubscriptionId,
                  recoveryMessage: recovery.message,
                  ageMinutes: Math.round(ageMs / 60000),
                  recoveryWindowMinutes: Math.round(RECOVERY_WINDOW_MS / 60000),
                },
                'PayPal sweep: recovery failed within window, will retry next sweep (no cancel)',
              );
            }
          } else {
            // grace 초과 → 진짜 orphan 으로 판단, 보상 cancel
            const cancelled = await paypalProvider.cancelSubscription(
              paypalSubscriptionId,
              'Compensation: callback missing, recovery window exceeded',
            );
            if (cancelled) {
              await this.deletePendingSession(session.orderId);
              stats.cancelled += 1;
              logger.warn(
                {
                  orderId: session.orderId,
                  userId: session.userId,
                  paypalSubscriptionId,
                  paypalStatus: details.status,
                  ageHours: Math.round(ageMs / 3600000),
                },
                'PayPal sweep: orphan subscription auto-cancelled after recovery window',
              );
            } else {
              stats.errors += 1;
              logger.error(
                { orderId: session.orderId, paypalSubscriptionId },
                'PayPal sweep: orphan cancel failed, manual reconciliation required',
              );
            }
          }
        } else {
          // 이미 PayPal 측에서도 종결된 상태 → 세션만 정리
          await this.deletePendingSession(session.orderId);
          stats.cleaned += 1;
          logger.info(
            { orderId: session.orderId, paypalSubscriptionId, paypalStatus: details.status },
            'PayPal sweep: session cleaned (PayPal side already terminal)',
          );
        }
      } catch (err) {
        stats.errors += 1;
        logger.error(
          {
            orderId: session.orderId,
            paypalSubscriptionId,
            error: err instanceof Error ? err.message : String(err),
          },
          'PayPal sweep: unexpected error processing orphan session',
        );
      }
    }

    logger.info(stats, 'PayPal orphan sweep finished');
    return stats;
  }
}

export const paymentService = new PaymentService();
